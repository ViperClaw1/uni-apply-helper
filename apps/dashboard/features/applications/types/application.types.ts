export type ApplicationStatus =
  | "queued"
  | "ready_for_submission"
  | "blocked"
  | "submitted"
  | "failed"
  | string;

export type ApplicationBatchStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | string;

export type ApplicationStep = {
  id: string;
  applicationId: string;
  stepName: string;
  status: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

export type ApplicationItem = {
  id: string;
  batchId: string;
  universityId: string;
  universityDisplayName?: string;
  formUrl?: string;
  status: ApplicationStatus;
  blockedReason?: string;
  errorMessage?: string;
  createdAt: string;
  submittedAt?: string;
  steps: ApplicationStep[];
};

export type ApplicationBatch = {
  id: string;
  studentId: string;
  status: ApplicationBatchStatus;
  total: number;
  submitted: number;
  blocked: number;
  failed: number;
  createdAt: string;
  applications: ApplicationItem[];
};
