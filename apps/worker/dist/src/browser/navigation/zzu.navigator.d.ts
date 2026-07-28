import { GeminiClient } from '../../agent/gemini/gemini.client.js';
import type { UniversityNavigationContext, UniversityNavigator } from './university-navigator.js';
export declare class ZzuNavigator implements UniversityNavigator {
    private readonly gemini;
    constructor(gemini: GeminiClient);
    matches(formUrl: string): boolean;
    navigate(context: UniversityNavigationContext): Promise<void>;
}
