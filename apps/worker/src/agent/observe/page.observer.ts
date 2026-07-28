import { Injectable } from '@nestjs/common';
import type { AgentObservation } from '@uni-apply/shared';
import type { Page } from 'playwright';

type ObserveOptions = {
  includeScreenshot?: boolean;
};

@Injectable()
export class PageObserver {
  async observe(
    page: Page,
    options: ObserveOptions = {},
  ): Promise<AgentObservation> {
    const accessibilityTree = await this.capturePageStructure(page);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    const observation: AgentObservation = {
      url: page.url(),
      title: await page.title().catch(() => ''),
      accessibilityTree,
      visibleText: truncateVisibleText(bodyText),
    };

    if (options.includeScreenshot) {
      const screenshot = await page
        .screenshot({ type: 'jpeg', quality: 55, fullPage: false })
        .catch(() => undefined);

      if (screenshot) {
        observation.screenshotBase64 = screenshot.toString('base64');
      }
    }

    return observation;
  }

  async waitForStable(page: Page): Promise<void> {
    await page
      .waitForLoadState('domcontentloaded', { timeout: 10_000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
  }

  private async capturePageStructure(page: Page): Promise<string> {
    return page.evaluate(() => {
      const lines: string[] = [];
      const elements = [
        ...document.querySelectorAll(
          'input:not([type="hidden"]), select, textarea, button, a[href], [role="button"]',
        ),
      ];

      const maxNodes = 120;
      let count = 0;

      for (const element of elements) {
        if (count >= maxNodes) {
          break;
        }

        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }

        const tag = element.tagName.toLowerCase();
        const input = element as HTMLInputElement;
        const role = element.getAttribute('role') ?? tag;
        const nameAttr = element.getAttribute('name') ?? '';
        const id = element.id || '';

        const labelText = (
          element.getAttribute('aria-label') ??
          input.labels?.[0]?.textContent ??
          element.closest('label')?.textContent ??
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        const placeholder = element.getAttribute('placeholder') ?? '';
        let hint = placeholder;
        const describedBy = element.getAttribute('aria-describedby');
        if (describedBy) {
          const desc = describedBy
            .split(/\s+/)
            .map((ref) => document.getElementById(ref)?.textContent ?? '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (desc) {
            hint = hint ? `${hint}; ${desc}` : desc;
          }
        }

        const surrounding = (
          element.closest('td, th, .form-group, li, label')?.textContent ??
          element.parentElement?.textContent ??
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80);

        const required = Boolean(
          input.required ||
            element.getAttribute('aria-required') === 'true' ||
            /required/i.test(element.getAttribute('validate') || '') ||
            /required\s*:\s*true/i.test(
              element.getAttribute('data-options') || '',
            ),
        );

        let options = '';
        if (tag === 'select') {
          const select = element as HTMLSelectElement;
          const opts = [...select.options]
            .slice(0, 20)
            .map((opt) => {
              const t = (opt.textContent || '').replace(/\s+/g, ' ').trim();
              return opt.value ? `${t}=${opt.value}` : t;
            })
            .filter(Boolean);
          if (opts.length) {
            options = ` options=[${opts.join(' | ')}]`;
          }
        }

        const display =
          labelText ||
          nameAttr ||
          placeholder ||
          (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (!display) {
          continue;
        }

        const parts = [
          `[${role}]`,
          `name="${display.slice(0, 100)}"`,
          nameAttr ? `field=${nameAttr}` : '',
          id ? `id=${id}` : '',
          input.type ? `type=${input.type}` : '',
          required ? 'required=true' : '',
          hint ? `hint="${hint.slice(0, 60)}"` : '',
          surrounding && surrounding !== display
            ? `near="${surrounding}"`
            : '',
          options,
        ].filter(Boolean);

        lines.push(parts.join(' '));
        count += 1;
      }

      return lines.join('\n');
    });
  }
}

function truncateVisibleText(text: string, maxLength = 4_000): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength)}…`;
}
