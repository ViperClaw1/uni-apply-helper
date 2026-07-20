import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
export declare function isSduFormUrl(formUrl: string): boolean;
export declare function navigateToSduApplication(page: Page, formUrl: string, profile?: StudentProfile, universityId?: string): Promise<void>;
