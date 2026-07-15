import { Injectable } from '@nestjs/common';
import type { FieldConfig, UniversitySchema } from '@uni-apply/shared';

@Injectable()
export class WizardFieldGroups {
  fieldsForStep(university: UniversitySchema, step: number): FieldConfig[] {
    return university.fields.filter((field) => (field.wizardStep ?? 1) === step);
  }

  isWizard(university: UniversitySchema): boolean {
    return Boolean(university.wizard);
  }
}
