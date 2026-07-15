import { Injectable } from '@nestjs/common';
import { navigateToZzuApplication } from '../browser/zzu-navigation.js';
import {
  isCsrfBlocked,
  isLoginPage,
  isZzuFormUrl,
} from '../browser/zzu-session.loader.js';
import { SessionExpiredError } from '../errors/session-expired.error.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

@Injectable()
export class OpenFormStep implements ApplicationPipelineStep {
  readonly name = 'open_form';

  async execute(context: ApplicationStepContext): Promise<void> {
    if (isZzuFormUrl(context.university.formUrl)) {
      await navigateToZzuApplication(context.page, context.university.formUrl);
    } else {
      await context.page.goto(context.university.formUrl, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });
    }

    if (await isLoginPage(context.page)) {
      throw new SessionExpiredError(
        'Redirected to login page — ZZU session expired, re-run capture-zzu-session and update ZZU_SESSION_STATE_B64',
      );
    }

    if (await isCsrfBlocked(context.page)) {
      throw new SessionExpiredError(
        'CSRF protection triggered — re-capture ZZU session in headed browser and update ZZU_SESSION_STATE_B64',
      );
    }
  }
}

