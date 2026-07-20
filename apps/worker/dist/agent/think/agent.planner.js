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
var AgentPlanner_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentPlanner = void 0;
const common_1 = require("@nestjs/common");
const gemini_client_js_1 = require("../gemini/gemini.client.js");
const prompts_js_1 = require("./prompts.js");
let AgentPlanner = AgentPlanner_1 = class AgentPlanner {
    gemini;
    logger = new common_1.Logger(AgentPlanner_1.name);
    constructor(gemini) {
        this.gemini = gemini;
    }
    isAvailable() {
        return this.gemini.isAvailable();
    }
    async decideNextAction(observation, context, useVision = false) {
        const prompt = (0, prompts_js_1.buildPlannerPrompt)(observation, context);
        const decision = await this.gemini.generateJson({
            prompt,
            screenshotBase64: useVision ? observation.screenshotBase64 : undefined,
        });
        return normalizeDecision(decision);
    }
    async mapFieldTarget(observation, field) {
        const response = await this.gemini.generateJson({
            prompt: (0, prompts_js_1.buildFieldMappingPrompt)(observation, field),
        });
        if (!response.target) {
            throw new Error(`Gemini could not map field "${field.label}".`);
        }
        this.logger.debug(`Mapped field "${field.label}" with confidence ${response.confidence ?? 'n/a'}`);
        return response.target;
    }
};
exports.AgentPlanner = AgentPlanner;
exports.AgentPlanner = AgentPlanner = AgentPlanner_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_client_js_1.GeminiClient])
], AgentPlanner);
function normalizeDecision(decision) {
    if (!decision?.action?.type) {
        throw new Error('Gemini returned an invalid agent decision.');
    }
    return {
        ...decision,
        action: {
            ...decision.action,
            reason: decision.action.reason ?? 'no reason provided',
        },
    };
}
//# sourceMappingURL=agent.planner.js.map