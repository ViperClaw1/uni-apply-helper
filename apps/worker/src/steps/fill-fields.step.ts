import { Injectable } from '@nestjs/common';
import { FormFiller } from '../filler/form.filler.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class FillFieldsStep implements ApplicationPipelineStep {
  readonly name = 'fill_fields';

  constructor(private readonly formFiller: FormFiller) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    await this.formFiller.fillFields(
      context.page,
      context.profile,
      context.university.fields,
      context.motivationLetterContent,
    );
  }
}

