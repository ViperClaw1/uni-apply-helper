import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fieldsForStep,
  getFieldValue,
  type AgentAction,
  type AgentContext,
  type AgentFieldHint,
  type AgentLoopResult,
  type StudentProfile,
  type UniversitySchema,
} from '@uni-apply/shared';
import type { Page } from 'playwright';
import { resolveMaxAgentSteps, shouldUseVision } from './agent.config.js';
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

@Injectable()
export class FormAgent {
  private readonly logger = new Logger(FormAgent.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly observer: PageObserver,
    private readonly planner: AgentPlanner,
    private readonly executor: ActionExecutor,
  ) {}

  isAvailable(): boolean {
    return this.planner.isAvailable();
  }

  async runWizard(
    page: Page,
    profile: StudentProfile,
    university: UniversitySchema,
    motivationLetterContent?: string,
  ): Promise<AgentLoopResult> {
    const wizard = university.wizard;

    if (!wizard) {
      return this.runLoop({
        page,
        profile,
        university,
        motivationLetterContent,
        goal:
          university.agent?.goal ??
          `Fill and submit the application form for ${university.displayName}`,
        pendingFields: this.buildFieldHints(
          university.fields,
          profile,
          motivationLetterContent,
        ),
      });
    }

    const allSteps: AgentLoopResult['steps'] = [];

    for (let step = 1; step <= wizard.totalSteps; step += 1) {
      const stepFields = fieldsForStep(university, step);
      const result = await this.runLoop({
        page,
        profile,
        university,
        motivationLetterContent,
        goal: `Complete wizard step ${step}/${wizard.totalSteps} for ${university.displayName}`,
        pendingFields: this.buildFieldHints(
          stepFields,
          profile,
          motivationLetterContent,
        ),
        maxSteps: 20,
      });

      allSteps.push(...result.steps);

      if (!result.completed) {
        return { completed: false, steps: allSteps, finalAction: result.finalAction };
      }

      if (step < wizard.totalSteps) {
        await this.executor.execute(page, {
          type: 'click',
          target: { selector: wizard.nextButtonSelector },
          reason: 'advance wizard step',
        });
        await this.observer.waitForStable(page);
      }
    }

    await this.executor.execute(page, {
      type: 'click',
      target: { selector: wizard.submitButtonSelector },
      reason: 'submit application',
    });
    await this.observer.waitForStable(page);

    return {
      completed: true,
      steps: allSteps,
      finalAction: { type: 'done', reason: 'wizard submitted' },
    };
  }

  async runLoop(options: RunLoopOptions): Promise<AgentLoopResult> {
    if (!this.isAvailable()) {
      throw new Error('Gemini agent is not available — set GEMINI_API_KEY.');
    }

    const maxSteps =
      options.maxSteps ??
      resolveMaxAgentSteps(this.configService, options.university);
    const useVision = shouldUseVision(this.configService, options.university);
    const previousActions: AgentAction[] = [];
    const steps: AgentLoopResult['steps'] = [];

    for (let index = 0; index < maxSteps; index += 1) {
      const observation = await this.observer.observe(options.page, {
        includeScreenshot: useVision,
      });

      const context: AgentContext = {
        goal: options.goal,
        universityName: options.university.displayName,
        pendingFields:
          options.pendingFields ??
          this.buildFieldHints(
            options.university.fields,
            options.profile,
            options.motivationLetterContent,
          ),
        previousActions,
      };

      const decision = await this.planner.decideNextAction(
        observation,
        context,
        useVision || decisionNeedsVision(previousActions),
      );

      const action = decision.action;
      previousActions.push(action);

      if (action.type === 'done') {
        steps.push({ action, success: true });
        return { completed: true, steps, finalAction: action };
      }

      if (action.type === 'fail') {
        steps.push({ action, success: false, error: action.reason });
        return { completed: false, steps, finalAction: action };
      }

      try {
        await this.executor.execute(options.page, action);
        await this.observer.waitForStable(options.page);
        steps.push({ action, success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown executor error';
        this.logger.warn(`Agent action failed: ${message}`);
        steps.push({ action, success: false, error: message });

        if (action.type !== 'wait') {
          continue;
        }

        return { completed: false, steps, finalAction: action };
      }
    }

    return {
      completed: false,
      steps,
      finalAction: previousActions.at(-1),
    };
  }

  private buildFieldHints(
    fields: UniversitySchema['fields'],
    profile: StudentProfile,
    motivationLetterContent?: string,
  ): AgentFieldHint[] {
    const hints: AgentFieldHint[] = [];

    for (const field of fields) {
      const value = getFieldValue(profile, field, motivationLetterContent);
      if (value === undefined || value === null || value === '') {
        continue;
      }

      hints.push({
        mapsTo: field.mapsTo,
        label: field.labelHint ?? field.mapsTo ?? field.selector,
        type: field.type,
        value: String(value),
        required: field.required,
        selector: field.selector,
        labelHint: field.labelHint,
      });
    }

    return hints;
  }
}

function decisionNeedsVision(previousActions: AgentAction[]): boolean {
  const recentFailures = previousActions.slice(-3);
  return recentFailures.length === 3 && recentFailures.every((action) => action.type === 'fail');
}
