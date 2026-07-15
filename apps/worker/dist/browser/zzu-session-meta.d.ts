import { ConfigService } from '@nestjs/config';
export type ZzuSessionMeta = {
    userAgent?: string;
    capturedAt?: string;
    mode?: 'storageState' | 'profile' | 'cdp';
};
export declare function loadZzuSessionMeta(configService: ConfigService): ZzuSessionMeta;
export declare function getZzuContextOptions(meta: ZzuSessionMeta): {
    locale: string;
    timezoneId: string;
    userAgent?: string;
    extraHTTPHeaders: Record<string, string>;
};
