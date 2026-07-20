import { Injectable } from '@nestjs/common';
import { PreWizardNavigator } from '../pre-wizard.navigator.js';
import type {
  UniversityNavigationContext,
  UniversityNavigator,
} from './university-navigator.js';

@Injectable()
export class GenericNavigator implements UniversityNavigator {
  constructor(private readonly preWizardNavigator: PreWizardNavigator) {}

  matches(): boolean {
    return true;
  }

  async navigate(context: UniversityNavigationContext): Promise<void> {
    await context.page.goto(context.university.formUrl, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    await this.preWizardNavigator.navigateToForm(
      context.page,
      context.university.fields,
    );
  }
}
