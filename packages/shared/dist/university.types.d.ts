import type { AgentConfig } from './agent.types.js';
export interface FieldConfig {
    selector: string;
    /** Profile path, or fallback chain (first non-empty wins). */
    mapsTo: string | string[] | null;
    type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'essay' | 'file';
    required: boolean;
    wizardStep?: number;
    options?: string[];
    /** Map profile/raw values → option labels (or values) for selects. */
    valueMap?: Record<string, string>;
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
/** Pre-wizard navigation hints for portals that share a platform (e.g. 17gz). */
export interface NavigationHints {
    /** Label fragment to match on program-type radios, e.g. "Research Scholar" / "Self-sponsored" */
    programText?: string;
    /**
     * Student-type radio on portals that ask after program type
     * (e.g. CSU: Undergraduate / Master / Doctoral).
     */
    studentType?: string;
    /** Preferred language option when the portal asks, e.g. "English" */
    language?: string;
    /** Step 1: upload passport to OCR input + Confirm before filling fields (PKU). */
    ocrPassportUpload?: boolean;
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
    navigationHints?: NavigationHints;
    requiresEssay: boolean;
    essayPrompt?: string;
    notes?: string;
}
