"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogDismisser = void 0;
const common_1 = require("@nestjs/common");
let DialogDismisser = class DialogDismisser {
    async dismissIfPresent(page) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const isProcessing = await page
                .evaluate(() => {
                const wins = [
                    ...document.querySelectorAll('.messager-window, .panel.window, .window-mask'),
                ];
                return wins.some((win) => {
                    const style = getComputedStyle(win);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    const rect = win.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return false;
                    }
                    return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(win.textContent || '');
                });
            })
                .catch(() => false);
            if (isProcessing) {
                break;
            }
            const okButton = page
                .locator([
                'input.okButton',
                'input[value="Ok"]',
                'input[value="OK"]',
                '.messager-button .okButton',
                '.messager-button input[value="Ok"]',
                '.messager-button input[value="OK"]',
                '.messager-button a',
                '.messager-window input.okButton',
                'button:has-text("OK")',
                'button:has-text("Ok")',
                'button:has-text("Continue")',
                'button:has-text("Accept")',
                'button:has-text("确定")',
            ].join(', '))
                .first();
            if ((await okButton.count()) === 0) {
                break;
            }
            if (!(await okButton.isVisible().catch(() => false))) {
                break;
            }
            await okButton.click({ force: true }).catch(() => undefined);
            await page.waitForTimeout(300);
        }
    }
};
exports.DialogDismisser = DialogDismisser;
exports.DialogDismisser = DialogDismisser = __decorate([
    (0, common_1.Injectable)()
], DialogDismisser);
//# sourceMappingURL=dialog.dismisser.js.map