import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
export declare class ScreenshotService {
    private readonly configService;
    private readonly s3?;
    private readonly bucket?;
    private readonly publicUrl?;
    constructor(configService: ConfigService);
    capture(page: Page, applicationId: string, label: string): Promise<string>;
}
