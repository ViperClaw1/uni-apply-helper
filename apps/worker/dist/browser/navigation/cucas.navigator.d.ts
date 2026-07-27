import type { UniversityNavigationContext, UniversityNavigator } from './university-navigator.js';
export declare class CucasNavigator implements UniversityNavigator {
    matches(formUrl: string): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
