import type { FieldConfig } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
export declare function resolveFieldLocator(page: Page, field: FieldConfig): Promise<Locator | null>;
