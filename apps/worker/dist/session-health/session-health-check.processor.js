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
var SessionHealthCheckProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionHealthCheckProcessor = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const bullmq_1 = require("bullmq");
const browser_service_js_1 = require("../browser/browser.service.js");
const session_validator_js_1 = require("../browser/session.validator.js");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const redis_config_js_1 = require("../queue/redis.config.js");
const university_schema_service_js_1 = require("../university-schema/university-schema.service.js");
const SCHEDULER_ID = 'session-health-check';
const DEFAULT_INTERVAL_MS = 45 * 60_000;
const STALE_THRESHOLD_MS = 2 * 60 * 60_000;
let SessionHealthCheckProcessor = SessionHealthCheckProcessor_1 = class SessionHealthCheckProcessor {
    browserService;
    prisma;
    universitySchemaService;
    logger = new common_1.Logger(SessionHealthCheckProcessor_1.name);
    queue;
    worker;
    constructor(browserService, prisma, universitySchemaService) {
        this.browserService = browserService;
        this.prisma = prisma;
        this.universitySchemaService = universitySchemaService;
    }
    async onModuleInit() {
        const connection = (0, redis_config_js_1.getRedisConnection)();
        const intervalMs = Number(process.env.SESSION_HEALTH_CHECK_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
        this.queue = new bullmq_1.Queue(shared_1.QUEUES.SESSION_HEALTH_CHECK, { connection });
        await this.queue.upsertJobScheduler(SCHEDULER_ID, { every: intervalMs, immediately: false });
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.SESSION_HEALTH_CHECK, () => this.process(), { connection });
        this.logger.log(`Listening on queue "${shared_1.QUEUES.SESSION_HEALTH_CHECK}" (every ${intervalMs}ms)`);
    }
    async onModuleDestroy() {
        await this.worker?.close();
        await this.queue?.close();
    }
    async process(_job) {
        const universityIds = await this.universitySchemaService.listIds();
        for (const universityId of universityIds) {
            try {
                await this.checkOne(universityId);
            }
            catch (error) {
                this.logger.warn(`Health check failed to run for "${universityId}": ${error.message}`);
            }
        }
    }
    async checkOne(universityId) {
        const university = await this.universitySchemaService.get(universityId);
        const targetUrl = university.session?.healthCheckUrl ?? this.originOf(university.formUrl);
        if (!targetUrl) {
            return;
        }
        try {
            await this.browserService.withPageOptions({ universityId }, async (page) => {
                await page.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30_000,
                });
                await (0, session_validator_js_1.assertSessionValid)(page, university);
            });
            await this.recordResult(universityId, true, university);
        }
        catch (error) {
            await this.recordResult(universityId, false, university);
            throw error;
        }
    }
    async recordResult(universityId, valid, university) {
        const now = new Date();
        if (!valid) {
            await this.prisma.browserSession.upsert({
                where: { universityId },
                create: {
                    universityId,
                    status: 'expired',
                    lastValidatedAt: now,
                    validationMethod: 'health_check',
                    consecutiveFailures: 1,
                },
                update: {
                    status: 'expired',
                    lastValidatedAt: now,
                    validationMethod: 'health_check',
                    consecutiveFailures: { increment: 1 },
                },
            });
            return;
        }
        const existing = await this.prisma.browserSession.findUnique({
            where: { universityId },
        });
        const status = this.isNearExpiry(existing?.expiresAt ?? null, now) ? 'stale' : 'fresh';
        await this.prisma.browserSession.upsert({
            where: { universityId },
            create: {
                universityId,
                status,
                lastValidatedAt: now,
                validationMethod: 'health_check',
                consecutiveFailures: 0,
            },
            update: {
                status,
                lastValidatedAt: now,
                validationMethod: 'health_check',
                consecutiveFailures: 0,
            },
        });
    }
    isNearExpiry(expiresAt, now) {
        if (!expiresAt) {
            return false;
        }
        return expiresAt.getTime() - now.getTime() <= STALE_THRESHOLD_MS;
    }
    originOf(formUrl) {
        try {
            return new URL(formUrl).origin;
        }
        catch {
            return null;
        }
    }
};
exports.SessionHealthCheckProcessor = SessionHealthCheckProcessor;
exports.SessionHealthCheckProcessor = SessionHealthCheckProcessor = SessionHealthCheckProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [browser_service_js_1.BrowserService,
        prisma_service_js_1.PrismaService,
        university_schema_service_js_1.UniversitySchemaService])
], SessionHealthCheckProcessor);
//# sourceMappingURL=session-health-check.processor.js.map