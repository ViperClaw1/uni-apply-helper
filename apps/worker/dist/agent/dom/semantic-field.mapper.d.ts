import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { ActionExecutor } from '../act/action.executor.js';
import { AgentPlanner } from '../think/agent.planner.js';
import { PageObserver } from '../observe/page.observer.js';
export declare class SemanticFieldMapper {
    private readonly planner;
    private readonly executor;
    private readonly observer;
    private readonly logger;
    constructor(planner: AgentPlanner, executor: ActionExecutor, observer: PageObserver);
    isAvailable(): boolean;
    resolveLocator(page: Page, field: FieldConfig, profile: StudentProfile, motivationLetterContent?: string): Promise<Locator | null>;
}
