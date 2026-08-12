export type ApplicationStatus = 'queued' | 'ready_for_submission' | 'blocked' | 'submitted' | 'failed' | 'waiting_for_login' | 'attention_required';
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
    universityDisplayName?: string;
    formUrl?: string;
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
export type ActiveApplicationResponse = {
    applicationId: string;
    studentId: string;
    university: {
        id: string;
        displayName: string;
        formUrl: string;
    };
    profile: import('@uni-apply/shared').StudentProfile;
    schema: import('@uni-apply/shared').UniversitySchema;
    motivationLetter?: string;
};
export type SubmitApplicationInput = {
    submittedAt?: string;
};
export type ApplicationReadinessStatus = 'ready' | 'blocked' | 'submitted' | 'unresolved';
export type ApplicationReadinessResponse = {
    universityId?: string;
    universityRaw: string;
    status: ApplicationReadinessStatus;
    missingDocuments: string[];
    blockedReason?: string;
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
export type ApplicationListItemResponse = {
    id: string;
    batchId: string;
    studentId: string;
    studentName: string;
    universityId: string;
    universityDisplayName?: string;
    status: string;
    blockedReason?: string;
    submittedAt?: string;
    createdAt: string;
};
