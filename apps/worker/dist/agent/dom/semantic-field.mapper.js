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
var SemanticFieldMapper_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticFieldMapper = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const action_executor_js_1 = require("../act/action.executor.js");
const agent_planner_js_1 = require("../think/agent.planner.js");
const page_observer_js_1 = require("../observe/page.observer.js");
let SemanticFieldMapper = SemanticFieldMapper_1 = class SemanticFieldMapper {
    planner;
    executor;
    observer;
    logger = new common_1.Logger(SemanticFieldMapper_1.name);
    constructor(planner, executor, observer) {
        this.planner = planner;
        this.executor = executor;
        this.observer = observer;
    }
    isAvailable() {
        return this.planner.isAvailable();
    }
    async semanticSelectMatch(options) {
        if (!this.isAvailable() || options.selectOptions.length === 0) {
            return null;
        }
        try {
            const response = await this.planner.generateJson({
                prompt: [
                    'You match a desired form value to the closest option in a <select>.',
                    'Return ONLY JSON: {"value":"<option value>","label":"<option text>","confidence":0-1}',
                    'Pick the semantically closest option. Prefer exact/near-exact meaning over vague matches.',
                    'If nothing is reasonably close, return {"value":"","label":"","confidence":0}.',
                    `Field: ${options.fieldLabel ?? '(unknown)'}`,
                    `Desired value: ${options.desiredValue}`,
                    `Also tried aliases: ${options.candidates.join(' | ')}`,
                    'Available options (value || label):',
                    ...options.selectOptions.map((o) => `- ${o.value} || ${o.label}`),
                ].join('\n'),
                temperature: 0,
            });
            const matched = options.selectOptions.find((o) => (response.value && o.value === response.value) ||
                (response.label &&
                    o.label.trim().toLowerCase() === response.label.trim().toLowerCase()));
            if (!matched || (response.confidence ?? 0) < 0.4) {
                this.logger.warn(`Semantic select match rejected for "${options.desiredValue}"` +
                    ` (confidence=${response.confidence ?? 'n/a'})`);
                return null;
            }
            this.logger.log(`Semantic select: "${options.desiredValue}" → "${matched.label}"` +
                ` (confidence=${response.confidence})`);
            return matched;
        }
        catch (error) {
            this.logger.warn(`Semantic select match failed: ${error instanceof Error ? error.message : 'unknown'}`);
            return null;
        }
    }
    async resolveLocator(page, field, profile, motivationLetterContent) {
        if (!this.isAvailable()) {
            return null;
        }
        const value = (0, shared_1.getFieldValue)(profile, field, motivationLetterContent);
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const observation = await this.observer.observe(page);
        const label = field.labelHint ??
            (Array.isArray(field.mapsTo) ? field.mapsTo[0] : field.mapsTo) ??
            field.selector;
        try {
            const target = await this.planner.mapFieldTarget(observation, {
                label,
                type: field.type,
                value: String(value),
                selector: field.selector,
                labelHint: field.labelHint,
            });
            const locator = this.executor.resolveLocator(page, target);
            if ((await locator.count()) === 0) {
                return null;
            }
            return locator;
        }
        catch (error) {
            this.logger.warn(`Semantic mapping failed for "${label}": ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
};
exports.SemanticFieldMapper = SemanticFieldMapper;
exports.SemanticFieldMapper = SemanticFieldMapper = SemanticFieldMapper_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_planner_js_1.AgentPlanner,
        action_executor_js_1.ActionExecutor,
        page_observer_js_1.PageObserver])
], SemanticFieldMapper);
//# sourceMappingURL=semantic-field.mapper.js.map