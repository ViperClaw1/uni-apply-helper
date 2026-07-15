"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenFormStep = void 0;
const common_1 = require("@nestjs/common");
const zzu_navigation_js_1 = require("../browser/zzu-navigation.js");
const zzu_session_loader_js_1 = require("../browser/zzu-session.loader.js");
const session_expired_error_js_1 = require("../errors/session-expired.error.js");
let OpenFormStep = class OpenFormStep {
    name = 'open_form';
    async execute(context) {
        if ((0, zzu_session_loader_js_1.isZzuFormUrl)(context.university.formUrl)) {
            await (0, zzu_navigation_js_1.navigateToZzuApplication)(context.page, context.university.formUrl);
        }
        else {
            await context.page.goto(context.university.formUrl, {
                waitUntil: 'networkidle',
                timeout: 60_000,
            });
        }
        if (await (0, zzu_session_loader_js_1.isLoginPage)(context.page)) {
            throw new session_expired_error_js_1.SessionExpiredError('Redirected to login page — ZZU session expired, re-run capture-zzu-session and update ZZU_SESSION_STATE_B64');
        }
        if (await (0, zzu_session_loader_js_1.isCsrfBlocked)(context.page)) {
            throw new session_expired_error_js_1.SessionExpiredError('CSRF protection triggered — re-capture ZZU session in headed browser and update ZZU_SESSION_STATE_B64');
        }
    }
};
exports.OpenFormStep = OpenFormStep;
exports.OpenFormStep = OpenFormStep = __decorate([
    (0, common_1.Injectable)()
], OpenFormStep);
//# sourceMappingURL=open-form.step.js.map