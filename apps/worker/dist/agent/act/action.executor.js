"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionExecutor = void 0;
const common_1 = require("@nestjs/common");
let ActionExecutor = class ActionExecutor {
    async execute(page, action) {
        switch (action.type) {
            case 'fill':
                await this.resolveLocator(page, action.target).fill(action.value ?? '');
                return;
            case 'select':
                await this.resolveLocator(page, action.target)
                    .selectOption({ label: action.value ?? '' })
                    .catch(async () => {
                    await this.resolveLocator(page, action.target).selectOption(action.value ?? '');
                });
                return;
            case 'check':
                await this.resolveLocator(page, action.target).check();
                return;
            case 'click':
                await this.resolveLocator(page, action.target).click({ force: true });
                return;
            case 'upload':
                throw new Error('upload action is not implemented in scaffold yet');
            case 'wait':
                await page.waitForTimeout(Number(action.value ?? 1_000));
                return;
            case 'done':
            case 'fail':
                return;
            default:
                throw new Error(`Unsupported agent action: ${action.type}`);
        }
    }
    resolveLocator(page, target) {
        if (!target) {
            throw new Error('Agent action target is required.');
        }
        if (target.selector) {
            return page.locator(target.selector).first();
        }
        if (target.label) {
            return page.getByLabel(target.label, { exact: false }).first();
        }
        if (target.placeholder) {
            return page.getByPlaceholder(target.placeholder, { exact: false }).first();
        }
        if (target.role && target.name) {
            return page
                .getByRole(target.role, {
                name: target.name,
                exact: false,
            })
                .first();
        }
        if (target.name) {
            return page.getByText(target.name, { exact: false }).first();
        }
        throw new Error('Could not resolve locator from agent target.');
    }
};
exports.ActionExecutor = ActionExecutor;
exports.ActionExecutor = ActionExecutor = __decorate([
    (0, common_1.Injectable)()
], ActionExecutor);
//# sourceMappingURL=action.executor.js.map