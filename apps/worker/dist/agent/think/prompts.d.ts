import type { AgentContext, AgentObservation } from '@uni-apply/shared';
export declare function buildPlannerPrompt(observation: AgentObservation, context: AgentContext): string;
export declare function buildFieldMappingPrompt(observation: AgentObservation, field: {
    label: string;
    type: string;
    value: string;
    selector?: string;
    labelHint?: string;
}): string;
