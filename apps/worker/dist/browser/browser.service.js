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
exports.BrowserService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stealth_config_js_1 = require("./stealth.config.js");
const zzu_session_meta_js_1 = require("./zzu-session-meta.js");
const zzu_session_loader_js_1 = require("./zzu-session.loader.js");
let BrowserService = class BrowserService {
    configService;
    browser;
    persistentContext;
    constructor(configService) {
        this.configService = configService;
    }
    async withPage(handler) {
        const { browser, context, page, persistent } = await this.createSession();
        try {
            return await handler(page);
        }
        finally {
            if (persistent) {
                await context.close();
            }
            else {
                await context.close();
                await browser?.close();
            }
        }
    }
    async onModuleDestroy() {
        await this.persistentContext?.close();
        await this.browser?.close();
    }
    async createSession() {
        const cdpUrl = this.configService.get('ZZU_CDP_URL');
        if (cdpUrl) {
            const browser = await stealth_config_js_1.chromium.connectOverCDP(cdpUrl);
            const context = browser.contexts()[0] ?? (await browser.newContext());
            const page = context.pages()[0] ?? (await context.newPage());
            return { browser, context, page, persistent: false };
        }
        const profileDir = this.configService.get('ZZU_PROFILE_DIR');
        const useProfile = this.configService.get('ZZU_USE_PROFILE') === '1' || Boolean(profileDir);
        if (useProfile) {
            const launchOptions = {
                headless: this.configService.get('ZZU_HEADED') !== '1',
                args: ['--disable-blink-features=AutomationControlled'],
                acceptDownloads: true,
                ...(0, zzu_session_meta_js_1.getZzuContextOptions)((0, zzu_session_meta_js_1.loadZzuSessionMeta)(this.configService)),
            };
            const channel = this.configService.get('ZZU_BROWSER_CHANNEL');
            if (channel) {
                launchOptions.channel = channel;
            }
            const context = await stealth_config_js_1.chromium.launchPersistentContext(profileDir ?? `${process.cwd()}/zzu-browser-profile`, launchOptions);
            this.persistentContext = context;
            const page = context.pages()[0] ?? (await context.newPage());
            return { context, page, persistent: true };
        }
        const browser = await this.getBrowser();
        const storageState = (0, zzu_session_loader_js_1.loadZzuStorageState)(this.configService);
        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1440, height: 1200 },
            ...(storageState ? { storageState } : {}),
            ...(0, zzu_session_meta_js_1.getZzuContextOptions)((0, zzu_session_meta_js_1.loadZzuSessionMeta)(this.configService)),
        });
        const page = await context.newPage();
        return { browser, context, page, persistent: false };
    }
    async getBrowser() {
        if (this.browser) {
            return this.browser;
        }
        this.browser = await stealth_config_js_1.chromium.launch({
            headless: this.configService.get('ZZU_HEADED') !== '1',
            ...(this.configService.get('ZZU_BROWSER_CHANNEL')
                ? { channel: this.configService.get('ZZU_BROWSER_CHANNEL') }
                : {}),
            args: ['--disable-blink-features=AutomationControlled'],
        });
        return this.browser;
    }
};
exports.BrowserService = BrowserService;
exports.BrowserService = BrowserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BrowserService);
//# sourceMappingURL=browser.service.js.map