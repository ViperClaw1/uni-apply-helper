import type { UniversityNavigationContext, UniversityNavigator } from './university-navigator.js';
export declare class SduNavigator implements UniversityNavigator {
    matches(formUrl: string): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
