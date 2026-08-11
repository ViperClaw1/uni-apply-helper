import type { Page } from 'playwright';
export declare class DialogDismisser {
    dismissIfPresent(page: Page): Promise<void>;
}
