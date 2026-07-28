import type { WizardConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { ScreenshotService } from '../screenshot/screenshot.service.js';
export declare class WizardNavigator {
    private readonly screenshotService;
    constructor(screenshotService: ScreenshotService);
    forEachStep(page: Page, wizard: WizardConfig, handler: (step: number) => Promise<void>, options?: {
        markerForStep?: (step: number) => string | undefined;
        applicationId?: string;
    }): Promise<void>;
    clickNext(page: Page, selector: string, nextStepMarker?: string, applicationId?: string, fromStep?: number): Promise<void>;
    private collectValidationHints;
    private getStepSignature;
    private resolveNextButton;
    private dismissBlockingDialogs;
    clickSubmit(page: Page, selector: string): Promise<void>;
    private confirmSubmitDialog;
    private resolveSubmitButton;
    private waitForUiReady;
    waitForProcessingDone(page: Page, timeoutMs?: number): Promise<void>;
    private isProcessingVisible;
    private closeDatePickers;
}
