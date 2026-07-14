import type { ApplicationTarget } from "@/features/students/types/student.types";
import type { MotivationLetter } from "../types/letter.types";

export function isMissingApprovedMotivationLetter(blockedReason?: string) {
  return blockedReason?.toLowerCase().includes("approved motivation letter") ?? false;
}

export function getUniversityLabel(
  targets: ApplicationTarget[],
  universityId: string,
) {
  const target = targets.find((item) => item.universityId === universityId);

  return target?.universityRaw ?? universityId;
}

export function canApproveLetter(
  letter: MotivationLetter,
  studentId: string,
  confirmed: boolean,
) {
  return (
    confirmed &&
    letter.studentId === studentId &&
    !letter.approvedByConsultant &&
    letter.content.trim().length > 0
  );
}

export function formatLetterPreview(content: string, maxLength = 160) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}
