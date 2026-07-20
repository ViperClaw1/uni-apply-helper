import { Injectable, Logger } from '@nestjs/common';
import type {
  AgentContext,
  AgentDecision,
  AgentObservation,
} from '@uni-apply/shared';
import { GeminiClient } from '../gemini/gemini.client.js';
import { buildFieldMappingPrompt, buildPlannerPrompt } from './prompts.js';

@Injectable()
export class AgentPlanner {
  private readonly logger = new Logger(AgentPlanner.name);

  constructor(private readonly gemini: GeminiClient) {}

  isAvailable(): boolean {
    return this.gemini.isAvailable();
  }

  async decideNextAction(
    observation: AgentObservation,
    context: AgentContext,
    useVision = false,
  ): Promise<AgentDecision> {
    const prompt = buildPlannerPrompt(observation, context);

    const decision = await this.gemini.generateJson<AgentDecision>({
      prompt,
      screenshotBase64: useVision ? observation.screenshotBase64 : undefined,
    });

    return normalizeDecision(decision);
  }

  async mapFieldTarget(
    observation: AgentObservation,
    field: {
      label: string;
      type: string;
      value: string;
      selector?: string;
      labelHint?: string;
    },
  ): Promise<AgentDecision['action']['target']> {
    const response = await this.gemini.generateJson<{
      target?: AgentDecision['action']['target'];
      confidence?: number;
    }>({
      prompt: buildFieldMappingPrompt(observation, field),
    });

    if (!response.target) {
      throw new Error(`Gemini could not map field "${field.label}".`);
    }

    this.logger.debug(
      `Mapped field "${field.label}" with confidence ${response.confidence ?? 'n/a'}`,
    );

    return response.target;
  }
}

function normalizeDecision(decision: AgentDecision): AgentDecision {
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
