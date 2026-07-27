"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CucasNavigator = void 0;
const common_1 = require("@nestjs/common");
const cucas_navigation_js_1 = require("../cucas-navigation.js");
let CucasNavigator = class CucasNavigator {
    matches(formUrl) {
        return (0, cucas_navigation_js_1.isCucasChiwestUrl)(formUrl);
    }
    async navigate(context) {
        await (0, cucas_navigation_js_1.navigateToCucasApplication)(context.page, context.university.formUrl, context.profile, context.universityId);
    }
};
exports.CucasNavigator = CucasNavigator;
exports.CucasNavigator = CucasNavigator = __decorate([
    (0, common_1.Injectable)()
], CucasNavigator);
//# sourceMappingURL=cucas.navigator.js.map