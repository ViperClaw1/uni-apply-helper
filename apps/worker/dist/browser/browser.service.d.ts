import { OnModuleDestroy } from '@nestjs/common';
import type { Page } from 'playwright';
export declare class BrowserService implements OnModuleDestroy {
    private browser?;
    withPage<T>(handler: (page: Page) => Promise<T>): Promise<T>;
    onModuleDestroy(): Promise<void>;
    private getBrowser;
}
