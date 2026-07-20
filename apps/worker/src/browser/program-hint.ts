import type { StudentProfile } from '@uni-apply/shared';

export function resolveProgramHint(
  profile: StudentProfile,
  universityId: string,
): string | undefined {
  const target =
    profile.applicationTargets.find(
      (applicationTarget) => applicationTarget.universityId === universityId,
    ) ??
    profile.applicationTargets.find((applicationTarget) =>
      new RegExp(universityId.replace(/-/g, '[\\s-]'), 'i').test(
        applicationTarget.universityRaw,
      ),
    );

  if (!target) {
    return undefined;
  }

  const parts = [target.major, target.degree].filter(Boolean);
  return parts.length > 0 ? parts.join(' ').trim() : undefined;
}
