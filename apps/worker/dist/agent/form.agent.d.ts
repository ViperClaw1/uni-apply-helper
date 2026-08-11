import { ConfigService } from '@nestjs/config';
import { type AgentFieldHint, type AgentLoopResult, type StudentProfile, type UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { ActionExecutor } from './act/action.executor.js';
import { DialogDismisser } from './act/dialog.dismisser.js';
import { PageObserver } from './observe/page.observer.js';
import { AgentPlanner } from './think/agent.planner.js';
type RunLoopOptions = {
    page: Page;
    profile: StudentProfile;
    university: UniversitySchema;
    goal: string;
    pendingFields?: AgentFieldHint[];
    maxSteps?: number;
    motivationLetterContent?: string;
};
export declare class FormAgent {
    private readonly configService;
    private readonly observer;
    private readonly planner;
    private readonly executor;
    private readonly dialogDismisser;
    private readonly logger;
    constructor(configService: ConfigService, observer: PageObserver, planner: AgentPlanner, executor: ActionExecutor, dialogDismisser: DialogDismisser);
    isAvailable(): boolean;
    runWizard(page: Page, profile: StudentProfile, university: UniversitySchema, motivationLetterContent?: string, options?: {
        startStep?: number;
    }): Promise<AgentLoopResult>;
    runLoop(options: RunLoopOptions): Promise<AgentLoopResult>;
    private buildFieldHints;
    private buildProfileDrivenHints;
}
export {};
