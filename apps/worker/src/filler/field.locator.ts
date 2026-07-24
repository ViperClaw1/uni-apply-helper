import type { FieldConfig } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';

export async function resolveFieldLocator(
  page: Page,
  field: FieldConfig,
): Promise<Locator | null> {
  const matches = page.locator(field.selector);
  const count = await matches.count();

  if (count > 0) {
    // Prefer a visible twin when CUCAS keeps a hidden date-picker input.
    for (let i = 0; i < count; i += 1) {
      const candidate = matches.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return matches.first();
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
