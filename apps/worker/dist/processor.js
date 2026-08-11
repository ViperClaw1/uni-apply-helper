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
var Processor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Processor = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const bullmq_1 = require("bullmq");
const browser_service_js_1 = require("./browser/browser.service.js");
const session_expired_error_js_1 = require("./errors/session-expired.error.js");
const notifications_service_js_1 = require("./notifications/notifications.service.js");
const prisma_service_js_1 = require("./prisma/prisma.service.js");
const redis_config_js_1 = require("./queue/redis.config.js");
const screenshot_service_js_1 = require("./screenshot/screenshot.service.js");
const attach_files_step_js_1 = require("./steps/attach-files.step.js");
const fill_fields_step_js_1 = require("./steps/fill-fields.step.js");
const fill_wizard_step_js_1 = require("./steps/fill-wizard.step.js");
const log_result_step_js_1 = require("./steps/log-result.step.js");
const open_form_step_js_1 = require("./steps/open-form.step.js");
const submit_form_step_js_1 = require("./steps/submit-form.step.js");
const university_schema_service_js_1 = require("./university-schema/university-schema.service.js");
let Processor = Processor_1 = class Processor {
    prisma;
    browserService;
    screenshotService;
    openFormStep;
    fillFieldsStep;
    attachFilesStep;
    submitFormStep;
    fillWizardStep;
    logResultStep;
    notificationsService;
    universitySchemaService;
    logger = new common_1.Logger(Processor_1.name);
    worker;
    steps;
    constructor(prisma, browserService, screenshotService, openFormStep, fillFieldsStep, attachFilesStep, submitFormStep, fillWizardStep, logResultStep, notificationsService, universitySchemaService) {
        this.prisma = prisma;
        this.browserService = browserService;
        this.screenshotService = screenshotService;
        this.openFormStep = openFormStep;
        this.fillFieldsStep = fillFieldsStep;
        this.attachFilesStep = attachFilesStep;
        this.submitFormStep = submitFormStep;
        this.fillWizardStep = fillWizardStep;
        this.logResultStep = logResultStep;
        this.notificationsService = notificationsService;
        this.universitySchemaService = universitySchemaService;
        this.steps = [
            this.openFormStep,
            this.fillFieldsStep,
            this.attachFilesStep,
            this.submitFormStep,
            this.logResultStep,
        ];
    }
    getSteps(university) {
        if (university.wizard) {
            return [this.openFormStep, this.fillWizardStep, this.logResultStep];
        }
        return this.steps;
    }
    onModuleInit() {
        const lockDuration = Number(process.env.BULLMQ_LOCK_DURATION_MS) || 15 * 60_000;
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.APPLICATION_PROCESS, (job) => this.process(job), {
            connection: (0, redis_config_js_1.getRedisConnection)(),
            lockDuration,
            stalledInterval: 60_000,
            maxStalledCount: 2,
            concurrency: 1,
        });
        this.logger.log(`Listening on queue "${shared_1.QUEUES.APPLICATION_PROCESS}" (lockDuration=${lockDuration}ms)`);
        this.worker.on('active', (job) => {
            this.logger.log(`Picked up application job ${job.id}`);
        });
        this.worker.on('stalled', (jobId) => {
            this.logger.warn(`Application job ${jobId} stalled (worker likely killed/redeployed or event-loop blocked)`);
        });
        this.worker.on('failed', (job, error) => {
            this.logger.error(`Application job ${job?.id ?? 'unknown'} failed: ${error.message}`);
            void this.markApplicationFailedFromJob(job?.data?.applicationId, error.message);
        });
    }
    async onModuleDestroy() {
        await this.worker?.close();
    }
    async process(job) {
        const timeoutMs = Number(process.env.APPLICATION_JOB_TIMEOUT_MS) || 25 * 60_000;
        await this.withTimeout(() => this.processApplication(job), timeoutMs, `Application job timed out after ${Math.round(timeoutMs / 60_000)} minutes`);
    }
    async withTimeout(fn, ms, message) {
        let timer;
        try {
            return await Promise.race([
                fn(),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(message)), ms);
                }),
            ]);
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
    async markApplicationFailedFromJob(applicationId, errorMessage) {
        if (!applicationId) {
            return;
        }
        try {
            const updated = await this.prisma.application.updateMany({
                where: {
                    id: applicationId,
                    status: { in: ['processing', 'queued', 'ready_for_submission'] },
                },
                data: {
                    status: 'failed',
                    errorMessage: errorMessage.slice(0, 2000),
                },
            });
            if (updated.count === 0) {
                return;
            }
            await this.prisma.applicationStep.updateMany({
                where: { applicationId, status: 'processing' },
                data: {
                    status: 'failed',
                    errorMessage: errorMessage.slice(0, 2000),
                    completedAt: new Date(),
                },
            });
            const app = await this.prisma.application.findUnique({
                where: { id: applicationId },
                select: { batchId: true },
            });
            if (app?.batchId) {
                await this.recalculateBatchCounters(app.batchId);
            }
        }
        catch (error) {
            this.logger.warn(`Failed to mark application ${applicationId} failed after job error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async processApplication(job) {
        const application = await this.prisma.application.findUniqueOrThrow({
            where: { id: job.data.applicationId },
            include: {
                batch: {
                    include: {
                        student: {
                            include: {
                                education: true,
                                workExperience: true,
                                languageSkills: true,
                                familyMembers: true,
                                guarantor: true,
                                emergencyContact: true,
                                documents: true,
                                applicationTargets: true,
                            },
                        },
                    },
                },
            },
        });
        const profile = this.toStudentProfile(application.batch.student);
        const university = await this.universitySchemaService.get(application.universityId);
        const motivationLetterContent = application.motivationLetterId
            ? await this.getGeneratedDocumentContent(application.motivationLetterId)
            : undefined;
        const studentName = this.getStudentName(profile);
        await this.prisma.application.update({
            where: { id: application.id },
            data: { status: 'processing' },
        });
        try {
            await this.browserService.withPage(university.id, async (page) => {
                try {
                    const context = {
                        applicationId: application.id,
                        batchId: application.batchId,
                        studentId: profile.id,
                        universityId: university.id,
                        profile,
                        university,
                        motivationLetterContent,
                        page,
                    };
                    for (const step of this.getSteps(university)) {
                        await this.runStep(application.id, step, context);
                        if (step.name === 'open_form') {
                            context.screenshotBefore = await this.screenshotService.capture(page, application.id, 'before');
                            await this.prisma.application.update({
                                where: { id: application.id },
                                data: { screenshotBefore: context.screenshotBefore },
                            });
                        }
                    }
                    await this.prisma.application.update({
                        where: { id: application.id },
                        data: {
                            status: 'submitted',
                            submittedAt: new Date(),
                            screenshotAfter: context.screenshotAfter,
                        },
                    });
                    await this.recalculateBatchCounters(application.batchId);
                    await this.notificationsService.notifySubmitted(university.displayName, studentName, context.screenshotAfter);
                }
                catch (innerError) {
                    const baseMessage = innerError instanceof Error ? innerError.message : 'Unknown error';
                    const fromMessage = baseMessage.match(/Screenshot:\s*(https?:\/\/\S+)/i)?.[1];
                    const shotUrl = fromMessage ??
                        (await this.screenshotService.captureSafe(page, application.id, 'failed'));
                    const message = shotUrl && !fromMessage
                        ? `${baseMessage} Screenshot: ${shotUrl}`
                        : baseMessage;
                    if (shotUrl) {
                        await this.prisma.application
                            .update({
                            where: { id: application.id },
                            data: { screenshotAfter: shotUrl },
                        })
                            .catch(() => undefined);
                    }
                    throw message === baseMessage
                        ? innerError
                        : new Error(message, { cause: innerError });
                }
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await this.prisma.application.update({
                where: { id: application.id },
                data: {
                    status: 'failed',
                    errorMessage: message,
                },
            });
            await this.recalculateBatchCounters(application.batchId);
            const maxAttempts = job.opts.attempts ?? 1;
            const attemptNumber = job.attemptsStarted || job.attemptsMade + 1;
            const isFinalAttempt = attemptNumber >= maxAttempts;
            if (isFinalAttempt) {
                if (error instanceof session_expired_error_js_1.SessionExpiredError) {
                    await this.notificationsService.notifySessionExpired(university.displayName, university.id);
                }
                else {
                    await this.notificationsService.notifyFailed(university.displayName, studentName, message);
                }
            }
            throw error;
        }
    }
    async runStep(applicationId, step, context) {
        await this.prisma.applicationStep.updateMany({
            where: {
                applicationId,
                status: 'processing',
            },
            data: {
                status: 'failed',
                errorMessage: 'superseded by new attempt',
                completedAt: new Date(),
            },
        });
        const record = await this.prisma.applicationStep.create({
            data: {
                applicationId,
                stepName: step.name,
                status: 'processing',
                startedAt: new Date(),
            },
        });
        try {
            await step.execute(context);
            await this.prisma.applicationStep.update({
                where: { id: record.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });
        }
        catch (error) {
            await this.prisma.applicationStep.update({
                where: { id: record.id },
                data: {
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    completedAt: new Date(),
                },
            });
            throw error;
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
    async getGeneratedDocumentContent(id) {
        const document = await this.prisma.generatedDocument.findUnique({
            where: { id },
            select: { content: true },
        });
        return document?.content;
    }
    toStudentProfile(student) {
        const documents = (0, shared_1.groupDocumentUrls)(student.documents ?? []);
        return {
            id: student.id,
            onboardingStep: student.onboardingStep,
            personal: {
                surname: student.surname,
                givenName: student.givenName,
                sex: student.sex ?? undefined,
                nationality: student.nationality ?? undefined,
                cityOfBirth: student.cityOfBirth ?? undefined,
                dateOfBirth: toDateOnly(student.dateOfBirth),
                chineseName: student.chineseName ?? undefined,
                religion: student.religion ?? undefined,
                passportNo: student.passportNo ?? undefined,
                passportExpiry: toDateOnly(student.passportExpiry),
                consulate: student.consulate ?? undefined,
                maritalStatus: student.maritalStatus ?? undefined,
                email: student.email,
                phone: student.phone ?? undefined,
                hobby: student.hobby ?? undefined,
                permanentAddress: student.permanentAddress ?? undefined,
                postCode: student.postCode ?? undefined,
                currentInstitution: student.currentInstitution ?? undefined,
                beenToChina: student.beenToChina,
                studiedInChina: student.studiedInChina,
            },
            education: [...student.education]
                .sort((a, b) => {
                const rank = (level) => level === 'higher' ? 0 : level === 'school' ? 1 : 2;
                return rank(a.level) - rank(b.level);
            })
                .map((education) => ({
                level: education.level === 'school' || education.level === 'higher'
                    ? education.level
                    : undefined,
                degree: education.degree ?? undefined,
                institution: education.institution ?? undefined,
                major: education.major ?? undefined,
                periodStart: toDateOnly(education.periodStart),
                periodEnd: toDateOnly(education.periodEnd),
            })),
            workExperience: student.workExperience.map((workExperience) => ({
                company: workExperience.company,
                position: workExperience.position ?? undefined,
                periodStart: toDateOnly(workExperience.periodStart),
                periodEnd: toDateOnly(workExperience.periodEnd),
            })),
            languages: student.languageSkills.map((languageSkill) => ({
                language: languageSkill.language,
                certificate: languageSkill.certificate ?? undefined,
                score: languageSkill.score ?? undefined,
                level: languageSkill.level ?? undefined,
            })),
            familyMembers: student.familyMembers.map((familyMember) => ({
                fullName: familyMember.fullName,
                relationship: familyMember.relationship,
                nationality: familyMember.nationality ?? undefined,
                age: familyMember.age ?? undefined,
                company: familyMember.company ?? undefined,
                position: familyMember.position ?? undefined,
                phone: familyMember.phone ?? undefined,
                email: familyMember.email ?? undefined,
            })),
            guarantor: student.guarantor
                ? {
                    name: student.guarantor.name,
                    relationship: student.guarantor.relationship,
                    nationality: student.guarantor.nationality ?? undefined,
                    company: student.guarantor.company ?? undefined,
                    position: student.guarantor.position ?? undefined,
                    homeAddress: student.guarantor.homeAddress ?? undefined,
                    phone: student.guarantor.phone ?? undefined,
                    email: student.guarantor.email ?? undefined,
                }
                : undefined,
            emergencyContact: student.emergencyContact
                ? {
                    name: student.emergencyContact.name,
                    relationship: student.emergencyContact.relationship,
                    nationality: student.emergencyContact.nationality ?? undefined,
                    company: student.emergencyContact.company ?? undefined,
                    homeAddress: student.emergencyContact.homeAddress ?? undefined,
                    phone: student.emergencyContact.phone ?? undefined,
                    email: student.emergencyContact.email ?? undefined,
                }
                : undefined,
            documents,
            applicationTargets: student.applicationTargets.map((target) => ({
                universityRaw: target.universityRaw,
                universityId: target.universityId ?? undefined,
                degree: target.degree ?? undefined,
                major: target.major ?? undefined,
                duration: target.duration ?? undefined,
                fundingSource: target.fundingSource ?? undefined,
            })),
        };
    }
    getStudentName(profile) {
        return [profile.personal.givenName, profile.personal.surname]
            .filter(Boolean)
            .join(' ');
    }
};
exports.Processor = Processor;
exports.Processor = Processor = Processor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        browser_service_js_1.BrowserService,
        screenshot_service_js_1.ScreenshotService,
        open_form_step_js_1.OpenFormStep,
        fill_fields_step_js_1.FillFieldsStep,
        attach_files_step_js_1.AttachFilesStep,
        submit_form_step_js_1.SubmitFormStep,
        fill_wizard_step_js_1.FillWizardStep,
        log_result_step_js_1.LogResultStep,
        notifications_service_js_1.NotificationsService,
        university_schema_service_js_1.UniversitySchemaService])
], Processor);
function toDateOnly(value) {
    if (!value)
        return undefined;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime()))
            return undefined;
        return value.toISOString().slice(0, 10);
    }
    const trimmed = String(value).trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso?.[1] ?? trimmed;
}
//# sourceMappingURL=processor.js.map