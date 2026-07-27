import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class FileAttacher {
    private readonly logger;
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
    private extractAttachTypeId;
    private fileNameFor;
    private attachViaAddDocument;
    private clickAddDocumentAndSetFiles;
}
