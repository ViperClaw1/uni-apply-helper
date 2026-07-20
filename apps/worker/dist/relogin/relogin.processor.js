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
var ReloginProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReloginProcessor = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const bullmq_1 = require("bullmq");
const browser_service_js_1 = require("../browser/browser.service.js");
const session_validator_js_1 = require("../browser/session.validator.js");
const zzu_session_loader_js_1 = require("../browser/zzu-session.loader.js");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const redis_config_js_1 = require("../queue/redis.config.js");
let ReloginProcessor = ReloginProcessor_1 = class ReloginProcessor {
    browserService;
    prisma;
    notificationsService;
    logger = new common_1.Logger(ReloginProcessor_1.name);
    worker;
    constructor(browserService, prisma, notificationsService) {
        this.browserService = browserService;
        this.prisma = prisma;
        this.notificationsService = notificationsService;
    }
    onModuleInit() {
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.BROWSER_RELOGIN, (job) => this.process(job), {
            connection: (0, redis_config_js_1.getRedisConnection)(),
        });
        this.logger.log(`Listening on queue "${shared_1.QUEUES.BROWSER_RELOGIN}"`);
    }
    async onModuleDestroy() {
        await this.worker?.close();
    }
    async process(job) {
        const university = await this.prisma.universitySchema.findUnique({
            where: { id: job.data.universityId },
        });
        if (!university) {
            throw new Error(`University "${job.data.universityId}" was not found.`);
        }
        const profileDir = this.browserService.getProfileDir(university.id);
        const loginUrl = (0, session_validator_js_1.getLoginUrl)(university.formUrl);
        await this.notificationsService.notifyReloginStarted(university.displayName, university.id, profileDir);
        await this.browserService.withPageOptions({ universityId: university.id, headed: true }, async (page) => {
            await page.goto(loginUrl, {
                waitUntil: 'networkidle',
                timeout: 60_000,
            });
            const deadline = Date.now() + 15 * 60_000;
            while (Date.now() < deadline) {
                if (!(await (0, zzu_session_loader_js_1.isLoginPage)(page))) {
                    await this.notificationsService.notifyReloginCompleted(university.displayName, university.id);
                    return;
                }
                await page.waitForTimeout(2_000);
            }
            throw new Error(`Re-login timed out for ${university.displayName} — login not completed within 15 minutes`);
        });
    }
};
exports.ReloginProcessor = ReloginProcessor;
exports.ReloginProcessor = ReloginProcessor = ReloginProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [browser_service_js_1.BrowserService,
        prisma_service_js_1.PrismaService,
        notifications_service_js_1.NotificationsService])
], ReloginProcessor);
//# sourceMappingURL=relogin.processor.js.map