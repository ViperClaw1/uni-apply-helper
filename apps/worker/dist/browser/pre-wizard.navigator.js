"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreWizardNavigator = void 0;
const common_1 = require("@nestjs/common");
const BLOCKING_DIALOG_BUTTONS = [
    '.messager-button .okButton',
    '.messager-button input[value="Ok"]',
    '.messager-button input[value="OK"]',
    'button:has-text("OK")',
    'button:has-text("Ok")',
    'button:has-text("Continue")',
    'button:has-text("Accept")',
    'input[value="OK"]',
    'input[value="Ok"]',
    'input[value="Continue"]',
    'input[value="Accept"]',
].join(', ');
let PreWizardNavigator = class PreWizardNavigator {
    async navigateToForm(page, fields) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            if (await this.isFormVisible(page, fields)) {
                return;
            }
            const dismissed = await this.dismissBlockingDialogs(page);
            const choseProgram = await this.chooseProgramIfNeeded(page);
            const clickedContinue = await this.clickContinueIfNeeded(page);
            if (!dismissed && !choseProgram && !clickedContinue) {
                break;
            }
            await page.waitForTimeout(600);
        }
    }
    async dismissBlockingDialogs(page) {
        let dismissed = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const button = page.locator(BLOCKING_DIALOG_BUTTONS).first();
            if ((await button.count()) === 0) {
                break;
            }
            await button.click({ force: true }).catch(() => undefined);
            await page.waitForTimeout(400);
            dismissed = true;
        }
        return dismissed;
    }
    async isFormVisible(page, fields) {
        const selectors = fields
            .filter((field) => field.type !== 'file')
            .map((field) => field.selector)
            .slice(0, 8);
        for (const selector of selectors) {
            if ((await page.locator(selector).count()) > 0) {
                return true;
            }
        }
        const bodyText = await page.locator('body').innerText();
        return /save and next|basic info(rmation)?/i.test(bodyText);
    }
    async chooseProgramIfNeeded(page) {
        const bodyText = await page.locator('body').innerText();
        if (!/please choose your (program|type)/i.test(bodyText)) {
            return false;
        }
        const option = page
            .locator('.el-radio, .el-radio__label, input[type="radio"]')
            .first();
        if ((await option.count()) > 0) {
            await option.click({ force: true });
        }
        await page.waitForTimeout(400);
        const nextButton = page.getByRole('button', { name: /^Next$/i }).first();
        if ((await nextButton.count()) > 0) {
            await nextButton.click({ force: true });
            await page
                .waitForLoadState('networkidle', { timeout: 30_000 })
                .catch(() => undefined);
            return true;
        }
        const fallback = page
            .locator('button:has-text("Next"), input[value="Next"]')
            .first();
        if ((await fallback.count()) > 0) {
            await fallback.click({ force: true });
            return true;
        }
        return false;
    }
    async clickContinueIfNeeded(page) {
        const continueButton = page
            .getByRole('button', { name: /^(Continue|Accept|Agree)$/i })
            .first();
        if ((await continueButton.count()) === 0) {
            return false;
        }
        await continueButton.click({ force: true });
        await page
            .waitForLoadState('networkidle', { timeout: 30_000 })
            .catch(() => undefined);
        return true;
    }
};
exports.PreWizardNavigator = PreWizardNavigator;
exports.PreWizardNavigator = PreWizardNavigator = __decorate([
    (0, common_1.Injectable)()
], PreWizardNavigator);
//# sourceMappingURL=pre-wizard.navigator.js.map