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
exports.ZzuNavigator = void 0;
const common_1 = require("@nestjs/common");
const gemini_client_js_1 = require("../../agent/gemini/gemini.client.js");
const zzu_navigation_js_1 = require("../zzu-navigation.js");
const zzu_session_loader_js_1 = require("../zzu-session.loader.js");
let ZzuNavigator = class ZzuNavigator {
    gemini;
    constructor(gemini) {
        this.gemini = gemini;
    }
    matches(formUrl) {
        return (0, zzu_session_loader_js_1.isZzuFormUrl)(formUrl);
    }
    async navigate(context) {
        await (0, zzu_navigation_js_1.navigateToZzuApplication)(context.page, context.university.formUrl, context.profile, context.universityId, context.university.defaultProgram, context.university.navigationHints, this.gemini);
    }
};
exports.ZzuNavigator = ZzuNavigator;
exports.ZzuNavigator = ZzuNavigator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_client_js_1.GeminiClient])
], ZzuNavigator);
//# sourceMappingURL=zzu.navigator.js.map