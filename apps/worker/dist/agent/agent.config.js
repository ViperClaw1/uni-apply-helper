"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFillMode = resolveFillMode;
exports.resolveMaxAgentSteps = resolveMaxAgentSteps;
exports.shouldUseVision = shouldUseVision;
const FILL_MODES = ['schema', 'agent', 'hybrid'];
function resolveFillMode(configService, university) {
    const envMode = configService.get('FORM_FILL_MODE');
    if (envMode && FILL_MODES.includes(envMode)) {
        return envMode;
    }
    return university.agent?.fillMode ?? 'schema';
}
function resolveMaxAgentSteps(configService, university, fallback = 40) {
    const envValue = Number(configService.get('AGENT_MAX_STEPS'));
    if (Number.isFinite(envValue) && envValue > 0) {
        return envValue;
    }
    return university.agent?.maxSteps ?? fallback;
}
function shouldUseVision(configService, university) {
    if (configService.get('AGENT_USE_VISION') === '1') {
        return true;
    }
    return university.agent?.useVision ?? false;
}
//# sourceMappingURL=agent.config.js.map