import { Injectable } from '@nestjs/common';
import type { FieldConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';

const BLOCKING_DIALOG_BUTTONS = [
  '.messager-button .okButton',
  '.messager-button input[value="Ok"]',
  '.messager-button input[value="OK"]',
  'button:has-text("OK")',
  'button:has-text("Ok")',
  'button:has-text("Continue")',
  'button:has-text("Accept")',
  'input[value="OK"]',
  'input[value="Ok"]',
  'input[value="Continue"]',
  'input[value="Accept"]',
].join(', ');

@Injectable()
export class PreWizardNavigator {
  async navigateToForm(page: Page, fields: FieldConfig[]): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (await this.isFormVisible(page, fields)) {
        return;
      }

      const dismissed = await this.dismissBlockingDialogs(page);
      const choseProgram = await this.chooseProgramIfNeeded(page);
      const clickedContinue = await this.clickContinueIfNeeded(page);

      if (!dismissed && !choseProgram && !clickedContinue) {
        break;
      }

      await page.waitForTimeout(600);
    }
  }

  async dismissBlockingDialogs(page: Page): Promise<boolean> {
    let dismissed = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const button = page.locator(BLOCKING_DIALOG_BUTTONS).first();

      if ((await button.count()) === 0) {
        break;
      }

      await button.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
      dismissed = true;
    }

    return dismissed;
  }

  private async isFormVisible(page: Page, fields: FieldConfig[]): Promise<boolean> {
    const selectors = fields
      .filter((field) => field.type !== 'file')
      .map((field) => field.selector)
      .slice(0, 8);

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        continue;
      }

      if (await locator.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async chooseProgramIfNeeded(page: Page): Promise<boolean> {
    const bodyText = await page.locator('body').innerText();

    if (!/please choose your (program|type)/i.test(bodyText)) {
      return false;
    }

    const option = page
      .locator('.el-radio, .el-radio__label, input[type="radio"]')
      .first();

    if ((await option.count()) > 0) {
      await option.click({ force: true });
    }

    await page.waitForTimeout(400);

    const nextButton = page
      .getByRole('button', { name: /^(Next|下一步)$/i })
      .first();
    if ((await nextButton.count()) > 0) {
      await nextButton.click({ force: true });
      await page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => undefined);
      return true;
    }

    const fallback = page
      .locator(
        'button:has-text("Next"), button:has-text("下一步"), input[value="Next"], input[value="下一步"]',
      )
      .first();

    if ((await fallback.count()) > 0) {
      await fallback.click({ force: true });
      return true;
    }

    return false;
  }

  private async clickContinueIfNeeded(page: Page): Promise<boolean> {
    const continueButton = page
      .getByRole('button', { name: /^(Continue|Accept|Agree)$/i })
      .first();

    if ((await continueButton.count()) === 0) {
      return false;
    }

    await continueButton.click({ force: true });
    await page
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .catch(() => undefined);
    return true;
  }
}
