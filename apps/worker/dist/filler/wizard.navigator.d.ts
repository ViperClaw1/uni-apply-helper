import type { WizardConfig } from '@uni-apply/shared';
import type { Page } from 'playwright';
export declare class WizardNavigator {
    forEachStep(page: Page, wizard: WizardConfig, handler: (step: number) => Promise<void>): Promise<void>;
    clickNext(page: Page, selector: string): Promise<void>;
    clickSubmit(page: Page, selector: string): Promise<void>;
}
