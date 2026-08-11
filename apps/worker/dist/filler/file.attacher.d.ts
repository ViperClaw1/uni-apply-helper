import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class FileAttacher {
    private readonly logger;
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
    assertRequiredAttachmentsPresent(page: Page): Promise<void>;
    private fetchDocument;
    private waitBrieflyForUploadSettle;
    private extractAttachTypeId;
    private toFilePayload;
    private attachViaAddDocument;
    private resolveAddDocumentButtons;
    private countRowAttachments;
    private rowAlreadyHasAttachment;
    private resolveLiveAttachTypeId;
    private clickAddDocumentAndSetFiles;
    private peekAlreadyUploadedDialog;
    private dismissPostUploadDialogs;
    private dumpAttachDebug;
}
