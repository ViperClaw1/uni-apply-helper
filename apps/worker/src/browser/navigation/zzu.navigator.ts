import { Injectable } from '@nestjs/common';
import { navigateToZzuApplication } from '../zzu-navigation.js';
import { isZzuFormUrl } from '../zzu-session.loader.js';
import type {
  UniversityNavigationContext,
  UniversityNavigator,
} from './university-navigator.js';

@Injectable()
export class ZzuNavigator implements UniversityNavigator {
  matches(formUrl: string): boolean {
    return isZzuFormUrl(formUrl);
  }

  async navigate(context: UniversityNavigationContext): Promise<void> {
    await navigateToZzuApplication(
      context.page,
      context.university.formUrl,
      context.profile,
      context.universityId,
    );
  }
}
