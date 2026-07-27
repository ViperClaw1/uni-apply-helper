import { Injectable, Logger } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { getFieldValue } from '@uni-apply/shared';
import { ActionExecutor } from '../act/action.executor.js';
import { AgentPlanner } from '../think/agent.planner.js';
import { PageObserver } from '../observe/page.observer.js';

@Injectable()
export class SemanticFieldMapper {
  private readonly logger = new Logger(SemanticFieldMapper.name);

  constructor(
    private readonly planner: AgentPlanner,
    private readonly executor: ActionExecutor,
    private readonly observer: PageObserver,
  ) {}

  isAvailable(): boolean {
    return this.planner.isAvailable();
  }

  /**
   * When lexical select matching fails, ask Gemini which option best matches
   * the desired value semantically (e.g. "High school diploma" → "Senior high").
   */
  async semanticSelectMatch(options: {
    desiredValue: string;
    candidates: string[];
    selectOptions: Array<{ value: string; label: string }>;
    fieldLabel?: string;
  }): Promise<{ value: string; label: string } | null> {
    if (!this.isAvailable() || options.selectOptions.length === 0) {
      return null;
    }

    try {
      const response = await this.planner.generateJson<{
        value?: string;
        label?: string;
        confidence?: number;
      }>({
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

      const matched = options.selectOptions.find(
        (o) =>
          (response.value && o.value === response.value) ||
          (response.label &&
            o.label.trim().toLowerCase() === response.label.trim().toLowerCase()),
      );

      if (!matched || (response.confidence ?? 0) < 0.4) {
        this.logger.warn(
          `Semantic select match rejected for "${options.desiredValue}"` +
            ` (confidence=${response.confidence ?? 'n/a'})`,
        );
        return null;
      }

      this.logger.log(
        `Semantic select: "${options.desiredValue}" → "${matched.label}"` +
          ` (confidence=${response.confidence})`,
      );
      return matched;
    } catch (error) {
      this.logger.warn(
        `Semantic select match failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  async resolveLocator(
    page: Page,
    field: FieldConfig,
    profile: StudentProfile,
    motivationLetterContent?: string,
  ): Promise<Locator | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const value = getFieldValue(profile, field, motivationLetterContent);
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
    } catch (error) {
      this.logger.warn(
        `Semantic mapping failed for "${label}": ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
