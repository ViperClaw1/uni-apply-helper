import type { AgentConfig } from './agent.types.js';

export interface FieldConfig {
  selector: string;
  mapsTo: string | null;
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'textarea'
    | 'essay'
    | 'file';
  required: boolean;
  wizardStep?: number;
  options?: string[];
  essayPrompt?: string;
  documentType?: string;
  /** Fallback for semantic locator: getByLabel / getByPlaceholder */
  labelHint?: string;
}

export interface SessionConfig {
  loginUrlPattern?: string;
  expiredIndicators?: string[];
}

export interface WizardConfig {
  totalSteps: number;
  nextButtonSelector: string;
  submitButtonSelector: string;
}

export interface UniversitySchema {
  id: string;
  displayName: string;
  formUrl: string;
  requiredDocuments: string[];
  fields: FieldConfig[];
  wizard?: WizardConfig;
  session?: SessionConfig;
  agent?: AgentConfig;
  /** Pre-wizard program type label, e.g. "Self-supporting Program" */
  defaultProgram?: string;
  requiresEssay: boolean;
  essayPrompt?: string;
  notes?: string;
}
