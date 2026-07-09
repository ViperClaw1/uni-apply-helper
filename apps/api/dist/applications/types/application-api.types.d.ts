export type ApplicationStatus = 'queued' | 'blocked' | 'submitted' | 'failed';
export type ApplicationBatchStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type CreateApplicationBatchInput = {
    studentId: string;
};
export type UpdateApplicationInput = {
    status?: ApplicationStatus;
    blockedReason?: string | null;
    motivationLetterId?: string | null;
    screenshotBefore?: string | null;
    screenshotAfter?: string | null;
    submittedAt?: string | null;
    errorMessage?: string | null;
};
export type ApplicationProcessJobData = {
    applicationId: string;
    batchId: string;
    studentId: string;
    universityId: string;
};
export type ApplicationStepResponse = {
    id: string;
    applicationId: string;
    stepName: string;
    status: string;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
};
export type ApplicationResponse = {
    id: string;
    batchId: string;
    universityId: string;
    status: string;
    blockedReason?: string;
    motivationLetterId?: string;
    screenshotBefore?: string;
    screenshotAfter?: string;
    submittedAt?: string;
    errorMessage?: string;
    createdAt: string;
    steps: ApplicationStepResponse[];
};
export type ApplicationBatchResponse = {
    id: string;
    studentId: string;
    status: string;
    total: number;
    submitted: number;
    blocked: number;
    failed: number;
    createdAt: string;
    applications: ApplicationResponse[];
};
