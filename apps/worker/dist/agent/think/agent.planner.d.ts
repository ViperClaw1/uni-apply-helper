import type { AgentContext, AgentDecision, AgentObservation } from '@uni-apply/shared';
import { GeminiClient } from '../gemini/gemini.client.js';
export declare class AgentPlanner {
    private readonly gemini;
    private readonly logger;
    constructor(gemini: GeminiClient);
    isAvailable(): boolean;
    decideNextAction(observation: AgentObservation, context: AgentContext, useVision?: boolean): Promise<AgentDecision>;
    mapFieldTarget(observation: AgentObservation, field: {
        label: string;
        type: string;
        value: string;
        selector?: string;
        labelHint?: string;
    }): Promise<AgentDecision['action']['target']>;
}
