import type { StudentProfile, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';

export type ApplicationStepContext = {
  applicationId: string;
  batchId: string;
  studentId: string;
  universityId: string;
  profile: StudentProfile;
  university: UniversitySchema;
  motivationLetterContent?: string;
  page: Page;
  screenshotBefore?: string;
  screenshotAfter?: string;
};

export type ApplicationPipelineStep = {
  readonly name: string;
  execute(context: ApplicationStepContext): Promise<void>;
};

