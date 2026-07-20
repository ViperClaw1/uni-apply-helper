import { ConfigService } from '@nestjs/config';
import type { FormFillMode, UniversitySchema } from '@uni-apply/shared';
export declare function resolveFillMode(configService: ConfigService, university: Pick<UniversitySchema, 'agent'>): FormFillMode;
export declare function resolveMaxAgentSteps(configService: ConfigService, university: Pick<UniversitySchema, 'agent'>, fallback?: number): number;
export declare function shouldUseVision(configService: ConfigService, university: Pick<UniversitySchema, 'agent'>): boolean;
