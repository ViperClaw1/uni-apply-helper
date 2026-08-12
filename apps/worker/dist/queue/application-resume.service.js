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
var ApplicationResumeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationResumeService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const bullmq_1 = require("bullmq");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const redis_config_js_1 = require("./redis.config.js");
const PAUSED_STATUSES = ['waiting_for_login', 'attention_required'];
let ApplicationResumeService = ApplicationResumeService_1 = class ApplicationResumeService {
    prisma;
    logger = new common_1.Logger(ApplicationResumeService_1.name);
    queue;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resumePausedApplications(universityId) {
        const applications = await this.prisma.application.findMany({
            where: { universityId, status: { in: PAUSED_STATUSES } },
            select: {
                id: true,
                batchId: true,
                batch: { select: { studentId: true } },
            },
        });
        if (applications.length === 0) {
            return 0;
        }
        await this.prisma.application.updateMany({
            where: { id: { in: applications.map((application) => application.id) } },
            data: { status: 'queued', errorMessage: null },
        });
        await Promise.all(applications.map((application) => this.prisma.applicationStep.create({
            data: {
                applicationId: application.id,
                stepName: 'session_resumed',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
            },
        })));
        const queue = this.getQueue();
        await Promise.all(applications.map((application) => queue.add(shared_1.QUEUES.APPLICATION_PROCESS, {
            applicationId: application.id,
            batchId: application.batchId,
            studentId: application.batch.studentId,
            universityId,
        })));
        this.logger.log(`Resumed ${applications.length} paused application(s) for university "${universityId}"`);
        return applications.length;
    }
    getQueue() {
        if (!this.queue) {
            this.queue = new bullmq_1.Queue(shared_1.QUEUES.APPLICATION_PROCESS, {
                connection: (0, redis_config_js_1.getRedisConnection)(),
            });
        }
        return this.queue;
    }
};
exports.ApplicationResumeService = ApplicationResumeService;
exports.ApplicationResumeService = ApplicationResumeService = ApplicationResumeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], ApplicationResumeService);
//# sourceMappingURL=application-resume.service.js.map