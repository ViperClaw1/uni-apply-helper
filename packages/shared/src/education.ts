import type { StudentProfile } from './student.types.js';

export type EducationEntry = StudentProfile['education'][number];

/** Highest / most relevant education for uni form autofill (prefer higher). */
export function primaryEducation(
  profile: Pick<StudentProfile, 'education'>,
): EducationEntry | undefined {
  const list = profile.education ?? [];
  return (
    list.find((entry) => entry.level === 'higher') ??
    list.find((entry) => entry.level === 'school') ??
    list[0]
  );
}

export function schoolEducation(
  profile: Pick<StudentProfile, 'education'>,
): EducationEntry | undefined {
  const list = profile.education ?? [];
  return list.find((entry) => entry.level === 'school') ?? list[0];
}
