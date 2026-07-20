import { Injectable } from '@nestjs/common';
import { navigateToSduApplication, isSduFormUrl } from '../sdu-navigation.js';
import type {
  UniversityNavigationContext,
  UniversityNavigator,
} from './university-navigator.js';

@Injectable()
export class SduNavigator implements UniversityNavigator {
  matches(formUrl: string): boolean {
    return isSduFormUrl(formUrl);
  }

  async navigate(context: UniversityNavigationContext): Promise<void> {
    await navigateToSduApplication(
      context.page,
      context.university.formUrl,
      context.profile,
      context.universityId,
    );
  }
}
