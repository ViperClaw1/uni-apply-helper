import type { FieldConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class PreWizardNavigator {
    navigateToForm(page: Page, fields: FieldConfig[]): Promise<void>;
    dismissBlockingDialogs(page: Page): Promise<boolean>;
    private isFormVisible;
    private chooseProgramIfNeeded;
    private clickContinueIfNeeded;
}
