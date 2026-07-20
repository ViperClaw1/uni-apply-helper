"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenFormStep = void 0;
const common_1 = require("@nestjs/common");
const zzu_navigation_js_1 = require("../browser/zzu-navigation.js");
const pre_wizard_navigator_js_1 = require("../browser/pre-wizard.navigator.js");
const session_validator_js_1 = require("../browser/session.validator.js");
const zzu_session_loader_js_1 = require("../browser/zzu-session.loader.js");
let OpenFormStep = class OpenFormStep {
    preWizardNavigator;
    name = 'open_form';
    constructor(preWizardNavigator) {
        this.preWizardNavigator = preWizardNavigator;
    }
    async execute(context) {
        if ((0, zzu_session_loader_js_1.isZzuFormUrl)(context.university.formUrl)) {
            await (0, zzu_navigation_js_1.navigateToZzuApplication)(context.page, context.university.formUrl, context.profile, context.universityId);
        }
        else {
            await context.page.goto(context.university.formUrl, {
                waitUntil: 'networkidle',
                timeout: 60_000,
            });
            await this.preWizardNavigator.navigateToForm(context.page, context.university.fields);
        }
        await (0, session_validator_js_1.assertSessionValid)(context.page, context.university);
    }
};
exports.OpenFormStep = OpenFormStep;
exports.OpenFormStep = OpenFormStep = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pre_wizard_navigator_js_1.PreWizardNavigator])
], OpenFormStep);
//# sourceMappingURL=open-form.step.js.map