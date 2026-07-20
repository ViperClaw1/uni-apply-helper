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
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
  }

  private async capturePageStructure(page: Page): Promise<string> {
    return page.evaluate(() => {
      const lines: string[] = [];
      const elements = document.querySelectorAll(
        'input, select, textarea, button, a, [role]',
      );

      elements.forEach((element) => {
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute('role') ?? tag;
        const input = element as HTMLInputElement;
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('name') ??
          element.getAttribute('placeholder') ??
          input.labels?.[0]?.textContent ??
          element.textContent;

        if (!label?.trim()) {
          return;
        }

        lines.push(`[${role}] name="${label.trim().slice(0, 120)}"`);
      });

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
