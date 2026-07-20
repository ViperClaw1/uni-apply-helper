import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
export type BrowserSessionOptions = {
    universityId: string;
    headed?: boolean;
};
export declare class BrowserService implements OnModuleDestroy {
    private readonly configService;
    private browser?;
    private readonly activeContexts;
    constructor(configService: ConfigService);
    withPage<T>(universityId: string, handler: (page: Page) => Promise<T>): Promise<T>;
    withPageOptions<T>(options: BrowserSessionOptions, handler: (page: Page) => Promise<T>): Promise<T>;
    onModuleDestroy(): Promise<void>;
    getProfileDir(universityId: string): string | undefined;
    private createSession;
    private getBrowser;
}
