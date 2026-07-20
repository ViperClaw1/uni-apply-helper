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
const page_observer_js_1 = require("./observe/page.observer.js");
const agent_planner_js_1 = require("./think/agent.planner.js");
let FormAgent = FormAgent_1 = class FormAgent {
    configService;
    observer;
    planner;
    executor;
    logger = new common_1.Logger(FormAgent_1.name);
    constructor(configService, observer, planner, executor) {
        this.configService = configService;
        this.observer = observer;
        this.planner = planner;
        this.executor = executor;
    }
    isAvailable() {
        return this.planner.isAvailable();
    }
    async runWizard(page, profile, university, motivationLetterContent) {
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
        for (let step = 1; step <= wizard.totalSteps; step += 1) {
            const stepFields = (0, shared_1.fieldsForStep)(university, step);
            const result = await this.runLoop({
                page,
                profile,
                university,
                motivationLetterContent,
                goal: `Complete wizard step ${step}/${wizard.totalSteps} for ${university.displayName}`,
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
            const observation = await this.observer.observe(options.page, {
                includeScreenshot: useVision,
            });
            const context = {
                goal: options.goal,
                universityName: options.university.displayName,
                pendingFields: options.pendingFields ??
                    this.buildFieldHints(options.university.fields, options.profile, options.motivationLetterContent),
                previousActions,
            };
            const decision = await this.planner.decideNextAction(observation, context, useVision || decisionNeedsVision(previousActions));
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown executor error';
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
    buildFieldHints(fields, profile, motivationLetterContent) {
        const hints = [];
        for (const field of fields) {
            const value = (0, shared_1.getFieldValue)(profile, field, motivationLetterContent);
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
};
exports.FormAgent = FormAgent;
exports.FormAgent = FormAgent = FormAgent_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        page_observer_js_1.PageObserver,
        agent_planner_js_1.AgentPlanner,
        action_executor_js_1.ActionExecutor])
], FormAgent);
function decisionNeedsVision(previousActions) {
    const recentFailures = previousActions.slice(-3);
    return recentFailures.length === 3 && recentFailures.every((action) => action.type === 'fail');
}
//# sourceMappingURL=form.agent.js.map