import { PreWizardNavigator } from '../pre-wizard.navigator.js';
import type { UniversityNavigationContext, UniversityNavigator } from './university-navigator.js';
export declare class GenericNavigator implements UniversityNavigator {
    private readonly preWizardNavigator;
    constructor(preWizardNavigator: PreWizardNavigator);
    matches(): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
