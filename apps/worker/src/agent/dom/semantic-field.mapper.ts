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
    const label = field.labelHint ?? field.mapsTo ?? field.selector;

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
