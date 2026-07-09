import { Injectable } from '@nestjs/common';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class OpenFormStep implements ApplicationPipelineStep {
  readonly name = 'open_form';

  async execute(context: ApplicationStepContext): Promise<void> {
    await context.page.goto(context.university.formUrl, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
  }
}

