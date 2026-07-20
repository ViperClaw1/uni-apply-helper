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
exports.GenericNavigator = void 0;
const common_1 = require("@nestjs/common");
const pre_wizard_navigator_js_1 = require("../pre-wizard.navigator.js");
let GenericNavigator = class GenericNavigator {
    preWizardNavigator;
    constructor(preWizardNavigator) {
        this.preWizardNavigator = preWizardNavigator;
    }
    matches() {
        return true;
    }
    async navigate(context) {
        await context.page.goto(context.university.formUrl, {
            waitUntil: 'networkidle',
            timeout: 60_000,
        });
        await this.preWizardNavigator.navigateToForm(context.page, context.university.fields);
    }
};
exports.GenericNavigator = GenericNavigator;
exports.GenericNavigator = GenericNavigator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pre_wizard_navigator_js_1.PreWizardNavigator])
], GenericNavigator);
//# sourceMappingURL=generic.navigator.js.map