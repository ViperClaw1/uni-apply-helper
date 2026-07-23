import { Injectable } from '@nestjs/common';
import type { WizardConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';

@Injectable()
export class WizardNavigator {
  async forEachStep(
    page: Page,
    wizard: WizardConfig,
    handler: (step: number) => Promise<void>,
  ): Promise<void> {
    for (let step = 1; step <= wizard.totalSteps; step += 1) {
      await handler(step);

      if (step < wizard.totalSteps) {
        await this.clickNext(page, wizard.nextButtonSelector);
      }
    }
  }

  async clickNext(page: Page, selector: string): Promise<void> {
    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);

    const next = await this.resolveNextButton(page, selector);
    await next.waitFor({ state: 'visible', timeout: 15_000 });

    const onclick = await next.getAttribute('onclick');
    if (onclick) {
      await next.evaluate((btn, handler) => {
        const run = new Function('btn', handler.replace(/\bthis\b/g, 'btn'));
        run(btn);
      }, onclick);
    } else {
      await next.click({ force: true });
    }

    await page
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .catch(() => undefined);
    await this.waitForUiReady(page);
    await this.dismissBlockingDialogs(page);
    await page.waitForTimeout(500);
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
    await submit.waitFor({ state: 'visible', timeout: 15_000 });
    await submit.click({ force: true });

    await page
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .catch(() => undefined);
  }

  private async waitForUiReady(page: Page): Promise<void> {
    await page
      .locator('.window-mask, .el-loading-mask')
      .first()
      .waitFor({ state: 'hidden', timeout: 20_000 })
      .catch(() => undefined);
  }
}
