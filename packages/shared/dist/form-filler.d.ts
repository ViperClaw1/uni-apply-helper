import type { StudentProfile } from './student.types.js';
import type { FieldConfig, UniversitySchema } from './university.types.js';
/** Normalize mapsTo to an ordered list of profile paths. */
export declare function mapsToPaths(mapsTo: FieldConfig['mapsTo']): string[];
export declare function getFieldValue(profile: StudentProfile, field: FieldConfig, motivationLetterContent?: string): unknown;
export declare function fieldsForStep(schema: UniversitySchema, step: number): FieldConfig[];
export declare function toBoolean(value: unknown): boolean;
