import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import type {
  FieldConfig,
  StudentProfile,
  UniversitySchema,
} from '@uni-apply/shared';
import { Job, Worker } from 'bullmq';
import { dirname, join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { BrowserService } from './browser/browser.service.js';
import { SessionExpiredError } from './errors/session-expired.error.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { getRedisConnection } from './queue/redis.config.js';
import { ScreenshotService } from './screenshot/screenshot.service.js';
import { AttachFilesStep } from './steps/attach-files.step.js';
import { FillFieldsStep } from './steps/fill-fields.step.js';
import { FillWizardStep } from './steps/fill-wizard.step.js';
import { LogResultStep } from './steps/log-result.step.js';
import { OpenFormStep } from './steps/open-form.step.js';
import { SubmitFormStep } from './steps/submit-form.step.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './steps/step-context.js';
import { ValidateSchemaStep } from './steps/validate-schema.step.js';

type ApplicationProcessJobData = {
  applicationId: string;
  batchId: string;
  studentId: string;
  universityId: string;
};

@Injectable()
export class Processor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Processor.name);
  private worker?: Worker<ApplicationProcessJobData>;
  private readonly steps: ApplicationPipelineStep[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly browserService: BrowserService,
    private readonly screenshotService: ScreenshotService,
    private readonly openFormStep: OpenFormStep,
    private readonly validateSchemaStep: ValidateSchemaStep,
    private readonly fillFieldsStep: FillFieldsStep,
    private readonly attachFilesStep: AttachFilesStep,
    private readonly submitFormStep: SubmitFormStep,
    private readonly fillWizardStep: FillWizardStep,
    private readonly logResultStep: LogResultStep,
    private readonly notificationsService: NotificationsService,
  ) {
    this.steps = [
      this.openFormStep,
      this.validateSchemaStep,
      this.fillFieldsStep,
      this.attachFilesStep,
      this.submitFormStep,
      this.logResultStep,
    ];
  }

  private getSteps(university: UniversitySchema): ApplicationPipelineStep[] {
    if (university.wizard) {
      return [this.openFormStep, this.fillWizardStep, this.logResultStep];
    }

    return this.steps;
  }

  onModuleInit() {
    this.worker = new Worker<ApplicationProcessJobData>(
      QUEUES.APPLICATION_PROCESS,
      (job) => this.process(job),
      {
        connection: getRedisConnection(),
      },
    );

    this.logger.log(`Listening on queue "${QUEUES.APPLICATION_PROCESS}"`);

    this.worker.on('active', (job) => {
      this.logger.log(`Picked up application job ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Application job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<ApplicationProcessJobData>) {
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
        const context: ApplicationStepContext = {
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
            context.screenshotBefore = await this.screenshotService.capture(
              page,
              application.id,
              'before',
            );

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
        await this.notificationsService.notifySubmitted(
          university.displayName,
          studentName,
          context.screenshotAfter,
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.application.update({
        where: { id: application.id },
        data: {
          status: 'failed',
          errorMessage: message,
        },
      });
      await this.recalculateBatchCounters(application.batchId);

      if (error instanceof SessionExpiredError) {
        await this.notificationsService.notifySessionExpired(
          university.displayName,
        );
      } else {
        await this.notificationsService.notifyFailed(
          university.displayName,
          studentName,
          message,
        );
      }

      throw error;
    }
  }

  private async runStep(
    applicationId: string,
    step: ApplicationPipelineStep,
    context: ApplicationStepContext,
  ): Promise<void> {
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
    } catch (error) {
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

  private async recalculateBatchCounters(batchId: string): Promise<void> {
    const applications = await this.prisma.application.findMany({
      where: { batchId },
      select: { status: true },
    });
    const submitted = applications.filter(
      (application) => application.status === 'submitted',
    ).length;
    const blocked = applications.filter(
      (application) => application.status === 'blocked',
    ).length;
    const failed = applications.filter(
      (application) => application.status === 'failed',
    ).length;
    const status =
      applications.length > 0 &&
      applications.every((application) =>
        ['submitted', 'blocked', 'failed'].includes(application.status),
      )
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

  private async getGeneratedDocumentContent(id: string): Promise<string | undefined> {
    const document = await this.prisma.generatedDocument.findUnique({
      where: { id },
      select: { content: true },
    });

    return document?.content;
  }

  private async getUniversitySchema(universityId: string): Promise<UniversitySchema> {
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

  private async findFileSchema(
    universityId: string,
  ): Promise<UniversitySchema | null> {
    const dir = await this.findSchemasDirectory();

    if (!dir) {
      return null;
    }

    const files = (await readdir(dir, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json'),
    );

    for (const file of files) {
      const raw = await readFile(join(dir, file.name), 'utf8');
      const schema = JSON.parse(raw) as Partial<UniversitySchema>;

      if (schema.id === universityId) {
        return {
          id: schema.id,
          displayName: schema.displayName ?? universityId,
          formUrl: schema.formUrl ?? '',
          requiredDocuments: this.toStringArray(schema.requiredDocuments),
          fields: this.toFieldConfigArray(schema.fields),
          wizard: schema.wizard,
          requiresEssay: schema.requiresEssay ?? false,
          essayPrompt: schema.essayPrompt,
          notes: schema.notes,
        };
      }
    }

    return null;
  }

  private async findSchemasDirectory(): Promise<string | null> {
    let currentDir = process.cwd();

    while (true) {
      const candidate = join(currentDir, 'data', 'university-schemas');

      try {
        await readdir(candidate);
        return candidate;
      } catch {
        const parent = dirname(currentDir);

        if (parent === currentDir) {
          return null;
        }

        currentDir = parent;
      }
    }
  }

  private toStudentProfile(student: any): StudentProfile {
    const documents = student.documents.reduce(
      (acc: Record<string, string>, document: any) => {
        acc[document.type] = document.fileUrl;
        return acc;
      },
      {},
    );

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
      education: student.education.map((education: any) => ({
        degree: education.degree,
        institution: education.institution,
        major: education.major ?? undefined,
        periodStart: education.periodStart?.toISOString(),
        periodEnd: education.periodEnd?.toISOString(),
      })),
      workExperience: student.workExperience.map((workExperience: any) => ({
        company: workExperience.company,
        position: workExperience.position ?? undefined,
        periodStart: workExperience.periodStart?.toISOString(),
        periodEnd: workExperience.periodEnd?.toISOString(),
      })),
      languages: student.languageSkills.map((languageSkill: any) => ({
        language: languageSkill.language,
        certificate: languageSkill.certificate ?? undefined,
        score: languageSkill.score ?? undefined,
        level: languageSkill.level ?? undefined,
      })),
      familyMembers: student.familyMembers.map((familyMember: any) => ({
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
      applicationTargets: student.applicationTargets.map((target: any) => ({
        universityRaw: target.universityRaw,
        universityId: target.universityId ?? undefined,
        degree: target.degree ?? undefined,
        major: target.major ?? undefined,
        duration: target.duration ?? undefined,
        fundingSource: target.fundingSource ?? undefined,
      })),
    };
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toFieldConfigArray(value: unknown): FieldConfig[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is FieldConfig => this.isFieldConfig(item));
  }

  private isFieldConfig(value: unknown): value is FieldConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const field = value as Partial<FieldConfig>;

    return (
      typeof field.selector === 'string' &&
      (typeof field.mapsTo === 'string' || field.mapsTo === null) &&
      typeof field.type === 'string' &&
      typeof field.required === 'boolean'
    );
  }

  private getStudentName(profile: StudentProfile): string {
    return [profile.personal.givenName, profile.personal.surname]
      .filter(Boolean)
      .join(' ');
  }
}

