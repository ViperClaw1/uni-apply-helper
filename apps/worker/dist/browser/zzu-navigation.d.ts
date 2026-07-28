import type { Page } from 'playwright';
import type { NavigationHints, StudentProfile } from '@uni-apply/shared';
import { type StudyPlanMatcher } from './zzu-pre-wizard.js';
export declare function navigateToZzuApplication(page: Page, formUrl: string, profile?: StudentProfile, universityId?: string, defaultProgram?: string, navigationHints?: NavigationHints, gemini?: StudyPlanMatcher): Promise<void>;
