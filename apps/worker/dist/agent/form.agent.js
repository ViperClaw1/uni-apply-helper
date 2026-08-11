"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FormAgent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormAgent = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@uni-apply/shared");
const agent_config_js_1 = require("./agent.config.js");
const action_executor_js_1 = require("./act/action.executor.js");
const dialog_dismisser_js_1 = require("./act/dialog.dismisser.js");
const page_observer_js_1 = require("./observe/page.observer.js");
const agent_planner_js_1 = require("./think/agent.planner.js");
let FormAgent = FormAgent_1 = class FormAgent {
    configService;
    observer;
    planner;
    executor;
    dialogDismisser;
    logger = new common_1.Logger(FormAgent_1.name);
    constructor(configService, observer, planner, executor, dialogDismisser) {
        this.configService = configService;
        this.observer = observer;
        this.planner = planner;
        this.executor = executor;
        this.dialogDismisser = dialogDismisser;
    }
    isAvailable() {
        return this.planner.isAvailable();
    }
    async runWizard(page, profile, university, motivationLetterContent, options) {
        const wizard = university.wizard;
        if (!wizard) {
            return this.runLoop({
                page,
                profile,
                university,
                motivationLetterContent,
                goal: university.agent?.goal ??
                    `Fill and submit the application form for ${university.displayName}`,
                pendingFields: this.buildFieldHints(university.fields, profile, motivationLetterContent),
            });
        }
        const allSteps = [];
        const startStep = Math.min(Math.max(options?.startStep ?? 1, 1), wizard.totalSteps);
        for (let step = startStep; step <= wizard.totalSteps; step += 1) {
            const stepFields = (0, shared_1.fieldsForStep)(university, step);
            const result = await this.runLoop({
                page,
                profile,
                university,
                motivationLetterContent,
                goal: `Complete ONLY the CURRENT wizard step ${step}/${wizard.totalSteps} for ${university.displayName}. ` +
                    `You are already on this step — do NOT navigate to earlier steps (Step 1, Basic Info, etc.). ` +
                    `Fill empty/required fields on this step, then click Save and Next.`,
                pendingFields: this.buildFieldHints(stepFields, profile, motivationLetterContent),
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
    async runLoop(options) {
        if (!this.isAvailable()) {
            throw new Error('Gemini agent is not available — set GEMINI_API_KEY.');
        }
        const maxSteps = options.maxSteps ??
            (0, agent_config_js_1.resolveMaxAgentSteps)(this.configService, options.university);
        const useVision = (0, agent_config_js_1.shouldUseVision)(this.configService, options.university);
        const previousActions = [];
        const steps = [];
        for (let index = 0; index < maxSteps; index += 1) {
            await this.dialogDismisser.dismissIfPresent(options.page);
            const forceVision = useVision ||
                (decisionNeedsVision(steps) &&
                    Boolean(this.configService.get('GEMINI_API_KEY')?.trim()));
            const observation = await this.observer.observe(options.page, {
                includeScreenshot: forceVision,
            });
            const context = {
                goal: options.goal,
                universityName: options.university.displayName,
                pendingFields: options.pendingFields ??
                    this.buildFieldHints(options.university.fields, options.profile, options.motivationLetterContent),
                previousActions,
            };
            const decision = await this.planner.decideNextAction(observation, context, forceVision);
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown executor error';
                this.logger.warn(`Agent action failed: ${message}`);
                const failedAction = {
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
    buildFieldHints(fields, profile, motivationLetterContent) {
        if (!fields.length) {
            return this.buildProfileDrivenHints(profile, motivationLetterContent);
        }
        const hints = [];
        for (const field of fields) {
            if (field.type === 'file' && field.documentType) {
                const urls = (0, shared_1.getDocumentUrls)(profile.documents, field.documentType);
                if (urls.length === 0) {
                    continue;
                }
                for (const url of urls) {
                    hints.push({
                        mapsTo: field.mapsTo,
                        label: field.labelHint ??
                            field.documentType ??
                            field.selector,
                        type: 'file',
                        value: url,
                        required: field.required,
                        selector: field.selector,
                        labelHint: field.labelHint,
                    });
                }
                continue;
            }
            let value = (0, shared_1.getFieldValue)(profile, field, motivationLetterContent);
            if (/inChinaOnApply|beenToChina|chinese mainland now/i.test(`${field.selector || ''} ${field.labelHint || ''} ${field.mapsTo || ''}`)) {
                value = 'No';
            }
            if (value === undefined || value === null || value === '') {
                continue;
            }
            hints.push({
                mapsTo: field.mapsTo,
                label: field.labelHint ??
                    (Array.isArray(field.mapsTo)
                        ? field.mapsTo[0]
                        : field.mapsTo) ??
                    field.selector,
                type: field.type,
                value: normalizeHintDate(String(value)),
                required: field.required,
                selector: field.selector,
                labelHint: field.labelHint,
            });
        }
        hints.push({
            mapsTo: null,
            label: 'Whether in Chinese mainland now?',
            type: 'radio',
            value: 'No',
            required: true,
        }, {
            mapsTo: null,
            label: 'Visa Type',
            type: 'select',
            value: 'No Visa',
            required: false,
        }, {
            mapsTo: null,
            label: 'Visa No.',
            type: 'text',
            value: 'N/A',
            required: false,
        }, {
            mapsTo: null,
            label: 'Visa Expiry Date',
            type: 'text',
            value: profile.personal.passportExpiry || '2030-12-31',
            required: false,
        }, {
            mapsTo: null,
            label: 'Current School / Organisation',
            type: 'text',
            value: 'N/A',
            required: false,
        });
        return hints;
    }
    buildProfileDrivenHints(profile, motivationLetterContent) {
        const hints = [];
        const push = (label, type, value, required = true, mapsTo) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            hints.push({
                mapsTo: mapsTo ?? null,
                label,
                type,
                value: normalizeHintDate(String(value)),
                required,
            });
        };
        const p = profile.personal;
        push('Family Name / Surname', 'text', p.surname, true, 'personal.surname');
        push('Given Name', 'text', p.givenName, true, 'personal.givenName');
        push('Chinese Name', 'text', p.chineseName ?? '无', false);
        push('Sex / Gender', 'radio', p.sex ?? 'Female', true, 'personal.sex');
        push('Marital Status', 'radio', p.maritalStatus ?? 'Unmarried', true, 'personal.maritalStatus');
        push('Nationality / Country', 'select', p.nationality, true, 'personal.nationality');
        push('Date of Birth', 'text', p.dateOfBirth, true, 'personal.dateOfBirth');
        push('Passport No', 'text', p.passportNo, true, 'personal.passportNo');
        push('Passport Expiry', 'text', p.passportExpiry, true, 'personal.passportExpiry');
        push('Email', 'text', p.email, true, 'personal.email');
        push('Phone / Mobile', 'text', p.phone, false, 'personal.phone');
        push('Religion', 'select', p.religion ?? 'None', false);
        push('Permanent Address', 'text', p.permanentAddress, false, 'personal.permanentAddress');
        push('Post Code', 'text', p.postCode, false);
        const edu = (0, shared_1.primaryEducation)(profile);
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
        for (const [docType] of Object.entries(profile.documents ?? {})) {
            for (const url of (0, shared_1.getDocumentUrls)(profile.documents, docType)) {
                push(`Upload ${docType}`, 'file', url, false);
            }
        }
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
};
exports.FormAgent = FormAgent;
exports.FormAgent = FormAgent = FormAgent_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        page_observer_js_1.PageObserver,
        agent_planner_js_1.AgentPlanner,
        action_executor_js_1.ActionExecutor,
        dialog_dismisser_js_1.DialogDismisser])
], FormAgent);
function decisionNeedsVision(steps) {
    const recent = steps.slice(-3);
    return recent.length === 3 && recent.every((step) => !step.success);
}
function normalizeHintDate(value) {
    const iso = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    return iso?.[1] ?? value;
}
//# sourceMappingURL=form.agent.js.map