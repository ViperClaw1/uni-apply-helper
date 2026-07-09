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
  options?: string[];
  essayPrompt?: string;
  documentType?: string;
}

export interface UniversitySchema {
  id: string;
  displayName: string;
  formUrl: string;
  requiredDocuments: string[];
  fields: FieldConfig[];
  requiresEssay: boolean;
  essayPrompt?: string;
  notes?: string;
}
