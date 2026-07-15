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
        const next = page.locator(selector).first();
        await next.waitFor({ state: 'visible', timeout: 15_000 });
        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
            next.click(),
        ]);
        await page.waitForTimeout(500);
    }
    async clickSubmit(page, selector) {
        const submit = page.locator(selector).first();
        await submit.waitFor({ state: 'visible', timeout: 15_000 });
        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
            submit.click(),
        ]);
    }
};
exports.WizardNavigator = WizardNavigator;
exports.WizardNavigator = WizardNavigator = __decorate([
    (0, common_1.Injectable)()
], WizardNavigator);
//# sourceMappingURL=wizard.navigator.js.map