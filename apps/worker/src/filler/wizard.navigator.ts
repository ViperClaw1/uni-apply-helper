import { Injectable } from '@nestjs/common';
import type { WizardConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';

@Injectable()
export class WizardNavigator {
  async forEachStep(
    page: Page,
    wizard: WizardConfig,
    handler: (step: number) => Promise<void>,
    options?: {
      /** CSS selector that should appear after advancing to this step (AJAX wizards). */
      markerForStep?: (step: number) => string | undefined;
    },
  ): Promise<void> {
    for (let step = 1; step <= wizard.totalSteps; step += 1) {
      await handler(step);

      if (step < wizard.totalSteps) {
        const nextMarker = options?.markerForStep?.(step + 1);
        await this.clickNext(page, wizard.nextButtonSelector, nextMarker);
      }
    }
  }

  async clickNext(
    page: Page,
    selector: string,
    nextStepMarker?: string,
  ): Promise<void> {
    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);

    const next = await this.resolveNextButton(page, selector);
    await next.scrollIntoViewIfNeeded().catch(() => undefined);
    await next.waitFor({ state: 'attached', timeout: 15_000 });

    // 17gz Save and Next is XHR (saveBase.do) — no navigation. Track field signature.
    const beforeSig = await this.getStepSignature(page);

    const onclick = await next.getAttribute('onclick');
    if (onclick) {
      await next.evaluate((btn, handler) => {
        const run = new Function('btn', handler.replace(/\bthis\b/g, 'btn'));
        run(btn);
      }, onclick);
    } else {
      await next.click({ force: true });
    }

    // Prefer waiting for a known next-step field when available
    if (nextStepMarker) {
      await page
        .waitForSelector(nextStepMarker, {
          state: 'attached',
          timeout: 20_000,
        })
        .catch(() => undefined);
    }

    // Always wait until apply* field set changes (AJAX DOM swap)
    const advanced = await page
      .waitForFunction(
        (before) => {
          const names = [
            ...document.querySelectorAll(
              'input[name], select[name], textarea[name]',
            ),
          ]
            .map((el) => (el as HTMLInputElement).name)
            .filter((name) => name.startsWith('apply'))
            .slice(0, 40)
            .join('|');
          return names.length > 0 && names !== before;
        },
        beforeSig,
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);

    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);
    await page.waitForTimeout(800);

    if (!advanced) {
      const afterSig = await this.getStepSignature(page);
      if (afterSig === beforeSig) {
        throw new Error(
          'Wizard step did not advance after Save and Next (AJAX DOM unchanged). ' +
            `Still on fields: [${afterSig.split('|').slice(0, 12).join(', ')}]`,
        );
      }
    }
  }

  private async getStepSignature(page: Page): Promise<string> {
    return page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'input[name], select[name], textarea[name]',
        ),
      ]
        .map((el) => (el as HTMLInputElement).name)
        .filter((name) => name.startsWith('apply'))
        .slice(0, 40)
        .join('|'),
    );
  }

  private async resolveNextButton(page: Page, selector: string) {
    const cssButton = page.locator(selector).first();
    if ((await cssButton.count()) > 0) {
      return cssButton;
    }

    const fallbacks = [
      'input[value="Save and Next"]',
      'input[value="Next"]',
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
      .getByRole('button', { name: /save and next|next|下一步|保存并下一步/i })
      .first();
    if ((await semanticButton.count()) > 0) {
      return semanticButton;
    }

    return cssButton;
  }

  private async dismissBlockingDialogs(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const okButton = page
        .locator(
          [
            '.messager-button .okButton',
            '.messager-button input[value="Ok"]',
            '.messager-button input[value="OK"]',
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

    await page
      .waitForFunction(
        () =>
          !/请求正在处理中|please wait|processing your request/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: 15_000 },
      )
      .catch(() => undefined);
  }
}
