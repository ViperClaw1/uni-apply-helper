import { Injectable, Logger } from '@nestjs/common';
import type { AgentAction, AgentActionTarget } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { existsSync } from 'node:fs';

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

@Injectable()
export class ActionExecutor {
  private readonly logger = new Logger(ActionExecutor.name);

  async execute(page: Page, action: AgentAction): Promise<void> {
    switch (action.type) {
      case 'fill':
        await this.fillValue(page, action);
        return;
      case 'select':
        await this.resolveLocator(page, action.target)
          .selectOption({ label: action.value ?? '' })
          .catch(async () => {
            await this.resolveLocator(page, action.target).selectOption(
              action.value ?? '',
            );
          });
        return;
      case 'check':
        await this.resolveLocator(page, action.target).check();
        return;
      case 'click':
        if (this.isForbiddenWizardBackNav(action)) {
          this.logger.warn(
            `Blocked agent back-navigation: ${JSON.stringify(action.target)} — stay on current step`,
          );
          throw new Error(
            'Refusing to navigate to an earlier wizard step. Fill the current step and click Save and Next.',
          );
        }
        await this.resolveLocator(page, action.target).click({ force: true });
        return;
      case 'upload':
        await this.executeUpload(page, action);
        return;
      case 'wait':
        await page.waitForTimeout(Number(action.value ?? 1_000));
        return;
      case 'done':
      case 'fail':
        return;
      default:
        throw new Error(`Unsupported agent action: ${action.type}`);
    }
  }

  /** Agent must never jump back to Step 1/2/… via wizard tabs. */
  private isForbiddenWizardBackNav(action: AgentAction): boolean {
    const blob = [
      action.target?.selector,
      action.target?.name,
      action.target?.label,
      action.reason,
    ]
      .filter(Boolean)
      .join(' ');

    if (
      /Save and Next|保存并下一步|Next|下一步|Previous|上一步/i.test(blob) &&
      !/Step\s*[1-3]\b|Basic Info|Study Plan/i.test(blob)
    ) {
      return false;
    }

    return (
      /step\s*=\s*[123]\b|step-[123]\b|Basic Info|Study Plan|Education & Employment/i.test(
        blob,
      ) ||
      /wizard step\s*[123]\b|navigate bac|go back to step/i.test(blob)
    );
  }

  private async fillValue(page: Page, action: AgentAction): Promise<void> {
    const raw = action.value ?? '';
    const value = normalizeDateLike(raw);
    const locator = this.resolveLocator(page, action.target);
    const looksLikeDate = isDateLikeValue(value) || isDateTarget(action.target);

    if (looksLikeDate) {
      const set = await locator
        .evaluate((el, nextValue) => {
          const input = el as HTMLInputElement;
          input.focus();
          input.value = nextValue;
          input.setAttribute('value', nextValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.blur();
          return true;
        }, value)
        .catch(() => false);

      await this.closeDatePickers(page);
      if (set) return;
    }

    await locator.fill(value);
    if (looksLikeDate) {
      await this.closeDatePickers(page);
    }
  }

  private async closeDatePickers(page: Page): Promise<void> {
    await page.evaluate(() => {
      const roots = [
        ...document.querySelectorAll(
          '.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel',
        ),
      ];
      for (const root of roots) {
        const style = getComputedStyle(root as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }
        const ok = [
          ...root.querySelectorAll(
            '#dpOkInput, input[value="OK"], input[value="Ok"], input[value="确定"], button',
          ),
        ].find((el) =>
          /^(OK|Ok|确定)$/i.test(
            ((el as HTMLInputElement).value || el.textContent || '').trim(),
          ),
        ) as HTMLElement | undefined;
        ok?.click();
      }
    });
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(
        '.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel',
      )) {
        (el as HTMLElement).style.display = 'none';
      }
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
  }

