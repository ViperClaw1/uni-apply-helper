import type { StudentDocument } from "@/features/documents/types/document.types";
import type { StudentProfile } from "../types/student.types";

export type ReadinessStatus = "done" | "missing" | "not_uploaded";

export type CategoryReadiness = {
  category: "personal" | "education" | "documents" | "language";
  status: ReadinessStatus;
  missingCount: number;
  fraction: number;
};

const PERSONAL_FIELDS: (keyof StudentProfile["personal"])[] = [
  "surname",
  "givenName",
  "email",
  "phone",
  "nationality",
  "dateOfBirth",
  "passportNo",
  "permanentAddress",
];

const REQUIRED_DOCUMENT_TYPES = ["photo", "passport", "transcript", "financial"];

export function computeProfileReadiness(
  student: StudentProfile,
  documents: StudentDocument[],
): { categories: CategoryReadiness[]; overallPercent: number } {
  const personal = computePersonalReadiness(student);
  const education = computeEducationReadiness(student);
  const documentsReadiness = computeDocumentsReadiness(documents);
  const language = computeLanguageReadiness(student);

  const categories = [personal, education, documentsReadiness, language];
  const overallPercent = Math.round(
    (categories.reduce((sum, category) => sum + category.fraction, 0) /
      categories.length) *
      100,
  );

  return { categories, overallPercent };
}

function computePersonalReadiness(student: StudentProfile): CategoryReadiness {
  const filled = PERSONAL_FIELDS.filter((field) =>
    Boolean(student.personal[field]),
  ).length;
  const missingCount = PERSONAL_FIELDS.length - filled;

  return {
    category: "personal",
    status: missingCount === 0 ? "done" : "missing",
    missingCount,
    fraction: filled / PERSONAL_FIELDS.length,
  };
}

function computeEducationReadiness(student: StudentProfile): CategoryReadiness {
  const entry =
    student.education.find((item) => item.level === "higher") ??
    student.education.find((item) => item.level === "school");

  if (!entry) {
    return { category: "education", status: "not_uploaded", missingCount: 3, fraction: 0 };
  }

  const subfields = [entry.institution, entry.periodStart, entry.periodEnd];
  const filled = subfields.filter(Boolean).length;
  const missingCount = subfields.length - filled;

  return {
    category: "education",
    status: missingCount === 0 ? "done" : "missing",
    missingCount,
    fraction: filled / subfields.length,
  };
}

function computeDocumentsReadiness(documents: StudentDocument[]): CategoryReadiness {
  const presentTypes = new Set(documents.map((document) => document.type));
  const present = REQUIRED_DOCUMENT_TYPES.filter((type) =>
    presentTypes.has(type),
  ).length;
  const missingCount = REQUIRED_DOCUMENT_TYPES.length - present;

  return {
    category: "documents",
    status: present === 0 ? "not_uploaded" : missingCount === 0 ? "done" : "missing",
    missingCount,
    fraction: present / REQUIRED_DOCUMENT_TYPES.length,
  };
}

function computeLanguageReadiness(student: StudentProfile): CategoryReadiness {
  if (student.languages.length === 0) {
    return { category: "language", status: "not_uploaded", missingCount: 1, fraction: 0 };
  }

  const hasScore = student.languages.some((language) => Boolean(language.score));

  return {
    category: "language",
    status: hasScore ? "done" : "missing",
    missingCount: hasScore ? 0 : 1,
    fraction: hasScore ? 1 : 0.5,
  };
}
