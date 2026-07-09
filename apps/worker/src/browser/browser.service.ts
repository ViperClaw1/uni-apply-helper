import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Browser, Page } from 'playwright';
import { chromium } from './stealth.config.js';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Browser;

  async withPage<T>(handler: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1200 },
    });
    const page = await context.newPage();

    try {
      return await handler(page);
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: true,
    });

    return this.browser;
  }
}

