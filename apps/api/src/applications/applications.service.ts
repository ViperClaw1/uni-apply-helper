import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@uni-apply/database';
import type { StudentProfile } from '@uni-apply/shared';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StudentsService } from '../students/students.service.js';
import { UniversitiesService } from '../universities/universities.service.js';
import type { UniversityMatchCandidate } from '../universities/types/university-api.types.js';
import type {
  ActiveApplicationResponse,
  ApplicationBatchResponse,
  ApplicationResponse,
  ApplicationStatus,
  ApplicationStepResponse,
  CreateApplicationBatchInput,
  SubmitApplicationInput,
  UpdateApplicationInput,
} from './types/application-api.types.js';

type ApplicationTarget = StudentProfile['applicationTargets'][number];

type ApplicationRecord = {
  id: string;
  batchId: string;
  universityId: string;
  status: string;
  blockedReason: string | null;
  motivationLetterId: string | null;
  screenshotBefore: string | null;
  screenshotAfter: string | null;
  submittedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  steps: ApplicationStepRecord[];
};

type ApplicationStepRecord = {
  id: string;
  applicationId: string;
  stepName: string;
  status: string;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type ApplicationBatchRecord = {
  id: string;
  studentId: string;
  status: string;
  total: number;
  submitted: number;
  blocked: number;
  failed: number;
  createdAt: Date;
  applications: ApplicationRecord[];
};

type PreparedApplication = {
  universityId: string;
  status: ApplicationStatus;
  blockedReason?: string;
  motivationLetterId?: string;
};

type UnresolvedTarget = {
  rawName: string;
  candidates: UniversityMatchCandidate[];
};

type PreparedBatch = {
  applications: PreparedApplication[];
  unresolvedTargets: UnresolvedTarget[];
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
    private readonly universitiesService: UniversitiesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createBatch(
    input: CreateApplicationBatchInput,
  ): Promise<ApplicationBatchResponse> {
    if (!input.studentId?.trim()) {
      throw new BadRequestException('studentId is required.');
    }

    const profile = await this.studentsService.getFullProfile(input.studentId);

    if (profile.applicationTargets.length === 0) {
      throw new BadRequestException('Student has no application targets.');
    }

    const prepared = await this.prepareApplications(profile);
    const unresolvedCount = prepared.unresolvedTargets.length;
    const blockedCount =
      prepared.applications.filter((application) => application.status === 'blocked')
        .length + unresolvedCount;

    const batch = await this.prisma.applicationBatch.create({
      data: {
        studentId: input.studentId,
        total: profile.applicationTargets.length,
        blocked: blockedCount,
        status: prepared.applications.some(
          (application) => application.status === 'ready_for_submission',
        )
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
                  status:
                    application.status === 'blocked' ? 'blocked' : 'completed',
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

    await this.notifyUnresolvedTargets(profile, prepared.unresolvedTargets);
    await this.notificationsService.notifyBatchCreated(batch, profile);

    return this.toBatchResponse(batch);
  }

  async findByStudent(studentId: string): Promise<ApplicationBatchResponse[]> {
    await this.studentsService.findOne(studentId);

    const batches = await this.prisma.applicationBatch.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: this.batchInclude,
    });

    return Promise.all(batches.map((batch) => this.toBatchResponse(batch)));
  }

  async findBatch(id: string): Promise<ApplicationBatchResponse> {
    const batch = await this.prisma.applicationBatch.findUnique({
      where: { id },
      include: this.batchInclude,
    });

    if (!batch) {
      throw new NotFoundException(`Application batch "${id}" was not found.`);
    }

    return this.toBatchResponse(batch);
  }

  async findApplication(id: string): Promise<ApplicationResponse> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!application) {
      throw new NotFoundException(`Application "${id}" was not found.`);
    }

    return this.enrichApplicationResponse(application);
  }

  async findActiveByUrl(
    url: string,
    studentId: string,
  ): Promise<ActiveApplicationResponse> {
    if (!url?.trim()) {
      throw new BadRequestException('url is required.');
    }

    if (!studentId?.trim()) {
      throw new BadRequestException('studentId is required.');
    }

    await this.studentsService.findOne(studentId);

    const university = await this.universitiesService.findByFormUrl(url);

    if (!university) {
      throw new NotFoundException('No university matches this URL.');
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
      throw new NotFoundException('No active application found for this URL.');
    }

    const profile = await this.studentsService.getFullProfile(studentId);
    const schema = await this.universitiesService.getFullSchemaForExtension(
      university.id,
    );

    let motivationLetter: string | undefined;

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

  async submitApplication(
    id: string,
    input: SubmitApplicationInput = {},
  ): Promise<ApplicationResponse> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        steps: true,
        batch: { select: { studentId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application "${id}" was not found.`);
    }

    if (application.status !== 'ready_for_submission') {
      throw new BadRequestException(
        `Application must be in ready_for_submission status. Current: ${application.status}`,
      );
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

    const profile = await this.studentsService.getFullProfile(
      application.batch.studentId,
    );
    const university = await this.universitiesService.findOne(
      application.universityId,
    );

    await this.notificationsService.notifySubmitted(
      university.displayName,
      this.getStudentName(profile),
    );

    const withSteps = await this.prisma.application.findUnique({
      where: { id },
      include: { steps: true },
    });

    return this.enrichApplicationResponse(withSteps!);
  }

  async updateApplication(
    id: string,
    input: UpdateApplicationInput,
  ): Promise<ApplicationResponse> {
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

  async addStep(
    applicationId: string,
    input: {
      stepName: string;
      status: string;
      errorMessage?: string;
    },
  ): Promise<ApplicationStepResponse> {
    await this.findApplication(applicationId);

    if (!input.stepName?.trim()) {
      throw new BadRequestException('stepName is required.');
    }

    if (!input.status?.trim()) {
      throw new BadRequestException('status is required.');
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

  private readonly batchInclude = {
    applications: {
      orderBy: { createdAt: 'asc' },
      include: { steps: true },
    },
  } satisfies Prisma.ApplicationBatchInclude;

  private async prepareApplications(
    profile: StudentProfile,
  ): Promise<PreparedBatch> {
    const applications: PreparedApplication[] = [];
    const unresolvedTargets: UnresolvedTarget[] = [];

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
      const missingDocuments = university.requiredDocuments.filter(
        (documentType) => !profile.documents[documentType],
      );
      const approvedLetter = university.requiresEssay
        ? await this.findApprovedLetter(profile.id, university.id)
        : null;
      const missing = [
        ...missingDocuments,
        university.requiresEssay && !approvedLetter
          ? 'approved motivation letter'
          : null,
      ].filter((item): item is string => item !== null);

      applications.push({
        universityId: university.id,
        status: missing.length > 0 ? 'blocked' : 'ready_for_submission',
        blockedReason:
          missing.length > 0 ? `Missing requirements: ${missing.join(', ')}` : undefined,
        motivationLetterId: approvedLetter?.id,
      });

      if (missing.length > 0) {
        const studentName = this.getStudentName(profile);
        await this.notificationsService.notifyBlocked(
          studentName,
          university.displayName,
          missing,
        );
      }
    }

    return { applications, unresolvedTargets };
  }

  private async resolveTarget(target: ApplicationTarget) {
    if (target.universityId) {
      return {
        rawName: target.universityRaw,
        university: await this.universitiesService.findOne(target.universityId),
        candidates: [],
      };
    }

    return this.universitiesService.resolve(target.universityRaw);
  }

  private async findApprovedLetter(studentId: string, universityId: string) {
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

  private async notifyUnresolvedTargets(
    profile: StudentProfile,
    unresolvedTargets: UnresolvedTarget[],
  ): Promise<void> {
    if (unresolvedTargets.length > 0) {
      await this.notificationsService.notifyUnresolved(
        this.getStudentName(profile),
        unresolvedTargets,
      );
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

  private toApplicationUpdateInput(
    input: UpdateApplicationInput,
  ): Prisma.ApplicationUpdateInput {
    return {
      status: input.status,
      blockedReason: input.blockedReason,
      motivationLetterId: input.motivationLetterId,
      screenshotBefore: input.screenshotBefore,
      screenshotAfter: input.screenshotAfter,
      submittedAt:
        input.submittedAt === undefined
          ? undefined
          : input.submittedAt
            ? new Date(input.submittedAt)
            : null,
      errorMessage: input.errorMessage,
    };
  }

  private async toBatchResponse(
    batch: ApplicationBatchRecord,
  ): Promise<ApplicationBatchResponse> {
    const applications = await Promise.all(
      batch.applications.map((application) =>
        this.enrichApplicationResponse(application),
      ),
    );

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

  private toApplicationResponse(
    application: ApplicationRecord,
  ): ApplicationResponse {
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

  private async enrichApplicationResponse(
    application: ApplicationRecord,
  ): Promise<ApplicationResponse> {
    const base = this.toApplicationResponse(application);

    try {
      const university = await this.universitiesService.findOne(
        application.universityId,
      );

      return {
        ...base,
        universityDisplayName: university.displayName,
        formUrl: university.formUrl,
      };
    } catch {
      return base;
    }
  }

  private toStepResponse(step: ApplicationStepRecord): ApplicationStepResponse {
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

  private getStudentName(profile: StudentProfile): string {
    return [profile.personal.givenName, profile.personal.surname]
      .filter(Boolean)
      .join(' ');
  }
}
