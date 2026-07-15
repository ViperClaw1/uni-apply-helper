import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
export declare class BrowserService implements OnModuleDestroy {
    private readonly configService;
    private browser?;
    private persistentContext?;
    constructor(configService: ConfigService);
    withPage<T>(handler: (page: Page) => Promise<T>): Promise<T>;
    onModuleDestroy(): Promise<void>;
    private createSession;
    private getBrowser;
}
