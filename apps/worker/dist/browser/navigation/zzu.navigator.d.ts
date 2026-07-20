import type { UniversityNavigationContext, UniversityNavigator } from './university-navigator.js';
export declare class ZzuNavigator implements UniversityNavigator {
    matches(formUrl: string): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
