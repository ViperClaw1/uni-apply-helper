import type { ApplicationStepContext } from '../../steps/step-context.js';
export type UniversityNavigationContext = Pick<ApplicationStepContext, 'page' | 'university' | 'universityId' | 'profile'>;
export interface UniversityNavigator {
    matches(formUrl: string): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
