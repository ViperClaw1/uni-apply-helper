import { ConfigService } from '@nestjs/config';
import type { BrowserContextOptions, Page } from 'playwright';
export declare function loadZzuStorageState(configService: ConfigService): BrowserContextOptions['storageState'] | undefined;
export declare function isLoginRedirect(url: string): boolean;
export declare function isLoginPage(page: Page): Promise<boolean>;
export declare function isCsrfBlocked(page: Page): Promise<boolean>;
export declare function isZzuFormUrl(formUrl: string): boolean;
