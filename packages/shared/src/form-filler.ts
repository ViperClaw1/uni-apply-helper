import type { StudentProfile } from './student.types.js';
import type { FieldConfig, UniversitySchema } from './university.types.js';

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) {
      return undefined;
    }

    if (Array.isArray(acc)) {
      const index = Number(key);
      return Number.isInteger(index) ? acc[index] : undefined;
    }

    if (typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }

    return undefined;
  }, obj);
}

export function getFieldValue(
  profile: StudentProfile,
  field: FieldConfig,
  motivationLetterContent?: string,
): unknown {
  if (field.type === 'essay' && !field.mapsTo) {
    return motivationLetterContent;
  }

  if (!field.mapsTo) {
    return undefined;
  }

  return getByPath(profile, field.mapsTo);
}

export function fieldsForStep(
  schema: UniversitySchema,
  step: number,
): FieldConfig[] {
  return schema.fields.filter((field) => (field.wizardStep ?? 1) === step);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
}
