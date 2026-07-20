"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SduNavigator = void 0;
const common_1 = require("@nestjs/common");
const sdu_navigation_js_1 = require("../sdu-navigation.js");
let SduNavigator = class SduNavigator {
    matches(formUrl) {
        return (0, sdu_navigation_js_1.isSduFormUrl)(formUrl);
    }
    async navigate(context) {
        await (0, sdu_navigation_js_1.navigateToSduApplication)(context.page, context.university.formUrl, context.profile, context.universityId);
    }
};
exports.SduNavigator = SduNavigator;
exports.SduNavigator = SduNavigator = __decorate([
    (0, common_1.Injectable)()
], SduNavigator);
//# sourceMappingURL=sdu.navigator.js.map