import type { AgentAction, AgentActionTarget } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
export declare class ActionExecutor {
    private readonly logger;
    execute(page: Page, action: AgentAction): Promise<void>;
    private isForbiddenWizardBackNav;
    private fillValue;
    private closeDatePickers;
    private executeUpload;
    private resolveFilePayload;
    resolveLocator(page: Page, target?: AgentActionTarget): Locator;
}
