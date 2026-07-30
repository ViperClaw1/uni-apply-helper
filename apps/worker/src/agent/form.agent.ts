import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fieldsForStep,
  getFieldValue,
  type AgentAction,
  type AgentContext,
  type AgentFieldHint,
  type AgentLoopResult,
  type AgentStepResult,
  type FieldConfig,
  type StudentProfile,
  type UniversitySchema,
  primaryEducation,
} from '@uni-apply/shared';
import type { Page } from 'playwright';
import { resolveMaxAgentSteps, shouldUseVision } from './agent.config.js';
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

@Injectable()
export class FormAgent {
  private readonly logger = new Logger(FormAgent.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly observer: PageObserver,
    private readonly planner: AgentPlanner,
    private readonly executor: ActionExecutor,
    private readonly dialogDismisser: DialogDismisser,
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
    const steps: AgentStepResult[] = [];

    for (let index = 0; index < maxSteps; index += 1) {
      await this.dialogDismisser.dismissIfPresent(options.page);

      const forceVision =
        useVision ||
        (decisionNeedsVision(steps) &&
          Boolean(this.configService.get<string>('GEMINI_API_KEY')?.trim()));

      const observation = await this.observer.observe(options.page, {
        includeScreenshot: forceVision,
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
        forceVision,
      );

      const action = decision.action;

      if (action.type === 'done') {
        previousActions.push(action);
        steps.push({ action, success: true });
        return { completed: true, steps, finalAction: action };
      }

      if (action.type === 'fail') {
        previousActions.push(action);
        steps.push({ action, success: false, error: action.reason });
        return { completed: false, steps, finalAction: action };
      }

      try {
        await this.executor.execute(options.page, action);
        await this.observer.waitForStable(options.page);
        previousActions.push(action);
        steps.push({ action, success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown executor error';
        this.logger.warn(`Agent action failed: ${message}`);
        const failedAction: AgentAction = {
          ...action,
          reason: `FAILED: ${message}${action.reason ? ` | ${action.reason}` : ''}`,
        };
        previousActions.push(failedAction);
        steps.push({ action: failedAction, success: false, error: message });

        if (action.type !== 'wait') {
          continue;
        }

        return { completed: false, steps, finalAction: failedAction };
      }
    }

    return {
      completed: false,
      steps,
      finalAction: previousActions.at(-1),
    };
  }

  private buildFieldHints(
    fields: FieldConfig[],
    profile: StudentProfile,
    motivationLetterContent?: string,
  ): AgentFieldHint[] {
    if (!fields.length) {
      return this.buildProfileDrivenHints(profile, motivationLetterContent);
    }

    const hints: AgentFieldHint[] = [];

    for (const field of fields) {
      if (field.type === 'file' && field.documentType) {
        const url = profile.documents?.[field.documentType];
        if (!url) {
          continue;
        }
        hints.push({
          mapsTo: field.mapsTo,
          label:
            field.labelHint ??
            field.documentType ??
            field.selector,
          type: 'file',
          value: url,
          required: field.required,
          selector: field.selector,
          labelHint: field.labelHint,
        });
        continue;
      }

      let value = getFieldValue(profile, field, motivationLetterContent);

      // Never feed Yes for mainland-now — unlocks visa/school requireds without data.
      if (
        /inChinaOnApply|beenToChina|chinese mainland now/i.test(
          `${field.selector || ''} ${field.labelHint || ''} ${field.mapsTo || ''}`,
        )
      ) {
        value = 'No';
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      hints.push({
        mapsTo: field.mapsTo,
        label:
          field.labelHint ??
          (Array.isArray(field.mapsTo)
            ? field.mapsTo[0]
            : field.mapsTo) ??
          field.selector,
        type: field.type,
        value: String(value),
        required: field.required,
        selector: field.selector,
        labelHint: field.labelHint,
      });
    }

    // Soft defaults if Yes somehow still on page from a prior save
    hints.push(
      {
        mapsTo: null,
        label: 'Whether in Chinese mainland now?',
        type: 'radio',
        value: 'No',
        required: true,
      },
      {
        mapsTo: null,
        label: 'Visa Type',
        type: 'select',
        value: 'No Visa',
        required: false,
      },
      {
        mapsTo: null,
        label: 'Visa No.',
        type: 'text',
        value: 'N/A',
        required: false,
      },
      {
        mapsTo: null,
        label: 'Visa Expiry Date',
        type: 'text',
        value: profile.personal.passportExpiry || '2030-12-31',
        required: false,
      },
      {
        mapsTo: null,
        label: 'Current School / Organisation',
        type: 'text',
        value: 'N/A',
        required: false,
      },
    );

    return hints;
  }

  /** Zero-schema / empty fields[] — drive agent from StudentProfile alone. */
  private buildProfileDrivenHints(
    profile: StudentProfile,
    motivationLetterContent?: string,
  ): AgentFieldHint[] {
    const hints: AgentFieldHint[] = [];
    const push = (
      label: string,
      type: string,
      value: unknown,
      required = true,
      mapsTo?: string,
    ) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      hints.push({
        mapsTo: mapsTo ?? null,
        label,
        type,
        value: String(value),
        required,
      });
    };

    const p = profile.personal;
    push('Family Name / Surname', 'text', p.surname, true, 'personal.surname');
    push('Given Name', 'text', p.givenName, true, 'personal.givenName');
    push('Chinese Name', 'text', p.chineseName ?? '无', false);
    push('Sex / Gender', 'radio', p.sex ?? 'Female', true, 'personal.sex');
    push(
      'Marital Status',
      'radio',
      p.maritalStatus ?? 'Unmarried',
      true,
      'personal.maritalStatus',
    );
    push('Nationality / Country', 'select', p.nationality, true, 'personal.nationality');
    push('Date of Birth', 'text', p.dateOfBirth, true, 'personal.dateOfBirth');
    push('Passport No', 'text', p.passportNo, true, 'personal.passportNo');
    push(
      'Passport Expiry',
      'text',
      p.passportExpiry,
      true,
      'personal.passportExpiry',
    );
    push('Email', 'text', p.email, true, 'personal.email');
    push('Phone / Mobile', 'text', p.phone, false, 'personal.phone');
    push('Religion', 'select', p.religion ?? 'None', false);
    push(
      'Permanent Address',
      'text',
      p.permanentAddress,
      false,
      'personal.permanentAddress',
    );
    push('Post Code', 'text', p.postCode, false);

    const edu = primaryEducation(profile);
    if (edu) {
      push('School Name / Institution', 'text', edu.institution, true);
      push('Field of Study / Major', 'text', edu.major ?? 'General Studies', false);
      push('Education Level', 'select', edu.degree || 'Senior high', true);
      push('Year Attended From', 'text', edu.periodStart ?? '2018-09-01', true);
      push('Year Attended To', 'text', edu.periodEnd ?? '2022-06-30', true);
    }

    const g = profile.guarantor;
    if (g) {
      push('Recommender / Guarantor Name', 'text', g.name, true);
      push('Relationship with the applicant', 'text', g.relationship, true);
      push('Organization / Workplace', 'text', g.company ?? 'N/A', true);
      push('Guarantor Phone', 'text', g.phone, true);
      push('Guarantor Email', 'text', g.email, true);
      push('Guarantor Address', 'text', g.homeAddress, false);
    }

    if (motivationLetterContent?.trim()) {
      push('Motivation / Personal Statement', 'essay', motivationLetterContent, false);
    }

    for (const [docType, url] of Object.entries(profile.documents ?? {})) {
      if (url) {
        push(`Upload ${docType}`, 'file', url, false);
      }
    }

    // Safe 17gz defaults
    push('Are you Ethnic Chinese?', 'radio', 'No', true);
    push('Whether in Chinese mainland now?', 'radio', 'No', true);
    push('Have you ever studied in China?', 'radio', 'No', true);
    push('Visa Type', 'select', 'No Visa', false);
    push('Visa No.', 'text', 'N/A', false);
    push('Visa Expiry Date', 'text', p.passportExpiry || '2030-12-31', false);
    push('Current School / Organisation', 'text', 'N/A', false);
    push('Chinese Language Proficiency', 'select', 'None', true);
    push('Level of HSK', 'select', 'None', true);
    push('Level of HSKK', 'select', 'None', true);
    push('English Language Proficiency', 'select', 'Good', true);
    push('Certificate of English Proficiency', 'select', 'Native Language', true);
    push('English Certificate Score', 'text', 'N/A', true);
    push('English Certificate Issue Date', 'text', '2020-01-01', true);
    push('Passport Type', 'select', 'Ordinary Passport', false);
    push('Current Employer', 'text', 'High school graduate, no employer', false);

    return hints;
  }
}

function decisionNeedsVision(steps: AgentStepResult[]): boolean {
  const recent = steps.slice(-3);
  return recent.length === 3 && recent.every((step) => !step.success);
}
