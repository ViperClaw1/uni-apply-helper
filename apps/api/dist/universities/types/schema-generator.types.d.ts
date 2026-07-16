export type DomCapturedField = {
    tag: string;
    inputType: string;
    name: string | null;
    id: string | null;
    label: string;
    placeholder: string | null;
    required: boolean;
    selector: string;
    options?: string[];
};
export type DomFileCapture = {
    label: string;
    selector: string;
    attachTypeName?: string;
    required?: boolean;
};
export type DomStepCapture = {
    url: string;
    capturedAt: string;
    wizardStep?: number;
    wizardStepTitle?: string;
    fields: DomCapturedField[];
    fileInputs?: DomFileCapture[];
    navigation?: {
        nextButtonSelector?: string;
        submitButtonSelector?: string;
        activeStepNumber?: number;
        totalStepsHint?: number;
    };
};
export type GenerateUniversitySchemaInput = {
    id: string;
    displayName: string;
    formUrl: string;
    aliases?: string[];
    captures: DomStepCapture[];
    notes?: string;
};
export type GenerateUniversitySchemaResult = {
    schema: import('./university-api.types.js').UniversitySchemaFile;
    warnings: string[];
    model: string;
};
