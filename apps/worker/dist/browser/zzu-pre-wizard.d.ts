import type { Page } from 'playwright';
export type PreWizardScreen = 'application_notes' | 'program_type' | 'student_type' | 'program_selection';
export declare function waitForUiReady(page: Page): Promise<void>;
export declare function dismissBlockingDialogs(page: Page): Promise<void>;
export declare function detectPreWizardScreen(page: Page): Promise<PreWizardScreen | null>;
export declare function isMainWizard(page: Page): Promise<boolean>;
export declare function fillPreWizardScreen(page: Page, screen: PreWizardScreen, programHint?: string): Promise<boolean>;
export declare function advancePreWizardScreen(page: Page, screen?: PreWizardScreen | null, programHint?: string): Promise<boolean>;
export declare function clearStuckProcessing(page: Page): Promise<boolean>;
export declare function advanceThroughPreWizard(page: Page, programHint?: string, { maxSteps }?: {
    maxSteps?: number | undefined;
}): Promise<boolean>;
export declare function describeNavigationState(page: Page): Promise<string>;
