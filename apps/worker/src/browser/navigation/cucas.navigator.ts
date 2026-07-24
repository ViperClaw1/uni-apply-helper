import { Injectable } from '@nestjs/common';
import { navigateToCucasApplication, isCucasChiwestUrl } from '../cucas-navigation.js';
import type {
  UniversityNavigationContext,
  UniversityNavigator,
} from './university-navigator.js';

@Injectable()
export class CucasNavigator implements UniversityNavigator {
  matches(formUrl: string): boolean {
    return isCucasChiwestUrl(formUrl);
  }

  async navigate(context: UniversityNavigationContext): Promise<void> {
    await navigateToCucasApplication(
      context.page,
      context.university.formUrl,
      context.profile,
      context.universityId,
    );
  }
}
