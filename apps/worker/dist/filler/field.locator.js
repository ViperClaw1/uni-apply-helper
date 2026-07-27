"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFieldLocator = resolveFieldLocator;
async function resolveFieldLocator(page, field) {
    const matches = page.locator(field.selector);
    const count = await matches.count();
    if (count > 0) {
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
//# sourceMappingURL=field.locator.js.map