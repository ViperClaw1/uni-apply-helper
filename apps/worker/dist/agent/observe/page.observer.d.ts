import type { AgentObservation } from '@uni-apply/shared';
import type { Page } from 'playwright';
type ObserveOptions = {
    includeScreenshot?: boolean;
};
export declare class PageObserver {
    observe(page: Page, options?: ObserveOptions): Promise<AgentObservation>;
    waitForStable(page: Page): Promise<void>;
    private capturePageStructure;
}
export {};
