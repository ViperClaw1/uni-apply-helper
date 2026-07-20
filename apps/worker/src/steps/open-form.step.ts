import { Injectable } from '@nestjs/common';
import { navigateToZzuApplication } from '../browser/zzu-navigation.js';
import { PreWizardNavigator } from '../browser/pre-wizard.navigator.js';
import { assertSessionValid } from '../browser/session.validator.js';
import { isZzuFormUrl } from '../browser/zzu-session.loader.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class OpenFormStep implements ApplicationPipelineStep {
  readonly name = 'open_form';

  constructor(private readonly preWizardNavigator: PreWizardNavigator) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    if (isZzuFormUrl(context.university.formUrl)) {
      await navigateToZzuApplication(context.page, context.university.formUrl);
    } else {
      await context.page.goto(context.university.formUrl, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });
      await this.preWizardNavigator.navigateToForm(
        context.page,
        context.university.fields,
      );
    }

    await assertSessionValid(context.page, context.university);
  }
}
