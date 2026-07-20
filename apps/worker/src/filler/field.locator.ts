import type { FieldConfig } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';

export async function resolveFieldLocator(
  page: Page,
  field: FieldConfig,
): Promise<Locator | null> {
  const cssLocator = page.locator(field.selector).first();
  if ((await cssLocator.count()) > 0) {
    return cssLocator;
  }

  if (field.labelHint) {
    const byLabel = page.getByLabel(field.labelHint, { exact: false }).first();
    if ((await byLabel.count()) > 0) {
      return byLabel;
    }

    const byPlaceholder = page
      .getByPlaceholder(field.labelHint, { exact: false })
      .first();
    if ((await byPlaceholder.count()) > 0) {
      return byPlaceholder;
    }
  }

  return null;
}
