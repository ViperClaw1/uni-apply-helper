import type { SessionConfig, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare function assertSessionValid(page: Page, university: Pick<UniversitySchema, 'id' | 'displayName' | 'session'>): Promise<void>;
export declare function getLoginUrl(formUrl: string, session?: SessionConfig): string;
