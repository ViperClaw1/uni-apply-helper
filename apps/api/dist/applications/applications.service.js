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
exports.ApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const queue_service_js_1 = require("../queue/queue.service.js");
const students_service_js_1 = require("../students/students.service.js");
const universities_service_js_1 = require("../universities/universities.service.js");
let ApplicationsService = class ApplicationsService {
    prisma;
    studentsService;
    universitiesService;
    queueService;
    notificationsService;
    constructor(prisma, studentsService, universitiesService, queueService, notificationsService) {
        this.prisma = prisma;
        this.studentsService = studentsService;
        this.universitiesService = universitiesService;
        this.queueService = queueService;
        this.notificationsService = notificationsService;
    }
    async createBatch(input) {
        if (!input.studentId?.trim()) {
            throw new common_1.BadRequestException('studentId is required.');
        }
        const profile = await this.studentsService.getFullProfile(input.studentId);
        if (profile.applicationTargets.length === 0) {
            throw new common_1.BadRequestException('Student has no application targets.');
        }
        const prepared = await this.prepareApplications(profile);
        const unresolvedCount = prepared.unresolvedTargets.length;
        const blockedCount = prepared.applications.filter((application) => application.status === 'blocked')
            .length + unresolvedCount;
        const batch = await this.prisma.applicationBatch.create({
            data: {
                studentId: input.studentId,
                total: profile.applicationTargets.length,
                blocked: blockedCount,
                status: prepared.applications.some((application) => application.status === 'queued')
                    ? 'queued'
                    : 'completed',
                applications: {
                    create: prepared.applications.map((application) => ({
                        universityId: application.universityId,
                        status: application.status,
                        blockedReason: application.blockedReason,
                        motivationLetterId: application.motivationLetterId,
                        steps: {
                            create: [
                                {
                                    stepName: 'validate_requirements',
                                    status: application.status === 'blocked' ? 'blocked' : 'completed',
                                    errorMessage: application.blockedReason,
                                    startedAt: new Date(),
                                    completedAt: new Date(),
                                },
                            ],
                        },
                    })),
                },
            },
            include: this.batchInclude,
        });
        await this.enqueueQueuedApplications(batch);
        await this.notifyUnresolvedTargets(profile, prepared.unresolvedTargets);
        await this.notificationsService.notifyBatchCreated(batch, profile);
        return this.toBatchResponse(batch);
    }
    async findByStudent(studentId) {
        await this.studentsService.findOne(studentId);
        const batches = await this.prisma.applicationBatch.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            include: this.batchInclude,
        });
        return batches.map((batch) => this.toBatchResponse(batch));
    }
    async findBatch(id) {
        const batch = await this.prisma.applicationBatch.findUnique({
            where: { id },
            include: this.batchInclude,
        });
        if (!batch) {
            throw new common_1.NotFoundException(`Application batch "${id}" was not found.`);
        }
        return this.toBatchResponse(batch);
    }
    async findApplication(id) {
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: { steps: true },
        });
        if (!application) {
            throw new common_1.NotFoundException(`Application "${id}" was not found.`);
        }
        return this.toApplicationResponse(application);
    }
    async updateApplication(id, input) {
        await this.findApplication(id);
        const data = this.toApplicationUpdateInput(input);
        const application = await this.prisma.application.update({
            where: { id },
            data,
            include: { steps: true },
        });
        await this.recalculateBatchCounters(application.batchId);
        return this.toApplicationResponse(application);
    }
    async addStep(applicationId, input) {
        await this.findApplication(applicationId);
        if (!input.stepName?.trim()) {
            throw new common_1.BadRequestException('stepName is required.');
        }
        if (!input.status?.trim()) {
            throw new common_1.BadRequestException('status is required.');
        }
        const step = await this.prisma.applicationStep.create({
            data: {
                applicationId,
                stepName: input.stepName.trim(),
                status: input.status.trim(),
                errorMessage: input.errorMessage,
                startedAt: new Date(),
                completedAt: ['completed', 'failed', 'blocked'].includes(input.status)
                    ? new Date()
                    : null,
            },
        });
        return this.toStepResponse(step);
    }
    batchInclude = {
        applications: {
            orderBy: { createdAt: 'asc' },
            include: { steps: true },
        },
    };
    async prepareApplications(profile) {
        const applications = [];
        const unresolvedTargets = [];
        for (const target of profile.applicationTargets) {
            const resolved = await this.resolveTarget(target);
            if (!resolved.university) {
                unresolvedTargets.push({
                    rawName: target.universityRaw,
                    candidates: resolved.candidates ?? [],
                });
                continue;
            }
            const university = resolved.university;
            const missingDocuments = university.requiredDocuments.filter((documentType) => !profile.documents[documentType]);
            const approvedLetter = university.requiresEssay
                ? await this.findApprovedLetter(profile.id, university.id)
                : null;
            const missing = [
                ...missingDocuments,
                university.requiresEssay && !approvedLetter ? 'approved motivation letter' : null,
            ].filter((item) => item !== null);
            applications.push({
                universityId: university.id,
                status: missing.length > 0 ? 'blocked' : 'queued',
                blockedReason: missing.length > 0 ? `Missing requirements: ${missing.join(', ')}` : undefined,
                motivationLetterId: approvedLetter?.id,
            });
            if (missing.length > 0) {
                const studentName = this.getStudentName(profile);
                await this.notificationsService.notifyBlocked(studentName, university.displayName, missing);
            }
        }
        return { applications, unresolvedTargets };
    }
    async resolveTarget(target) {
        if (target.universityId) {
            return {
                rawName: target.universityRaw,
                university: await this.universitiesService.findOne(target.universityId),
                candidates: [],
            };
        }
        return this.universitiesService.resolve(target.universityRaw);
    }
    async findApprovedLetter(studentId, universityId) {
        return this.prisma.generatedDocument.findFirst({
            where: {
                studentId,
                universityId,
                approvedByConsultant: true,
                type: { in: ['motivation_letter', 'essay'] },
            },
            orderBy: { approvedAt: 'desc' },
            select: { id: true },
        });
    }
    async enqueueQueuedApplications(batch) {
        const queuedApplications = batch.applications.filter((application) => application.status === 'queued');
        await Promise.all(queuedApplications.map((application) => {
            const data = {
                applicationId: application.id,
                batchId: batch.id,
                studentId: batch.studentId,
                universityId: application.universityId,
            };
            return this.queueService.addJob(shared_1.QUEUES.APPLICATION_PROCESS, data, {
                jobId: application.id,
            });
        }));
    }
    async notifyUnresolvedTargets(profile, unresolvedTargets) {
        if (unresolvedTargets.length > 0) {
            await this.notificationsService.notifyUnresolved(this.getStudentName(profile), unresolvedTargets);
        }
    }
    async recalculateBatchCounters(batchId) {
        const applications = await this.prisma.application.findMany({
            where: { batchId },
            select: { status: true },
        });
        const submitted = applications.filter((application) => application.status === 'submitted').length;
        const blocked = applications.filter((application) => application.status === 'blocked').length;
        const failed = applications.filter((application) => application.status === 'failed').length;
        const status = applications.length > 0 &&
            applications.every((application) => ['submitted', 'blocked', 'failed'].includes(application.status))
            ? 'completed'
            : 'processing';
        await this.prisma.applicationBatch.update({
            where: { id: batchId },
            data: {
                submitted,
                blocked,
                failed,
                status,
            },
        });
    }
    toApplicationUpdateInput(input) {
        return {
            status: input.status,
            blockedReason: input.blockedReason,
            motivationLetterId: input.motivationLetterId,
            screenshotBefore: input.screenshotBefore,
            screenshotAfter: input.screenshotAfter,
            submittedAt: input.submittedAt === undefined
                ? undefined
                : input.submittedAt
                    ? new Date(input.submittedAt)
                    : null,
            errorMessage: input.errorMessage,
        };
    }
    toBatchResponse(batch) {
        return {
            id: batch.id,
            studentId: batch.studentId,
            status: batch.status,
            total: batch.total,
            submitted: batch.submitted,
            blocked: batch.blocked,
            failed: batch.failed,
            createdAt: batch.createdAt.toISOString(),
            applications: batch.applications.map((application) => this.toApplicationResponse(application)),
        };
    }
    toApplicationResponse(application) {
        return {
            id: application.id,
            batchId: application.batchId,
            universityId: application.universityId,
            status: application.status,
            blockedReason: application.blockedReason ?? undefined,
            motivationLetterId: application.motivationLetterId ?? undefined,
            screenshotBefore: application.screenshotBefore ?? undefined,
            screenshotAfter: application.screenshotAfter ?? undefined,
            submittedAt: application.submittedAt?.toISOString(),
            errorMessage: application.errorMessage ?? undefined,
            createdAt: application.createdAt.toISOString(),
            steps: application.steps.map((step) => this.toStepResponse(step)),
        };
    }
    toStepResponse(step) {
        return {
            id: step.id,
            applicationId: step.applicationId,
            stepName: step.stepName,
            status: step.status,
            errorMessage: step.errorMessage ?? undefined,
            startedAt: step.startedAt?.toISOString(),
            completedAt: step.completedAt?.toISOString(),
        };
    }
    getStudentName(profile) {
        return [profile.personal.givenName, profile.personal.surname]
            .filter(Boolean)
            .join(' ');
    }
};
exports.ApplicationsService = ApplicationsService;
exports.ApplicationsService = ApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        students_service_js_1.StudentsService,
        universities_service_js_1.UniversitiesService,
        queue_service_js_1.QueueService,
        notifications_service_js_1.NotificationsService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map