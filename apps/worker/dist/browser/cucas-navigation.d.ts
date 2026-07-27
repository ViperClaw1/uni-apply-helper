import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
export declare function isCucasChiwestUrl(formUrl: string): boolean;
export declare function navigateToCucasApplication(page: Page, formUrl: string, profile?: StudentProfile, universityId?: string): Promise<void>;
