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
const node_path_1 = require("node:path");
const promises_1 = require("node:fs/promises");
const browser_service_js_1 = require("./browser/browser.service.js");
const notifications_service_js_1 = require("./notifications/notifications.service.js");
const prisma_service_js_1 = require("./prisma/prisma.service.js");
const redis_config_js_1 = require("./queue/redis.config.js");
const screenshot_service_js_1 = require("./screenshot/screenshot.service.js");
const attach_files_step_js_1 = require("./steps/attach-files.step.js");
const fill_fields_step_js_1 = require("./steps/fill-fields.step.js");
const log_result_step_js_1 = require("./steps/log-result.step.js");
const open_form_step_js_1 = require("./steps/open-form.step.js");
const submit_form_step_js_1 = require("./steps/submit-form.step.js");
const validate_schema_step_js_1 = require("./steps/validate-schema.step.js");
let Processor = Processor_1 = class Processor {
    prisma;
    browserService;
    screenshotService;
    openFormStep;
    validateSchemaStep;
    fillFieldsStep;
    attachFilesStep;
    submitFormStep;
    logResultStep;
    notificationsService;
    logger = new common_1.Logger(Processor_1.name);
    worker;
    steps;
    constructor(prisma, browserService, screenshotService, openFormStep, validateSchemaStep, fillFieldsStep, attachFilesStep, submitFormStep, logResultStep, notificationsService) {
        this.prisma = prisma;
        this.browserService = browserService;
        this.screenshotService = screenshotService;
        this.openFormStep = openFormStep;
        this.validateSchemaStep = validateSchemaStep;
        this.fillFieldsStep = fillFieldsStep;
        this.attachFilesStep = attachFilesStep;
        this.submitFormStep = submitFormStep;
        this.logResultStep = logResultStep;
        this.notificationsService = notificationsService;
        this.steps = [
            this.openFormStep,
            this.validateSchemaStep,
            this.fillFieldsStep,
            this.attachFilesStep,
            this.submitFormStep,
            this.logResultStep,
        ];
    }
    onModuleInit() {
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.APPLICATION_PROCESS, (job) => this.process(job), {
            connection: (0, redis_config_js_1.getRedisConnection)(),
        });
        this.worker.on('failed', (job, error) => {
            this.logger.error(`Application job ${job?.id ?? 'unknown'} failed: ${error.message}`);
        });
    }
    async onModuleDestroy() {
        await this.worker?.close();
    }
    async process(job) {
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
        const university = await this.getUniversitySchema(application.universityId);
        const motivationLetterContent = application.motivationLetterId
            ? await this.getGeneratedDocumentContent(application.motivationLetterId)
            : undefined;
        const studentName = this.getStudentName(profile);
        await this.prisma.application.update({
            where: { id: application.id },
            data: { status: 'processing' },
        });
        try {
            await this.browserService.withPage(async (page) => {
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
                for (const step of this.steps) {
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
            await this.notificationsService.notifyFailed(university.displayName, studentName, message);
            throw error;
        }
    }
    async runStep(applicationId, step, context) {
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
    async getUniversitySchema(universityId) {
        const university = await this.prisma.universitySchema.findUnique({
            where: { id: universityId },
        });
        if (university) {
            return {
                id: university.id,
                displayName: university.displayName,
                formUrl: university.formUrl,
                requiredDocuments: this.toStringArray(university.requiredDocuments),
                fields: this.toFieldConfigArray(university.fields),
                requiresEssay: university.requiresEssay,
                essayPrompt: university.essayPrompt ?? undefined,
                notes: university.notes ?? undefined,
            };
        }
        const fileSchema = await this.findFileSchema(universityId);
        if (!fileSchema) {
            throw new Error(`University schema "${universityId}" was not found.`);
        }
        return fileSchema;
    }
    async findFileSchema(universityId) {
        const dir = await this.findSchemasDirectory();
        if (!dir) {
            return null;
        }
        const files = (await (0, promises_1.readdir)(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
        for (const file of files) {
            const raw = await (0, promises_1.readFile)((0, node_path_1.join)(dir, file.name), 'utf8');
            const schema = JSON.parse(raw);
            if (schema.id === universityId) {
                return {
                    id: schema.id,
                    displayName: schema.displayName ?? universityId,
                    formUrl: schema.formUrl ?? '',
                    requiredDocuments: this.toStringArray(schema.requiredDocuments),
                    fields: this.toFieldConfigArray(schema.fields),
                    requiresEssay: schema.requiresEssay ?? false,
                    essayPrompt: schema.essayPrompt,
                    notes: schema.notes,
                };
            }
        }
        return null;
    }
    async findSchemasDirectory() {
        let currentDir = process.cwd();
        while (true) {
            const candidate = (0, node_path_1.join)(currentDir, 'data', 'university-schemas');
            try {
                await (0, promises_1.readdir)(candidate);
                return candidate;
            }
            catch {
                const parent = (0, node_path_1.dirname)(currentDir);
                if (parent === currentDir) {
                    return null;
                }
                currentDir = parent;
            }
        }
    }
    toStudentProfile(student) {
        const documents = student.documents.reduce((acc, document) => {
            acc[document.type] = document.fileUrl;
            return acc;
        }, {});
        return {
            id: student.id,
            personal: {
                surname: student.surname,
                givenName: student.givenName,
                sex: student.sex ?? undefined,
                nationality: student.nationality ?? undefined,
                cityOfBirth: student.cityOfBirth ?? undefined,
                dateOfBirth: student.dateOfBirth?.toISOString(),
                chineseName: student.chineseName ?? undefined,
                religion: student.religion ?? undefined,
                passportNo: student.passportNo ?? undefined,
                passportExpiry: student.passportExpiry?.toISOString(),
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
            education: student.education.map((education) => ({
                degree: education.degree,
                institution: education.institution,
                major: education.major ?? undefined,
                periodStart: education.periodStart?.toISOString(),
                periodEnd: education.periodEnd?.toISOString(),
            })),
            workExperience: student.workExperience.map((workExperience) => ({
                company: workExperience.company,
                position: workExperience.position ?? undefined,
                periodStart: workExperience.periodStart?.toISOString(),
                periodEnd: workExperience.periodEnd?.toISOString(),
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
    toStringArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item) => typeof item === 'string');
    }
    toFieldConfigArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item) => this.isFieldConfig(item));
    }
    isFieldConfig(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const field = value;
        return (typeof field.selector === 'string' &&
            (typeof field.mapsTo === 'string' || field.mapsTo === null) &&
            typeof field.type === 'string' &&
            typeof field.required === 'boolean');
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
        validate_schema_step_js_1.ValidateSchemaStep,
        fill_fields_step_js_1.FillFieldsStep,
        attach_files_step_js_1.AttachFilesStep,
        submit_form_step_js_1.SubmitFormStep,
        log_result_step_js_1.LogResultStep,
        notifications_service_js_1.NotificationsService])
], Processor);
//# sourceMappingURL=processor.js.map