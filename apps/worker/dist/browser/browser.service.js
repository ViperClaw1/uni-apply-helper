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
const profile_path_js_1 = require("./profile-path.js");
const zzu_session_meta_js_1 = require("./zzu-session-meta.js");
const zzu_session_loader_js_1 = require("./zzu-session.loader.js");
const session_loader_js_1 = require("./session.loader.js");
let BrowserService = class BrowserService {
    configService;
    browser;
    activeContexts = new Set();
    constructor(configService) {
        this.configService = configService;
    }
    async withPage(universityId, handler) {
        return this.withPageOptions({ universityId }, handler);
    }
    async withPageOptions(options, handler) {
        const session = await this.createSession(options);
        try {
            return await handler(session.page);
        }
        finally {
            await session.context.close();
            this.activeContexts.delete(session.context);
            if (session.browser) {
                await session.browser.close();
                this.browser = undefined;
            }
        }
    }
    async onModuleDestroy() {
        await Promise.all([...this.activeContexts].map((context) => context.close()));
        await this.browser?.close();
    }
    getProfileDir(universityId) {
        return (0, profile_path_js_1.resolveProfileDir)(this.configService, universityId);
    }
    async createSession(options) {
        const profileDir = (0, profile_path_js_1.resolveProfileDir)(this.configService, options.universityId);
        const headed = options.headed ?? this.configService.get('BROWSER_HEADED') === '1';
        if (profileDir) {
            const launchOptions = {
                headless: !headed,
                args: ['--disable-blink-features=AutomationControlled'],
                acceptDownloads: true,
                viewport: { width: 1440, height: 1200 },
                ...(0, zzu_session_meta_js_1.getZzuContextOptions)((0, zzu_session_meta_js_1.loadZzuSessionMeta)(this.configService)),
            };
            const channel = this.configService.get('BROWSER_CHANNEL');
            if (channel) {
                launchOptions.channel = channel;
            }
            else {
                const legacyChannel = this.configService.get('ZZU_BROWSER_CHANNEL');
                if (legacyChannel) {
                    launchOptions.channel = legacyChannel;
                }
            }
            const context = await stealth_config_js_1.chromium.launchPersistentContext(profileDir, launchOptions);
            this.activeContexts.add(context);
            const page = context.pages()[0] ?? (await context.newPage());
            return { context, page };
        }
        const cdpUrl = this.configService.get('ZZU_USE_CDP') === '1'
            ? this.configService.get('ZZU_CDP_URL')
            : undefined;
        if (cdpUrl) {
            const browser = await stealth_config_js_1.chromium.connectOverCDP(cdpUrl);
            const context = browser.contexts()[0] ?? (await browser.newContext());
            this.activeContexts.add(context);
            const page = context.pages()[0] ?? (await context.newPage());
            return { browser, context, page };
        }
        const browser = await this.getBrowser(headed);
        const storageState = (0, session_loader_js_1.loadUniversityStorageState)(this.configService, options.universityId) ??
            (0, zzu_session_loader_js_1.loadZzuStorageState)(this.configService);
        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1440, height: 1200 },
            ...(storageState ? { storageState } : {}),
            ...(0, zzu_session_meta_js_1.getZzuContextOptions)((0, zzu_session_meta_js_1.loadZzuSessionMeta)(this.configService)),
        });
        this.activeContexts.add(context);
        const page = await context.newPage();
        return { browser, context, page };
    }
    async getBrowser(headed) {
        if (this.browser) {
            return this.browser;
        }
        const channel = this.configService.get('BROWSER_CHANNEL') ??
            this.configService.get('ZZU_BROWSER_CHANNEL');
        this.browser = await stealth_config_js_1.chromium.launch({
            headless: !headed,
            ...(channel ? { channel: channel } : {}),
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