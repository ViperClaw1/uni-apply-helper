import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';

@Injectable()
export class SubmitHandler {
  async submit(page: Page): Promise<void> {
    const submit = page
      .locator(
        [
          "button[type='submit']",
          "input[type='submit']",
          'button:has-text("Submit")',
          'button:has-text("Отправить")',
        ].join(', '),
      )
      .first();

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
      submit.click(),
    ]);
  }
}

