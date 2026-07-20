import type { AgentAction, AgentActionTarget } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
export declare class ActionExecutor {
    execute(page: Page, action: AgentAction): Promise<void>;
    resolveLocator(page: Page, target?: AgentActionTarget): Locator;
}
