import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from './stealth.config.js';
import { resolveProfileDir } from './profile-path.js';
import {
  getZzuContextOptions,
  loadZzuSessionMeta,
} from './zzu-session-meta.js';
import { loadZzuStorageState } from './zzu-session.loader.js';
import { loadUniversityStorageState } from './session.loader.js';

export type BrowserSessionOptions = {
  universityId: string;
  headed?: boolean;
};

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Browser;
  private readonly activeContexts = new Set<BrowserContext>();

  constructor(private readonly configService: ConfigService) {}

  async withPage<T>(
    universityId: string,
    handler: (page: Page) => Promise<T>,
  ): Promise<T> {
    return this.withPageOptions({ universityId }, handler);
  }

  async withPageOptions<T>(
    options: BrowserSessionOptions,
    handler: (page: Page) => Promise<T>,
  ): Promise<T> {
    const session = await this.createSession(options);

    try {
      return await handler(session.page);
    } finally {
      await session.context.close();
      this.activeContexts.delete(session.context);

      if (session.browser) {
        await session.browser.close();
        this.browser = undefined;
      }
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.activeContexts].map((context) => context.close()));
    await this.browser?.close();
  }

  getProfileDir(universityId: string): string | undefined {
    return resolveProfileDir(this.configService, universityId);
  }

  private async createSession(options: BrowserSessionOptions): Promise<{
    browser?: Browser;
    context: BrowserContext;
    page: Page;
  }> {
    const profileDir = resolveProfileDir(this.configService, options.universityId);
    const headed =
      options.headed ?? this.configService.get<string>('BROWSER_HEADED') === '1';

    if (profileDir) {
      const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] =
        {
          headless: !headed,
          args: ['--disable-blink-features=AutomationControlled'],
          acceptDownloads: true,
          viewport: { width: 1440, height: 1200 },
          ...getZzuContextOptions(loadZzuSessionMeta(this.configService)),
        };

      const channel = this.configService.get<string>('BROWSER_CHANNEL');
      if (channel) {
        launchOptions.channel = channel as 'chrome';
      } else {
        const legacyChannel = this.configService.get<string>('ZZU_BROWSER_CHANNEL');
        if (legacyChannel) {
          launchOptions.channel = legacyChannel as 'chrome';
        }
      }

      const context = await chromium.launchPersistentContext(
        profileDir,
        launchOptions,
      );
      this.activeContexts.add(context);
      const page = context.pages()[0] ?? (await context.newPage());
      return { context, page };
    }

    const cdpUrl =
      this.configService.get<string>('ZZU_USE_CDP') === '1'
        ? this.configService.get<string>('ZZU_CDP_URL')
        : undefined;

    if (cdpUrl) {
      const browser = await chromium.connectOverCDP(cdpUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      this.activeContexts.add(context);
      const page = context.pages()[0] ?? (await context.newPage());
      return { browser, context, page };
    }

    const browser = await this.getBrowser(headed);
    const storageState =
      loadUniversityStorageState(this.configService, options.universityId) ??
      loadZzuStorageState(this.configService);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1200 },
      ...(storageState ? { storageState } : {}),
      ...getZzuContextOptions(loadZzuSessionMeta(this.configService)),
    });
    this.activeContexts.add(context);
    const page = await context.newPage();

    return { browser, context, page };
  }

  private async getBrowser(headed: boolean): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const channel =
      this.configService.get<string>('BROWSER_CHANNEL') ??
      this.configService.get<string>('ZZU_BROWSER_CHANNEL');

    this.browser = await chromium.launch({
      headless: !headed,
      ...(channel ? { channel: channel as 'chrome' } : {}),
      args: ['--disable-blink-features=AutomationControlled'],
    });

    return this.browser;
  }
}
