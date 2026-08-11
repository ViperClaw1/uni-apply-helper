import { type StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class OcrPassportUploader {
    private readonly logger;
    upload(page: Page, profile: StudentProfile): Promise<void>;
    private uploadPassportViaButton;
    private waitForOcrReady;
    private confirmPassportOcr;
    private dismissInfoDialogs;
    private closeDatePickers;
    private waitForApplySync;
    private uploadPhoto;
    private readOcrDebugState;
    private formatDebug;
    private waitForVisibleProcessingGone;
    private downloadFile;
}
