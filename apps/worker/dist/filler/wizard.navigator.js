"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardNavigator = void 0;
const common_1 = require("@nestjs/common");
let WizardNavigator = class WizardNavigator {
    async forEachStep(page, wizard, handler) {
        for (let step = 1; step <= wizard.totalSteps; step += 1) {
            await handler(step);
            if (step < wizard.totalSteps) {
                await this.clickNext(page, wizard.nextButtonSelector);
            }
        }
    }
    async clickNext(page, selector) {
        await this.waitForUiReady(page);
        await this.dismissBlockingDialogs(page);
        const next = await this.resolveNextButton(page, selector);
        await next.waitFor({ state: 'visible', timeout: 15_000 });
        const onclick = await next.getAttribute('onclick');
        if (onclick) {
            await next.evaluate((btn, handler) => {
                const run = new Function('btn', handler.replace(/\bthis\b/g, 'btn'));
                run(btn);
            }, onclick);
        }
        else {
            await next.click({ force: true });
        }
        await page
            .waitForLoadState('networkidle', { timeout: 30_000 })
            .catch(() => undefined);
        await this.waitForUiReady(page);
        await this.dismissBlockingDialogs(page);
        await page.waitForTimeout(500);
    }
    async resolveNextButton(page, selector) {
        const cssButton = page.locator(selector).first();
        if ((await cssButton.count()) > 0) {
            return cssButton;
        }
        const semanticButton = page
            .getByRole('button', { name: /save and next|next/i })
            .first();
        if ((await semanticButton.count()) > 0) {
            return semanticButton;
        }
        return cssButton;
    }
    async dismissBlockingDialogs(page) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const okButton = page
                .locator([
                '.messager-button .okButton',
                '.messager-button input[value="Ok"]',
                '.messager-button input[value="OK"]',
                'button:has-text("OK")',
                'button:has-text("Continue")',
                'button:has-text("Accept")',
            ].join(', '))
                .first();
            if ((await okButton.count()) === 0) {
                break;
            }
            await okButton.click({ force: true }).catch(() => undefined);
            await page.waitForTimeout(400);
        }
    }
    async clickSubmit(page, selector) {
        await this.waitForUiReady(page);
        const submit = page.locator(selector).first();
        await submit.waitFor({ state: 'visible', timeout: 15_000 });
        await submit.click({ force: true });
        await page
            .waitForLoadState('networkidle', { timeout: 30_000 })
            .catch(() => undefined);
    }
    async waitForUiReady(page) {
        await page
            .locator('.window-mask, .el-loading-mask')
            .first()
            .waitFor({ state: 'hidden', timeout: 20_000 })
            .catch(() => undefined);
    }
};
exports.WizardNavigator = WizardNavigator;
exports.WizardNavigator = WizardNavigator = __decorate([
    (0, common_1.Injectable)()
], WizardNavigator);
//# sourceMappingURL=wizard.navigator.js.map