"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReloginViewerModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_js_1 = require("../auth/auth.module.js");
const redis_client_provider_js_1 = require("./redis-client.provider.js");
const relogin_viewer_controller_js_1 = require("./relogin-viewer.controller.js");
const relogin_viewer_service_js_1 = require("./relogin-viewer.service.js");
let ReloginViewerModule = class ReloginViewerModule {
};
exports.ReloginViewerModule = ReloginViewerModule;
exports.ReloginViewerModule = ReloginViewerModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_js_1.AuthModule],
        controllers: [relogin_viewer_controller_js_1.ReloginViewerController],
        providers: [redis_client_provider_js_1.redisClientProvider, relogin_viewer_service_js_1.ReloginViewerService],
        exports: [relogin_viewer_service_js_1.ReloginViewerService],
    })
], ReloginViewerModule);
//# sourceMappingURL=relogin-viewer.module.js.map