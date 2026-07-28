import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';

/**
 * Shared dialog dismiss for agent loop — mirrors zzu-pre-wizard rules:
 * never Ok-click "It's processing!" overlays (aborts 17gz AJAX).
 */
@Injectable()
export class DialogDismisser {
  async dismissIfPresent(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const isProcessing = await page
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
            return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
              win.textContent || '',
            );
          });
        })
        .catch(() => false);

      if (isProcessing) {
        break;
      }

      const okButton = page
        .locator(
          [
            'input.okButton',
            'input[value="Ok"]',
            'input[value="OK"]',
            '.messager-button .okButton',
            '.messager-button input[value="Ok"]',
            '.messager-button input[value="OK"]',
            '.messager-button a',
            '.messager-window input.okButton',
            'button:has-text("OK")',
            'button:has-text("Ok")',
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
      await page.waitForTimeout(300);
    }
  }
}
