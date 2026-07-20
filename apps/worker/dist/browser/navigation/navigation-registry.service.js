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
exports.NavigationRegistry = void 0;
const common_1 = require("@nestjs/common");
const generic_navigator_js_1 = require("./generic.navigator.js");
const sdu_navigator_js_1 = require("./sdu.navigator.js");
const zzu_navigator_js_1 = require("./zzu.navigator.js");
let NavigationRegistry = class NavigationRegistry {
    zzuNavigator;
    sduNavigator;
    genericNavigator;
    constructor(zzuNavigator, sduNavigator, genericNavigator) {
        this.zzuNavigator = zzuNavigator;
        this.sduNavigator = sduNavigator;
        this.genericNavigator = genericNavigator;
    }
    resolve(formUrl) {
        const navigators = [
            this.zzuNavigator,
            this.sduNavigator,
            this.genericNavigator,
        ];
        return (navigators.find((navigator) => navigator.matches(formUrl)) ??
            this.genericNavigator);
    }
};
exports.NavigationRegistry = NavigationRegistry;
exports.NavigationRegistry = NavigationRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [zzu_navigator_js_1.ZzuNavigator,
        sdu_navigator_js_1.SduNavigator,
        generic_navigator_js_1.GenericNavigator])
], NavigationRegistry);
//# sourceMappingURL=navigation-registry.service.js.map