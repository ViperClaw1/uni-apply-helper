"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserService = void 0;
const common_1 = require("@nestjs/common");
const stealth_config_js_1 = require("./stealth.config.js");
let BrowserService = class BrowserService {
    browser;
    async withPage(handler) {
        const browser = await this.getBrowser();
        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1440, height: 1200 },
        });
        const page = await context.newPage();
        try {
            return await handler(page);
        }
        finally {
            await context.close();
        }
    }
    async onModuleDestroy() {
        await this.browser?.close();
    }
    async getBrowser() {
        if (this.browser) {
            return this.browser;
        }
        this.browser = await stealth_config_js_1.chromium.launch({
            headless: true,
        });
        return this.browser;
    }
};
exports.BrowserService = BrowserService;
exports.BrowserService = BrowserService = __decorate([
    (0, common_1.Injectable)()
], BrowserService);
//# sourceMappingURL=browser.service.js.map