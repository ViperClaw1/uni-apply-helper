import type { FieldConfig, UniversitySchema } from '@uni-apply/shared';
export declare class WizardFieldGroups {
    fieldsForStep(university: UniversitySchema, step: number): FieldConfig[];
    isWizard(university: UniversitySchema): boolean;
}
