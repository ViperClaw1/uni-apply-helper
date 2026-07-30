import type { StudentProfile } from './student.types.js';
export type EducationEntry = StudentProfile['education'][number];
/** Highest / most relevant education for uni form autofill (prefer higher). */
export declare function primaryEducation(profile: Pick<StudentProfile, 'education'>): EducationEntry | undefined;
export declare function schoolEducation(profile: Pick<StudentProfile, 'education'>): EducationEntry | undefined;
