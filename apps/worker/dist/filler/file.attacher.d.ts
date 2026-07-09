import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class FileAttacher {
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
}
