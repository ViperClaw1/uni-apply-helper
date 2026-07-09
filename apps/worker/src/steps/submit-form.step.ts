import { Injectable } from '@nestjs/common';
import { FormFiller } from '../filler/form.filler.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class SubmitFormStep implements ApplicationPipelineStep {
  readonly name = 'submit_form';

  constructor(private readonly formFiller: FormFiller) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    await this.formFiller.submit(context.page);
  }
}

