import { ConfigService } from '@nestjs/config';
import type { BrowserContextOptions } from 'playwright';
export declare function loadUniversityStorageState(configService: ConfigService, universityId: string): BrowserContextOptions['storageState'] | undefined;
export declare function getSessionEnvKeyForUniversity(universityId: string): string;
