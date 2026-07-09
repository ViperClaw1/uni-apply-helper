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
exports.LogResultStep = void 0;
const common_1 = require("@nestjs/common");
const screenshot_service_js_1 = require("../screenshot/screenshot.service.js");
let LogResultStep = class LogResultStep {
    screenshotService;
    name = 'log_result';
    constructor(screenshotService) {
        this.screenshotService = screenshotService;
    }
    async execute(context) {
        context.screenshotAfter = await this.screenshotService.capture(context.page, context.applicationId, 'after');
    }
};
exports.LogResultStep = LogResultStep;
exports.LogResultStep = LogResultStep = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [screenshot_service_js_1.ScreenshotService])
], LogResultStep);
//# sourceMappingURL=log-result.step.js.map