  private async executeUpload(page: Page, action: AgentAction): Promise<void> {
    const source = action.filePath ?? action.value;
    if (!source?.trim()) {
      throw new Error('upload action requires filePath or value');
    }

    const payload = await this.resolveFilePayload(source.trim());

    // Prefer direct file input when target resolves to <input type=file>
    if (action.target) {
      try {
        const locator = this.resolveLocator(page, action.target);
        if ((await locator.count()) > 0) {
          const tag = await locator
            .evaluate((el) => (el as HTMLInputElement).tagName)
            .catch(() => '');
          const type = await locator
            .evaluate((el) => (el as HTMLInputElement).type)
            .catch(() => '');
          if (tag === 'INPUT' && type === 'file') {
            await locator.setInputFiles(payload);
            return;
          }
        }
      } catch {
        // fall through to filechooser
      }
    }

    // PKU/17gz-style: click trigger → filechooser
    // Promise.all so a failed click doesn't leave an unhandled filechooser rejection
    // (that previously crashed the Nest worker → BullMQ stall).
    if (!action.target) {
      throw new Error(
        'upload: target required (do not click first Add Document on Step 6)',
      );
    }

    try {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15_000 }),
        this.resolveLocator(page, action.target).click({ force: true }),
      ]);
      await chooser.setFiles(payload);
    } catch (error) {
      const already = await page
        .evaluate(() => {
          for (const win of document.querySelectorAll(
            '.messager-body, .messager-window',
          )) {
            const t = (win.textContent || '').replace(/\s+/g, ' ');
            if (/already uploaded|Click Save and Next/i.test(t)) {
              return t.slice(0, 200);
            }
          }
          return null;
        })
        .catch(() => null);
      if (already) {
        this.logger.log(`upload skipped — already uploaded: ${already}`);
        await page.evaluate(() => {
          for (const win of document.querySelectorAll(
            '.messager-window, .panel.window',
          )) {
            const ok = [
              ...win.querySelectorAll(
                'input.okButton, input[value="Ok"], input[value="OK"], button, a',
              ),
            ].find((el) =>
              /^(Ok|OK|确定)$/i.test(
                ((el as HTMLInputElement).value || el.textContent || '').trim(),
              ),
            ) as HTMLElement | undefined;
            ok?.click();
          }
        });
        return;
      }
      throw error;
    }
    const label = typeof payload === 'string' ? payload : payload.name;
    this.logger.log(`upload via filechooser: ${label}`);
  }

  private async resolveFilePayload(
    source: string,
  ): Promise<string | FilePayload> {
    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`upload: failed to download ${source} (${response.status})`);
      }
      const contentType =
        response.headers.get('content-type') ?? 'application/octet-stream';
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = extensionFromMime(contentType);
      return {
        name: `upload${ext}`,
        mimeType: contentType.split(';')[0]?.trim() || 'application/octet-stream',
        buffer,
      };
    }

    if (!existsSync(source)) {
      throw new Error(`upload: file not found: ${source}`);
    }

    return source;
  }

  resolveLocator(page: Page, target?: AgentActionTarget): Locator {
    if (!target) {
      throw new Error('Agent action target is required.');
    }

    if (target.selector) {
      // Gemini often emits comma-joined alternatives — Playwright treats that
      // as one invalid selector. Prefer the first fragment.
      const first = target.selector
        .split(',')
        .map((part) => part.trim())
        .find((part) => part.length > 0);
      return page.locator(first || target.selector).first();
    }

    if (target.label) {
      return page.getByLabel(target.label, { exact: false }).first();
    }

    if (target.placeholder) {
      return page.getByPlaceholder(target.placeholder, { exact: false }).first();
    }

    if (target.role && target.name) {
      return page
        .getByRole(target.role as Parameters<Page['getByRole']>[0], {
          name: target.name,
          exact: false,
        })
        .first();
    }

    if (target.name) {
      return page.getByText(target.name, { exact: false }).first();
    }

    throw new Error('Could not resolve locator from agent target.');
  }
}

function extensionFromMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base.includes('pdf')) return '.pdf';
  if (base.includes('png')) return '.png';
  if (base.includes('jpeg') || base.includes('jpg')) return '.jpg';
  if (base.includes('webp')) return '.webp';
  return '.bin';
}

function normalizeDateLike(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  return iso?.[1] ?? trimmed;
}

function isDateLikeValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value.trim());
}

function isDateTarget(target?: AgentActionTarget): boolean {
  if (!target) return false;
  const blob = [target.selector, target.label, target.name, target.placeholder]
    .filter(Boolean)
    .join(' ');
  return /date|borned|birth|expire|expiry|attended|startDate|endDate/i.test(
    blob,
  );
}
