import type { ActiveApplicationResponse } from './api';

export type StorageConfig = {
  apiBaseUrl?: string;
  apiKey?: string;
  activeStudentId?: string;
  activeApplicationId?: string;
};

export type FieldFillResult = {
  selector: string;
  status: 'filled' | 'missing' | 'skipped';
  label?: string;
};

export type FillSession = {
  applicationId: string;
  studentName: string;
  universityName: string;
  results: FieldFillResult[];
  wizardStep?: number;
  wizardTotalSteps?: number;
  submitted?: boolean;
};

export type RuntimeMessage =
  | { type: 'GET_ACTIVE_APPLICATION'; url: string }
  | { type: 'SUBMIT_CONFIRMED'; applicationId: string }
  | { type: 'FETCH_DOCUMENT'; url: string }
  | { type: 'SET_ACTIVE_CONTEXT'; studentId: string; applicationId: string }
  | { type: 'FIELDS_FILLED'; session: FillSession }
  | { type: 'GET_FILL_SESSION' }
  | { type: 'CONFIRM_SUBMIT'; applicationId: string }
  | { type: 'GET_CONFIG' }
  | { type: 'SAVE_CONFIG'; config: Pick<StorageConfig, 'apiBaseUrl' | 'apiKey'> }
  | { type: 'TEST_CONNECTION' };

export type RuntimeResponse = {
  ok: boolean;
  error?: string;
  application?: ActiveApplicationResponse | null;
  buffer?: ArrayBuffer;
  mimeType?: string;
  fileName?: string;
  config?: StorageConfig;
  session?: FillSession | null;
  connected?: boolean;
};
