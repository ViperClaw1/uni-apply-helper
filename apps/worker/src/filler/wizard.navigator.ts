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
    // 17gz AJAX: clear any leftover processing overlay before Next.
    await this.waitForProcessingDone(page, 60_000);
    await this.dismissBlockingDialogs(page);
    await this.closeDatePickers(page);

    const next = await this.resolveNextButton(page, selector);
    await next.scrollIntoViewIfNeeded().catch(() => undefined);
    await next.waitFor({ state: 'visible', timeout: 15_000 }).catch(async () => {
      await next.waitFor({ state: 'attached', timeout: 15_000 });
    });

    const beforeSig = await this.getStepSignature(page);
    const beforeUrl = page.url();

    // Real click — 17gz wires saveStudyPlanAndNextStep / saveStudyWork / etc. via onclick.
    await next.click({ force: true });

    // Give the processing overlay a moment to appear, then wait it out.
    await page.waitForTimeout(300);
    await this.waitForProcessingDone(page, 60_000);

    if (nextStepMarker) {
      await page
        .waitForSelector(nextStepMarker, {
          state: 'attached',
          timeout: 25_000,
        })
        .catch(() => undefined);
    }

    // 17gz keeps the same URL (/apply/index.do) and swaps #main_right_content via AJAX.
    const advanced = await Promise.race([
      page
        .waitForURL((url) => url.toString() !== beforeUrl, { timeout: 25_000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForFunction(
          (before) => {
            const sig = (window as unknown as { __uniApplyStepSig?: () => string })
              .__uniApplyStepSig?.();
            // Inline same logic if helper not injected
            const content =
              document.querySelector(
                '#main_right_content, #apply_content, .main_right, form[name="applyForm"], form',
              )?.innerHTML ?? '';
            const active =
              document
                .querySelector(
                  '.list_title li.on, .list_title li.cur, .wizard li.active, li.current, .process li.on',
                )
                ?.textContent?.replace(/\s+/g, ' ')
                .trim() ?? '';
            const names = [
              ...document.querySelectorAll(
                'input[name], select[name], textarea[name]',
              ),
            ]
              .map((el) => (el as HTMLInputElement).name || '')
              .filter((n) =>
                /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n),
              )
              .slice(0, 30)
              .join('|');
            const markers = [
              document.querySelector('input[name="apply.lastName"]') && 's1',
              document.querySelector(
                'input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]',
              ) && 's2',
              document.querySelector(
                'input[name="sh.studyPlace"], input[name="sh.startDate"]',
              ) && 's3',
              document.querySelector('input[name="apply.emergencyName"]') && 's4',
              document.querySelector('input[name="apply.homeMobile"]') && 's5',
              document.querySelector(
                'input[value="Add Document"], [attachTypeId] input[type="file"]',
              ) && 's6',
              (/preview|submit/i.test(active) ||
                (document.querySelector('input[value="Submit"]') &&
                  !document.querySelector('input[name="apply.homeMobile"]'))) &&
                's7',
            ]
              .filter(Boolean)
              .join(',');
            const fingerprint = `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
            return (sig ?? fingerprint) !== before;
          },
          beforeSig,
          { timeout: 25_000 },
        )
        .then(() => true)
        .catch(() => false),
    ]);

    await this.waitForProcessingDone(page, 30_000);
    await this.dismissBlockingDialogs(page);
    await this.closeDatePickers(page);
    await page.waitForTimeout(500);

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
        // Skip the AJAX spinner copy — it is not a validation error.
        if (
          !t ||
          t.length >= 120 ||
          /It'?s processing|please wait|请求正在处理/i.test(t)
        ) {
          continue;
        }
        if (!texts.includes(t)) {
          texts.push(t);
        }
      }

      const emptyRequired: string[] = [];
      for (const el of document.querySelectorAll(
        'input[validate*="required"], select[validate*="required"], textarea[validate*="required"], input[data-options*="required:true"], select[data-options*="required:true"]',
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
        if (!val || /please select|^-choose-$/i.test(val)) {
          emptyRequired.push(input.name || input.id || '?');
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

  /**
   * Signature for 17gz AJAX wizards: same URL, content panel + active tab + field names.
   */
  private async getStepSignature(page: Page): Promise<string> {
    return page.evaluate(() => {
      const content =
        document.querySelector(
          '#main_right_content, #apply_content, .main_right, form[name="applyForm"], form',
        )?.innerHTML ?? '';
      const active =
        document
          .querySelector(
            '.list_title li.on, .list_title li.cur, .wizard li.active, li.current, .process li.on',
          )
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? '';
      const names = [
        ...document.querySelectorAll(
          'input[name], select[name], textarea[name]',
        ),
      ]
        .map((el) => (el as HTMLInputElement).name || '')
        .filter((n) => /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n))
        .slice(0, 30)
        .join('|');

      // Distinctive step markers (stable across datepicker noise)
      const markers = [
        document.querySelector('input[name="apply.lastName"]') && 's1',
        document.querySelector(
          'input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]',
        ) && 's2',
        document.querySelector('input[name="sh.studyPlace"], input[name="sh.startDate"]') &&
          's3',
        document.querySelector('input[name="apply.emergencyName"]') && 's4',
        document.querySelector('input[name="apply.homeMobile"]') && 's5',
        document.querySelector(
          'input[value="Add Document"], [attachTypeId] input[type="file"]',
        ) && 's6',
        (/preview|submit/i.test(active) ||
          (document.querySelector('input[value="Submit"]') &&
            !document.querySelector('input[name="apply.homeMobile"]'))) &&
          's7',
      ]
        .filter(Boolean)
        .join(',');

      return `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
    });
  }

  private async resolveNextButton(page: Page, selector: string) {
    // Prefer Save and Next on 17gz — plain "Next"/"Save" are wrong targets.
    const saveAndNext = page
      .locator(
        'input[value="Save and Next"], input[value="保存并下一步"], button:has-text("Save and Next")',
      )
      .first();
    if ((await saveAndNext.count()) > 0) {
      return saveAndNext;
    }

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
      'input[value="下一步"]',
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
      .getByRole('button', {
        name: /save and next|^(next|下一步|保存并下一步)$/i,
      })
      .first();
    if ((await semanticButton.count()) > 0) {
      return semanticButton;
    }

    return preferred;
  }

  private async dismissBlockingDialogs(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const processingVisible = await this.isProcessingVisible(page);
      if (processingVisible) {
        await this.waitForProcessingDone(page, 60_000);
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

      // Never click Ok on a still-processing dialog.
      const isProcessingDialog = await page
        .evaluate(() => {
          const win = document.querySelector(
            '.messager-window, .panel.window',
          );
          return /It'?s processing|please wait|请求正在处理/i.test(
            win?.textContent || '',
          );
        })
        .catch(() => false);
      if (isProcessingDialog) {
        await this.waitForProcessingDone(page, 60_000);
        continue;
      }

      await okButton.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }

  async clickSubmit(page: Page, selector: string): Promise<void> {
    await this.waitForProcessingDone(page, 60_000);
    await this.dismissBlockingDialogs(page);
    await this.closeDatePickers(page);

    const submit = await this.resolveSubmitButton(page, selector);
    await submit.scrollIntoViewIfNeeded().catch(() => undefined);
    await submit
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(async () => {
        await submit.waitFor({ state: 'attached', timeout: 15_000 });
      });

    const beforeSig = await this.getStepSignature(page);
    await submit.click({ force: true });

    await page.waitForTimeout(300);
    await this.waitForProcessingDone(page, 90_000);
    await this.dismissBlockingDialogs(page);

    // PKU keeps /apply/index.do — success is AJAX content / dialog, not a redirect.
    const success = await page
      .waitForFunction(
        (before) => {
          const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
          if (
            /successfully submitted|submit(ted)? successfully|application (has been )?submitted|申请.*成功|提交成功|has been received/i.test(
              text,
            )
          ) {
            return true;
          }
          const content =
            document.querySelector(
              '#main_right_content, #apply_content, .main_right, form',
            )?.innerHTML ?? '';
          const active =
            document
              .querySelector(
                '.list_title li.on, .list_title li.cur, .wizard li.active, li.current',
              )
              ?.textContent?.replace(/\s+/g, ' ')
              .trim() ?? '';
          const names = [
            ...document.querySelectorAll('input[name], select[name]'),
          ]
            .map((el) => (el as HTMLInputElement).name || '')
            .filter((n) => /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n))
            .slice(0, 30)
            .join('|');
          const markers = [
            document.querySelector('input[name="apply.lastName"]') && 's1',
            document.querySelector(
              'input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]',
            ) && 's2',
            document.querySelector(
              'input[name="sh.studyPlace"], input[name="sh.startDate"]',
            ) && 's3',
            document.querySelector('input[name="apply.emergencyName"]') &&
              's4',
            document.querySelector('input[name="apply.homeMobile"]') && 's5',
            document.querySelector(
              'input[value="Add Document"], [attachTypeId]',
            ) && 's6',
            /preview|submit/i.test(active) && 's7',
          ]
            .filter(Boolean)
            .join(',');
          const sig = `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
          return sig !== before;
        },
        beforeSig,
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);

    await this.dismissBlockingDialogs(page);
    await page.waitForTimeout(500);

    if (!success) {
      // Soft-ok: URL never changes on 17gz; processing finished without error dialog.
      const hasError = await page.evaluate(() => {
        const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
        return /failed|error|invalid|必填|不能为空/i.test(text) &&
          document.querySelector(
            'span.error:not(:empty), label.error:not(:empty), .validate-error',
          );
      });
      if (hasError) {
        throw new Error(
          'Final submit did not succeed (validation/error still on page, URL unchanged as expected for 17gz AJAX).',
        );
      }
    }
  }

  private async resolveSubmitButton(page: Page, selector: string) {
    // Prefer explicit Submit when present (some 17gz skins).
    const explicit = page
      .locator(
        'input[value="Submit"], input[value="提交"], button:has-text("Submit"), button:has-text("提交")',
      )
      .first();
    if ((await explicit.count()) > 0) {
      return explicit;
    }

    // PKU preview/final often still shows Save and Next (AJAX submit, no redirect).
    const saveAndNext = page
      .locator(
        'input[value="Save and Next"], input[value="保存并下一步"], button:has-text("Save and Next")',
      )
      .first();
    if ((await saveAndNext.count()) > 0) {
      return saveAndNext;
    }

    const css = page.locator(selector).first();
    if ((await css.count()) > 0) {
      return css;
    }

    return explicit;
  }

  private async waitForUiReady(page: Page): Promise<void> {
    await page
      .locator('.window-mask, .el-loading-mask, .datagrid-mask')
      .first()
      .waitFor({ state: 'hidden', timeout: 20_000 })
      .catch(() => undefined);

    await this.waitForProcessingDone(page, 60_000);
  }

  private async waitForProcessingDone(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    await page
      .waitForFunction(() => {
        const bodyText = document.body?.innerText ?? '';
        if (
          /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            bodyText,
          )
        ) {
          // Only treat as blocking if a visible messager/mask is up, or the
          // spinner text is prominent — bodyText can retain stale copy.
          const wins = [
            ...document.querySelectorAll(
              '.messager-window, .panel.window, .window-mask, .datagrid-mask',
            ),
          ];
          const visibleProcessing = wins.some((win) => {
            const style = getComputedStyle(win as HTMLElement);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            const rect = (win as HTMLElement).getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              return false;
            }
            return /It'?s processing|please wait|请求正在处理|processing your request/i.test(
              win.textContent || '',
            );
          });
          return !visibleProcessing;
        }
        return true;
      }, { timeout: timeoutMs })
      .catch(() => undefined);

    await page.waitForTimeout(300);
  }

  private async isProcessingVisible(page: Page): Promise<boolean> {
    return page
      .evaluate(() => {
        const wins = [
          ...document.querySelectorAll(
            '.messager-window, .panel.window, .window-mask',
          ),
        ];
        return wins.some((win) => {
          const style = getComputedStyle(win as HTMLElement);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          const rect = (win as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            return false;
          }
          return /It'?s processing|please wait|请求正在处理|processing your request/i.test(
            win.textContent || '',
          );
        });
      })
      .catch(() => false);
  }

  private async closeDatePickers(page: Page): Promise<void> {
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
}
