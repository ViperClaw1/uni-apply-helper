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
const application_resume_service_js_1 = require("../queue/application-resume.service.js");
const redis_config_js_1 = require("../queue/redis.config.js");
const university_schema_service_js_1 = require("../university-schema/university-schema.service.js");
let ReloginProcessor = ReloginProcessor_1 = class ReloginProcessor {
    browserService;
    prisma;
    notificationsService;
    universitySchemaService;
    applicationResumeService;
    logger = new common_1.Logger(ReloginProcessor_1.name);
    worker;
    constructor(browserService, prisma, notificationsService, universitySchemaService, applicationResumeService) {
        this.browserService = browserService;
        this.prisma = prisma;
        this.notificationsService = notificationsService;
        this.universitySchemaService = universitySchemaService;
        this.applicationResumeService = applicationResumeService;
    }
    onModuleInit() {
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.BROWSER_RELOGIN, (job) => this.process(job), {
            connection: (0, redis_config_js_1.getRedisConnection)(),
            lockDuration: 16 * 60_000,
            stalledInterval: 60_000,
            maxStalledCount: 1,
        });
        this.logger.log(`Listening on queue "${shared_1.QUEUES.BROWSER_RELOGIN}"`);
        this.worker.on('failed', (job, error) => {
            this.logger.error(`Relogin job ${job?.id ?? 'unknown'} (university ${job?.data?.universityId ?? 'unknown'}) failed: ${error.message}`);
        });
    }
    async onModuleDestroy() {
        await this.worker?.close();
    }
    async process(job) {
        const university = await this.universitySchemaService.get(job.data.universityId);
        const profileDir = this.browserService.getProfileDir(university.id);
        const loginUrl = (0, session_validator_js_1.getLoginUrl)(university.formUrl);
        await this.notificationsService.notifyReloginStarted(university.displayName, university.id, profileDir);
        try {
            await this.browserService.withPageOptions({ universityId: university.id, headed: true }, async (page) => {
                await page.goto(loginUrl, {
                    waitUntil: 'networkidle',
                    timeout: 60_000,
                });
                const deadline = Date.now() + 15 * 60_000;
                while (Date.now() < deadline) {
                    if (!(await (0, zzu_session_loader_js_1.isLoginPage)(page))) {
                        await this.recordCaptured(university.id, university.session?.sessionTtlHours);
                        await this.notificationsService.notifyReloginCompleted(university.displayName, university.id);
                        await this.applicationResumeService.resumePausedApplications(university.id);
                        return;
                    }
                    await page.waitForTimeout(2_000);
                }
                throw new Error(`Re-login timed out for ${university.displayName} — login not completed within 15 minutes`);
            });
        }
        catch (error) {
            const rawMessage = error instanceof Error ? error.message : 'Unknown error';
            const isNoDisplay = /XServer|Xvfb|X server|DISPLAY environment/i.test(rawMessage);
            const message = isNoDisplay
                ? `This worker can't open a headed browser — no virtual display is configured here. Capture the session locally instead (see apps/worker/scripts/capture-*-session.mjs) and update the deployed session for ${university.displayName}.`
                : rawMessage;
            await this.notificationsService.notifyReloginFailed(university.displayName, university.id, message);
            throw isNoDisplay ? new Error(message) : error;
        }
    }
    async recordCaptured(universityId, sessionTtlHours) {
        const now = new Date();
        const expiresAt = sessionTtlHours
            ? new Date(now.getTime() + sessionTtlHours * 3_600_000)
            : null;
        await this.prisma.browserSession.upsert({
            where: { universityId },
            create: {
                universityId,
                status: 'fresh',
                capturedAt: now,
                lastValidatedAt: now,
                expiresAt,
                validationMethod: 'relogin',
                consecutiveFailures: 0,
            },
            update: {
                status: 'fresh',
                capturedAt: now,
                lastValidatedAt: now,
                expiresAt,
                validationMethod: 'relogin',
                consecutiveFailures: 0,
            },
        });
    }
};
exports.ReloginProcessor = ReloginProcessor;
exports.ReloginProcessor = ReloginProcessor = ReloginProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [browser_service_js_1.BrowserService,
        prisma_service_js_1.PrismaService,
        notifications_service_js_1.NotificationsService,
        university_schema_service_js_1.UniversitySchemaService,
        application_resume_service_js_1.ApplicationResumeService])
], ReloginProcessor);
//# sourceMappingURL=relogin.processor.js.map