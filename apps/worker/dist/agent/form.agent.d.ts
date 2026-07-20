import { ConfigService } from '@nestjs/config';
import { type AgentFieldHint, type AgentLoopResult, type StudentProfile, type UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { ActionExecutor } from './act/action.executor.js';
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
    private readonly logger;
    constructor(configService: ConfigService, observer: PageObserver, planner: AgentPlanner, executor: ActionExecutor);
    isAvailable(): boolean;
    runWizard(page: Page, profile: StudentProfile, university: UniversitySchema, motivationLetterContent?: string): Promise<AgentLoopResult>;
    runLoop(options: RunLoopOptions): Promise<AgentLoopResult>;
    private buildFieldHints;
}
export {};
