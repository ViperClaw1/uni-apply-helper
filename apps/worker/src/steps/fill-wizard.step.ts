import { Injectable } from '@nestjs/common';
import { FormFiller } from '../filler/form.filler.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class FillWizardStep implements ApplicationPipelineStep {
  readonly name = 'fill_wizard';

  constructor(private readonly formFiller: FormFiller) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    await this.formFiller.processWizard(
      context.page,
      context.profile,
      context.university,
      context.motivationLetterContent,
    );
  }
}
