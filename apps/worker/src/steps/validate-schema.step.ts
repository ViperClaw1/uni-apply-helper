import { Injectable } from '@nestjs/common';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class ValidateSchemaStep implements ApplicationPipelineStep {
  readonly name = 'validate_schema';

  async execute(context: ApplicationStepContext): Promise<void> {
    const missingSelectors: string[] = [];

    for (const field of context.university.fields) {
      const count = await context.page.locator(field.selector).count();

      if (count === 0) {
        missingSelectors.push(field.selector);
      }
    }

    if (missingSelectors.length > 0) {
      throw new Error(`Missing selectors: ${missingSelectors.join(', ')}`);
    }
  }
}

