import { Injectable } from '@nestjs/common';
import { ScreenshotService } from '../screenshot/screenshot.service.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class LogResultStep implements ApplicationPipelineStep {
  readonly name = 'log_result';

  constructor(private readonly screenshotService: ScreenshotService) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    context.screenshotAfter = await this.screenshotService.capture(
      context.page,
      context.applicationId,
      'after',
    );
  }
}

