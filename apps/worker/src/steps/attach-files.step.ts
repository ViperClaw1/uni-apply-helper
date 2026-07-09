import { Injectable } from '@nestjs/common';
import { FormFiller } from '../filler/form.filler.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class AttachFilesStep implements ApplicationPipelineStep {
  readonly name = 'attach_files';

  constructor(private readonly formFiller: FormFiller) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    await this.formFiller.attachFiles(
      context.page,
      context.profile,
      context.university.fields,
    );
  }
}

