import { Injectable } from '@nestjs/common';
import type { WizardConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { ScreenshotService } from '../screenshot/screenshot.service.js';

@Injectable()
export class WizardNavigator {
  constructor(private readonly screenshotService: ScreenshotService) {}

  async forEachStep(
    page: Page,
    wizard: WizardConfig,
    handler: (step: number) => Promise<void>,
    options?: {
      /** CSS selector that should appear after advancing to this step (AJAX wizards). */
      markerForStep?: (step: number) => string | undefined;
      applicationId?: string;
    },
  ): Promise<void> {
    for (let step = 1; step <= wizard.totalSteps; step += 1) {
      await handler(step);

      if (step < wizard.totalSteps) {
        const nextMarker = options?.markerForStep?.(step + 1);
        await this.clickNext(
          page,
          wizard.nextButtonSelector,
          nextMarker,
          options?.applicationId,
          step,
        );
      }
    }
  }

  async clickNext(
    page: Page,
    selector: string,
    nextStepMarker?: string,
    applicationId?: string,
    fromStep?: number,
  ): Promise<void> {
    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);

    const next = await this.resolveNextButton(page, selector);
    await next.scrollIntoViewIfNeeded().catch(() => undefined);
    await next.waitFor({ state: 'attached', timeout: 15_000 });

    const beforeSig = await this.getStepSignature(page);
    const beforeUrl = page.url();

    // Prefer a real user click — CUCAS Next is type=submit; synthetic onclick
    // eval breaks HTML form validation / jQuery handlers.
    await next.click({ force: true });

    // OCR / validate AJAX often shows "It's processing!" right after Next.
    await this.waitForProcessingGone(page, 45_000);

    if (nextStepMarker) {
      await page
        .waitForSelector(nextStepMarker, {
          state: 'attached',
          timeout: 20_000,
        })
        .catch(() => undefined);
    }

    // CUCAS steps are separate URLs (apply_forms → apply_attr).
    const advanced = await Promise.race([
      page
        .waitForURL((url) => url.toString() !== beforeUrl, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForFunction(
          (before) => {
            const names = [
              ...document.querySelectorAll(
                'input[name], select[name], textarea[name], input[type="file"]',
              ),
            ]
              .map((el) => {
                const input = el as HTMLInputElement;
                return input.name || input.id || '';
              })
              .filter(Boolean)
              .slice(0, 40)
              .join('|');
            const sig = `${location.pathname}${location.search}|${names}`;
            return sig !== before;
          },
          beforeSig,
          { timeout: 20_000 },
        )
        .then(() => true)
        .catch(() => false),
    ]);

    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);
    await this.waitForProcessingGone(page, 20_000);
    await page.waitForTimeout(800);

    if (!advanced) {
      const afterSig = await this.getStepSignature(page);
      if (afterSig === beforeSig) {
        const validation = await this.collectValidationHints(page);
        const label = `wizard-stuck-step${fromStep ?? '?'}`;
        const screenshotUrl = applicationId
          ? await this.screenshotService.captureSafe(page, applicationId, label)
          : undefined;

        throw new Error(
          'Wizard step did not advance after Next (DOM/URL unchanged). ' +
            `Still on fields: [${afterSig.split('|').slice(0, 12).join(', ')}]` +
            (validation ? ` Validation: ${validation}` : '') +
            (screenshotUrl ? ` Screenshot: ${screenshotUrl}` : ''),
        );
      }
    }
  }

  private async collectValidationHints(page: Page): Promise<string> {
    return page.evaluate(() => {
      const texts: string[] = [];

      for (const el of document.querySelectorAll(
        'span.error:not(:empty), label.error:not(:empty), .error:not(:empty), .tip-error, .validate-error, .messager-body',
      )) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length < 120 && !texts.includes(t)) {
          texts.push(t);
        }
      }

      const emptyRequired: string[] = [];
      for (const el of document.querySelectorAll(
        'input[validate*="required"], select[validate*="required"], textarea[validate*="required"]',
      )) {
        const input = el as HTMLInputElement | HTMLSelectElement;
        if (input.type === 'hidden') continue;

        if (input.type === 'checkbox') {
          if (!(input as HTMLInputElement).checked) {
            emptyRequired.push(input.name || input.id || '?');
          }
          continue;
        }

        if (input.type === 'radio') {
          const name = input.name;
          if (!name) continue;
          const group = document.querySelectorAll(
            `input[type="radio"][name="${CSS.escape(name)}"]`,
          );
          const anyChecked = [...group].some(
            (r) => (r as HTMLInputElement).checked,
          );
          if (!anyChecked && !emptyRequired.includes(name)) {
            emptyRequired.push(name);
          }
          continue;
        }

        const val = (input.value || '').trim();
        if (!val || /please select/i.test(val)) {
          const placeholder =
            'placeholder' in input && typeof input.placeholder === 'string'
              ? input.placeholder
              : '';
          emptyRequired.push(input.name || input.id || placeholder || '?');
        }
      }

      const parts = [
        texts.slice(0, 8).join(' | '),
        emptyRequired.length
          ? `empty required: ${emptyRequired.slice(0, 15).join(', ')}`
          : '',
      ].filter(Boolean);

      return parts.join(' || ').slice(0, 800);
    });
  }

  private async getStepSignature(page: Page): Promise<string> {
    return page.evaluate(() => {
      const names = [
        ...document.querySelectorAll(
          'input[name], select[name], textarea[name], input[type="file"]',
        ),
      ]
        .map((el) => {
          const input = el as HTMLInputElement;
          return input.name || input.id || '';
        })
        .filter(Boolean)
        .slice(0, 40)
        .join('|');

      return `${location.pathname}${location.search}|${names}`;
    });
  }

  private async resolveNextButton(page: Page, selector: string) {
    // Never pick Save — CUCAS has both Save (button) and Next (submit).
    const preferred = page.locator('input[type="submit"][value="Next"]').first();
    if ((await preferred.count()) > 0) {
      return preferred;
    }

    const byValue = page.locator('input[value="Next"]').first();
    if ((await byValue.count()) > 0) {
      return byValue;
    }

    const cssButton = page.locator(selector).first();
    if ((await cssButton.count()) > 0) {
      const value = await cssButton.getAttribute('value');
      if (!value || !/^save$/i.test(value.trim())) {
        return cssButton;
      }
    }

    const fallbacks = [
      'input[value="Save and Next"]',
      'input[value="下一步"]',
      'input[value="保存并下一步"]',
      'button:has-text("Save and Next")',
      'button:has-text("Next")',
      'button:has-text("下一步")',
    ];

    for (const fallback of fallbacks) {
      const btn = page.locator(fallback).first();
      if ((await btn.count()) > 0) {
        return btn;
      }
    }

    const semanticButton = page
      .getByRole('button', { name: /save and next|^(next|下一步|保存并下一步)$/i })
      .first();
    if ((await semanticButton.count()) > 0) {
      return semanticButton;
    }

    return preferred;
  }

  private async dismissBlockingDialogs(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // Don't OK-dismiss an in-flight "It's processing!" overlay — wait instead.
      const processingVisible = await page
        .evaluate(() =>
          /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            document.body?.innerText ?? '',
          ),
        )
        .catch(() => false);

      if (processingVisible) {
        await this.waitForProcessingGone(page, 45_000);
        continue;
      }

      const okButton = page
        .locator(
          [
            '.messager-button .okButton',
            '.messager-button input[value="Ok"]',
            '.messager-button input[value="OK"]',
            'input.okButton',
            'button:has-text("OK")',
            'button:has-text("Continue")',
            'button:has-text("Accept")',
            'button:has-text("确定")',
          ].join(', '),
        )
        .first();

      if ((await okButton.count()) === 0) {
        break;
      }

      if (!(await okButton.isVisible().catch(() => false))) {
        break;
      }

      await okButton.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }

  async clickSubmit(page: Page, selector: string): Promise<void> {
    await this.waitForUiReady(page);

    const submit = page.locator(selector).first();
    await submit.scrollIntoViewIfNeeded().catch(() => undefined);
    await submit.waitFor({ state: 'attached', timeout: 15_000 });
    await submit.click({ force: true });

    await this.waitForUiReady(page);
    await page.waitForTimeout(800);
  }

  private async waitForUiReady(page: Page): Promise<void> {
    await page
      .locator('.window-mask, .el-loading-mask, .datagrid-mask')
      .first()
      .waitFor({ state: 'hidden', timeout: 20_000 })
      .catch(() => undefined);

    await this.waitForProcessingGone(page, 45_000);
  }

  private async waitForProcessingGone(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    await page
      .waitForFunction(
        () =>
          !/It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: timeoutMs },
      )
      .catch(() => undefined);
  }
}
