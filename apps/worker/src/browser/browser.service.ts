import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from './stealth.config.js';
import {
  getZzuContextOptions,
  loadZzuSessionMeta,
} from './zzu-session-meta.js';
import { loadZzuStorageState } from './zzu-session.loader.js';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Browser;
  private persistentContext?: BrowserContext;

  constructor(private readonly configService: ConfigService) {}

  async withPage<T>(handler: (page: Page) => Promise<T>): Promise<T> {
    const { browser, context, page, persistent } = await this.createSession();

    try {
      return await handler(page);
    } finally {
      if (persistent) {
        await context.close();
      } else {
        await context.close();
        await browser?.close();
      }
    }
  }

  async onModuleDestroy() {
    await this.persistentContext?.close();
    await this.browser?.close();
  }

  private async createSession(): Promise<{
    browser?: Browser;
    context: BrowserContext;
    page: Page;
    persistent: boolean;
  }> {
    const profileDir = this.configService.get<string>('ZZU_PROFILE_DIR');
    const useProfile =
      this.configService.get<string>('ZZU_USE_PROFILE') === '1' ||
      Boolean(profileDir);

    if (useProfile) {
      const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
        headless: this.configService.get<string>('ZZU_HEADED') !== '1',
        args: ['--disable-blink-features=AutomationControlled'],
        acceptDownloads: true,
        ...getZzuContextOptions(loadZzuSessionMeta(this.configService)),
      };

      const channel = this.configService.get<string>('ZZU_BROWSER_CHANNEL');
      if (channel) {
        launchOptions.channel = channel as 'chrome';
      }

      const context = await chromium.launchPersistentContext(
        profileDir ?? `${process.cwd()}/zzu-browser-profile`,
        launchOptions,
      );
      this.persistentContext = context;
      const page = context.pages()[0] ?? (await context.newPage());
      return { context, page, persistent: true };
    }

    const cdpUrl =
      this.configService.get<string>('ZZU_USE_CDP') === '1'
        ? this.configService.get<string>('ZZU_CDP_URL')
        : undefined;

    if (cdpUrl) {
      const browser = await chromium.connectOverCDP(cdpUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      return { browser, context, page, persistent: false };
    }

    const browser = await this.getBrowser();
    const storageState = loadZzuStorageState(this.configService);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1200 },
      ...(storageState ? { storageState } : {}),
      ...getZzuContextOptions(loadZzuSessionMeta(this.configService)),
    });
    const page = await context.newPage();

    return { browser, context, page, persistent: false };
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: this.configService.get<string>('ZZU_HEADED') !== '1',
      ...(this.configService.get<string>('ZZU_BROWSER_CHANNEL')
        ? { channel: this.configService.get<string>('ZZU_BROWSER_CHANNEL') as 'chrome' }
        : {}),
      args: ['--disable-blink-features=AutomationControlled'],
    });

    return this.browser;
  }
}

