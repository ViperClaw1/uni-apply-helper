import { Injectable } from '@nestjs/common';
import { assertSessionValid } from '../browser/session.validator.js';
import { NavigationRegistry } from '../browser/navigation/navigation-registry.service.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class OpenFormStep implements ApplicationPipelineStep {
  readonly name = 'open_form';

  constructor(private readonly navigationRegistry: NavigationRegistry) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    const navigator = this.navigationRegistry.resolve(context.university.formUrl);
    await navigator.navigate(context);
    await assertSessionValid(context.page, context.university);
  }
}
