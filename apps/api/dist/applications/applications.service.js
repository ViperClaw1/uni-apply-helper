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
    notificationsService;
    queueService;
    constructor(prisma, studentsService, universitiesService, notificationsService, queueService) {
        this.prisma = prisma;
        this.studentsService = studentsService;
        this.universitiesService = universitiesService;
        this.notificationsService = notificationsService;
        this.queueService = queueService;
    }
    async createBatch(input) {
        if (!input.studentId?.trim()) {
            throw new common_1.BadRequestException('studentId is required.');
        }
        const profile = await this.studentsService.getFullProfile(input.studentId);
        const resolvedTargets = profile.applicationTargets.filter((target) => Boolean(target.universityId));
        if (resolvedTargets.length === 0) {
            throw new common_1.BadRequestException('Student has no resolved application targets. Add universities by form URL first.');
        }
        const submittedUniversityIds = await this.findSubmittedUniversityIds(input.studentId);
        const selectedTargets = resolvedTargets.filter((target) => target.universityId && !submittedUniversityIds.has(target.universityId));
        if (selectedTargets.length === 0) {
            throw new common_1.BadRequestException('All selected universities already have a submitted application.');
        }
        const batchProfile = {
            ...profile,
            applicationTargets: selectedTargets,
        };
        const prepared = await this.prepareApplications(batchProfile);
        const unresolvedCount = prepared.unresolvedTargets.length;
        const blockedCount = prepared.applications.filter((application) => application.status === 'blocked').length + unresolvedCount;
        const batch = await this.prisma.applicationBatch.create({
            data: {
                studentId: input.studentId,
                total: selectedTargets.length,
                blocked: blockedCount,
                status: prepared.applications.some((application) => application.status === 'ready_for_submission')
                    ? 'processing'
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
        await this.notifyUnresolvedTargets(batchProfile, prepared.unresolvedTargets);
        await this.notificationsService.notifyBatchCreated(batch, batchProfile);
        const readyApplications = batch.applications.filter((app) => app.status === 'ready_for_submission');
        await Promise.all(readyApplications.map((app) => this.queueService.addJob(shared_1.QUEUES.APPLICATION_PROCESS, {
            applicationId: app.id,
            batchId: batch.id,
            studentId: input.studentId,
            universityId: app.universityId,
        })));
        return this.toBatchResponse(batch);
    }
    async findAll() {
        const applications = await this.prisma.application.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                batch: {
                    select: {
                        studentId: true,
                        student: { select: { givenName: true, surname: true } },
                    },
                },
            },
        });
        const universityNames = await this.getUniversityDisplayNames(applications.map((application) => application.universityId));
        return applications.map((application) => ({
            id: application.id,
            batchId: application.batchId,
            studentId: application.batch.studentId,
            studentName: [application.batch.student.givenName, application.batch.student.surname]
                .filter(Boolean)
                .join(' ') || application.batch.studentId,
            universityId: application.universityId,
            universityDisplayName: universityNames.get(application.universityId),
            status: application.status,
            blockedReason: application.blockedReason ?? undefined,
            submittedAt: application.submittedAt?.toISOString(),
            createdAt: application.createdAt.toISOString(),
        }));
    }
    async getUniversityDisplayNames(universityIds) {
        const uniqueIds = [...new Set(universityIds)];
        const entries = await Promise.all(uniqueIds.map(async (id) => {
            try {
                const university = await this.universitiesService.findOne(id);
                return [id, university.displayName];
            }
            catch {
                return [id, id];
            }
        }));
        return new Map(entries);
    }
    async findByStudent(studentId) {
        await this.studentsService.findOne(studentId);
        const batches = await this.prisma.applicationBatch.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            include: this.batchInclude,
        });
        return Promise.all(batches.map((batch) => this.toBatchResponse(batch)));
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
        return this.enrichApplicationResponse(application);
    }
    async findActiveByUrl(url, studentId) {
        if (!url?.trim()) {
            throw new common_1.BadRequestException('url is required.');
        }
        if (!studentId?.trim()) {
            throw new common_1.BadRequestException('studentId is required.');
        }
        await this.studentsService.findOne(studentId);
        const university = await this.universitiesService.findByFormUrl(url);
        if (!university) {
            throw new common_1.NotFoundException('No university matches this URL.');
        }
        const application = await this.prisma.application.findFirst({
            where: {
                status: 'ready_for_submission',
                universityId: university.id,
                batch: { studentId },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!application) {
            throw new common_1.NotFoundException('No active application found for this URL.');
        }
        const profile = await this.studentsService.getFullProfile(studentId);
        const schema = await this.universitiesService.getFullSchemaForExtension(university.id);
        let motivationLetter;
        if (application.motivationLetterId) {
            const letter = await this.prisma.generatedDocument.findUnique({
                where: { id: application.motivationLetterId },
                select: { content: true },
            });
            motivationLetter = letter?.content;
        }
        return {
            applicationId: application.id,
            studentId,
            university: {
                id: university.id,
                displayName: university.displayName,
                formUrl: university.formUrl,
            },
            profile,
            schema,
            motivationLetter,
        };
    }
    async markApplicationReady(id) {
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: { steps: true },
        });
        if (!application) {
            throw new common_1.NotFoundException(`Application "${id}" was not found.`);
        }
        if (application.status === 'submitted') {
            throw new common_1.BadRequestException('Application is already submitted.');
        }
        if (application.status === 'blocked') {
            throw new common_1.BadRequestException(application.blockedReason ?? 'Application is blocked.');
        }
        if (application.status === 'ready_for_submission') {
            return this.enrichApplicationResponse(application);
        }
        const readyAt = new Date();
        const updated = await this.prisma.application.update({
            where: { id },
            data: {
                status: 'ready_for_submission',
                errorMessage: null,
                steps: {
                    create: {
                        stepName: 'extension_ready',
                        status: 'completed',
                        startedAt: readyAt,
                        completedAt: readyAt,
                    },
                },
            },
            include: { steps: true },
        });
        await this.recalculateBatchCounters(updated.batchId);
        return this.enrichApplicationResponse(updated);
    }
    async submitApplication(id, input = {}) {
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: {
                steps: true,
                batch: { select: { studentId: true } },
            },
        });
        if (!application) {
            throw new common_1.NotFoundException(`Application "${id}" was not found.`);
        }
        if (application.status !== 'ready_for_submission') {
            throw new common_1.BadRequestException(`Application must be in ready_for_submission status. Current: ${application.status}`);
        }
        const submittedAt = input.submittedAt
            ? new Date(input.submittedAt)
            : new Date();
        await this.prisma.application.update({
            where: { id },
            data: {
                status: 'submitted',
                submittedAt,
            },
        });
        await this.prisma.applicationStep.create({
            data: {
                applicationId: id,
                stepName: 'consultant_submit',
                status: 'completed',
                startedAt: submittedAt,
                completedAt: submittedAt,
            },
        });
        await this.recalculateBatchCounters(application.batchId);
        const profile = await this.studentsService.getFullProfile(application.batch.studentId);
        const university = await this.universitiesService.findOne(application.universityId);
        await this.notificationsService.notifySubmitted(university.displayName, this.getStudentName(profile));
        const withSteps = await this.prisma.application.findUnique({
            where: { id },
            include: { steps: true },
        });
        return this.enrichApplicationResponse(withSteps);
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
        return this.enrichApplicationResponse(application);
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
            const { missing, approvedLetterId } = await this.evaluateTargetReadiness(university, profile);
            applications.push({
                universityId: university.id,
                status: missing.length > 0 ? 'blocked' : 'ready_for_submission',
                blockedReason: missing.length > 0
                    ? `Missing requirements: ${missing.join(', ')}`
                    : undefined,
                motivationLetterId: approvedLetterId,
            });
            if (missing.length > 0) {
                const studentName = this.getStudentName(profile);
                await this.notificationsService.notifyBlocked(studentName, university.displayName, missing);
            }
        }
        return { applications, unresolvedTargets };
    }
    async evaluateTargetReadiness(university, profile) {
        const missingDocuments = university.requiredDocuments.filter((documentType) => !(0, shared_1.hasDocument)(profile.documents, documentType));
        const approvedLetter = university.requiresEssay
            ? await this.findApprovedLetter(profile.id, university.id)
            : null;
        const missing = [
            ...missingDocuments,
            university.requiresEssay && !approvedLetter
                ? 'approved motivation letter'
                : null,
        ].filter((item) => item !== null);
        return { missing, approvedLetterId: approvedLetter?.id };
    }
    async previewReadiness(studentId) {
        const profile = await this.studentsService.getFullProfile(studentId);
        const submittedUniversityIds = await this.findSubmittedUniversityIds(studentId);
        const results = [];
        for (const target of profile.applicationTargets) {
            if (target.universityId &&
                submittedUniversityIds.has(target.universityId)) {
                results.push({
                    universityId: target.universityId,
                    universityRaw: target.universityRaw,
                    status: 'submitted',
                    missingDocuments: [],
                });
                continue;
            }
            const resolved = await this.resolveTarget(target);
            if (!resolved.university) {
                results.push({
                    universityRaw: target.universityRaw,
                    status: 'unresolved',
                    missingDocuments: [],
                    blockedReason: 'University link not resolved yet.',
                });
                continue;
            }
            const university = resolved.university;
            const { missing } = await this.evaluateTargetReadiness(university, profile);
            results.push({
                universityId: university.id,
                universityRaw: target.universityRaw,
                status: missing.length > 0 ? 'blocked' : 'ready',
                missingDocuments: missing,
                blockedReason: missing.length > 0
                    ? `Missing requirements: ${missing.join(', ')}`
                    : undefined,
            });
        }
        return results;
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
    async findSubmittedUniversityIds(studentId) {
        const rows = await this.prisma.application.findMany({
            where: {
                status: 'submitted',
                batch: { studentId },
            },
            select: { universityId: true },
            distinct: ['universityId'],
        });
        return new Set(rows.map((row) => row.universityId));
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
    async toBatchResponse(batch) {
        const applications = await Promise.all(batch.applications.map((application) => this.enrichApplicationResponse(application)));
        return {
            id: batch.id,
            studentId: batch.studentId,
            status: batch.status,
            total: batch.total,
            submitted: batch.submitted,
            blocked: batch.blocked,
            failed: batch.failed,
            createdAt: batch.createdAt.toISOString(),
            applications,
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
    async enrichApplicationResponse(application) {
        const base = this.toApplicationResponse(application);
        try {
            const university = await this.universitiesService.findOne(application.universityId);
            return {
                ...base,
                universityDisplayName: university.displayName,
                formUrl: university.formUrl,
            };
        }
        catch {
            return base;
        }
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
        notifications_service_js_1.NotificationsService,
        queue_service_js_1.QueueService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map