import type { Page } from 'playwright';
export type PreWizardScreen = 'application_notes' | 'program_type' | 'student_type' | 'program_selection';
export type PreWizardHints = {
    programText?: string;
    studentType?: string;
    studyPlanHint?: string;
};
export type StudyPlanMatcher = {
    isAvailable: () => boolean;
    generateJson: <T>(options: {
        prompt: string;
        temperature?: number;
    }) => Promise<T>;
};
export declare function waitForUiReady(page: Page): Promise<void>;
export declare function dismissBlockingDialogs(page: Page): Promise<void>;
export declare function detectPreWizardScreen(page: Page): Promise<PreWizardScreen | null>;
export declare function detectCurrentWizardStep(page: Page): Promise<number | null>;
export declare function isMainWizard(page: Page): Promise<boolean>;
export declare function getLastStudentTypePickDiag(): Record<string, unknown> | null;
export declare function fillPreWizardScreen(page: Page, screen: PreWizardScreen, hints?: string | PreWizardHints): Promise<boolean>;
export declare function advancePreWizardScreen(page: Page, screen?: PreWizardScreen | null, hints?: string | PreWizardHints, gemini?: StudyPlanMatcher): Promise<boolean>;
export declare function clearStuckProcessing(page: Page): Promise<boolean>;
export declare function advanceThroughPreWizard(page: Page, hints?: string | PreWizardHints, { maxSteps, deadlineMs, gemini, }?: {
    maxSteps?: number;
    deadlineMs?: number;
    gemini?: StudyPlanMatcher;
}): Promise<boolean>;
export declare function describeNavigationState(page: Page): Promise<string>;
