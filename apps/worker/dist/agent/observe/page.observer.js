"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageObserver = void 0;
const common_1 = require("@nestjs/common");
let PageObserver = class PageObserver {
    async observe(page, options = {}) {
        const accessibilityTree = await this.capturePageStructure(page);
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const observation = {
            url: page.url(),
            title: await page.title().catch(() => ''),
            accessibilityTree,
            visibleText: truncateVisibleText(bodyText),
        };
        if (options.includeScreenshot) {
            const screenshot = await page
                .screenshot({ type: 'jpeg', quality: 55, fullPage: false })
                .catch(() => undefined);
            if (screenshot) {
                observation.screenshotBase64 = screenshot.toString('base64');
            }
        }
        return observation;
    }
    async waitForStable(page) {
        await page
            .waitForLoadState('networkidle', { timeout: 10_000 })
            .catch(() => undefined);
        await page.waitForTimeout(400);
    }
    async capturePageStructure(page) {
        return page.evaluate(() => {
            const lines = [];
            const elements = document.querySelectorAll('input, select, textarea, button, a, [role]');
            elements.forEach((element) => {
                const tag = element.tagName.toLowerCase();
                const role = element.getAttribute('role') ?? tag;
                const input = element;
                const label = element.getAttribute('aria-label') ??
                    element.getAttribute('name') ??
                    element.getAttribute('placeholder') ??
                    input.labels?.[0]?.textContent ??
                    element.textContent;
                if (!label?.trim()) {
                    return;
                }
                lines.push(`[${role}] name="${label.trim().slice(0, 120)}"`);
            });
            return lines.join('\n');
        });
    }
};
exports.PageObserver = PageObserver;
exports.PageObserver = PageObserver = __decorate([
    (0, common_1.Injectable)()
], PageObserver);
function truncateVisibleText(text, maxLength = 4_000) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length <= maxLength
        ? normalized
        : `${normalized.slice(0, maxLength)}…`;
}
//# sourceMappingURL=page.observer.js.map