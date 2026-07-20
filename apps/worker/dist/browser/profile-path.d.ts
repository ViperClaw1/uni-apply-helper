import { ConfigService } from '@nestjs/config';
export declare function resolveProfileDir(configService: ConfigService, universityId: string): string | undefined;
export declare function getProfilesRoot(configService: ConfigService): string;
