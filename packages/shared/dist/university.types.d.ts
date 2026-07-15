export interface FieldConfig {
    selector: string;
    mapsTo: string | null;
    type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'essay' | 'file';
    required: boolean;
    wizardStep?: number;
    options?: string[];
    essayPrompt?: string;
    documentType?: string;
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
    requiresEssay: boolean;
    essayPrompt?: string;
    notes?: string;
}
