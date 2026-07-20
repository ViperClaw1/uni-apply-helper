import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StudentsService } from '../students/students.service.js';
import { UniversitiesService } from '../universities/universities.service.js';
import type { ActiveApplicationResponse, ApplicationBatchResponse, ApplicationResponse, ApplicationStepResponse, CreateApplicationBatchInput, SubmitApplicationInput, UpdateApplicationInput } from './types/application-api.types.js';
export declare class ApplicationsService {
    private readonly prisma;
    private readonly studentsService;
    private readonly universitiesService;
    private readonly notificationsService;
    constructor(prisma: PrismaService, studentsService: StudentsService, universitiesService: UniversitiesService, notificationsService: NotificationsService);
    createBatch(input: CreateApplicationBatchInput): Promise<ApplicationBatchResponse>;
    findByStudent(studentId: string): Promise<ApplicationBatchResponse[]>;
    findBatch(id: string): Promise<ApplicationBatchResponse>;
    findApplication(id: string): Promise<ApplicationResponse>;
    findActiveByUrl(url: string, studentId: string): Promise<ActiveApplicationResponse>;
    markApplicationReady(id: string): Promise<ApplicationResponse>;
    submitApplication(id: string, input?: SubmitApplicationInput): Promise<ApplicationResponse>;
    updateApplication(id: string, input: UpdateApplicationInput): Promise<ApplicationResponse>;
    addStep(applicationId: string, input: {
        stepName: string;
        status: string;
        errorMessage?: string;
    }): Promise<ApplicationStepResponse>;
    private readonly batchInclude;
    private prepareApplications;
    private resolveTarget;
    private findApprovedLetter;
    private notifyUnresolvedTargets;
    private recalculateBatchCounters;
    private toApplicationUpdateInput;
    private toBatchResponse;
    private toApplicationResponse;
    private enrichApplicationResponse;
    private toStepResponse;
    private getStudentName;
}
