import { useT } from "@/lib/i18n/context";
import type { DocumentTypeOption } from "../types/document.types";

export const DEFAULT_DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    key: "photo",
    accept: { "image/*": [] },
    parse: false,
  },
  {
    key: "passport",
    accept: { "application/pdf": [".pdf"], "image/*": [] },
    parse: true,
  },
  {
    key: "transcript",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
    multiple: true,
  },
  {
    key: "medical",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
    multiple: true,
  },
  {
    key: "financial",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
  },
  {
    key: "criminal_record",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
    multiple: true,
  },
  {
    key: "recommendation",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
    multiple: true,
  },
  {
    key: "diploma",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
    multiple: true,
  },
  {
    key: "recommendation_letter",
    accept: { "application/pdf": [".pdf"], "image/*": [] },
    parse: false,
  },
  {
    key: "personal_statement",
    accept: { "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    parse: false,
  },
];

const LABEL_KEYS = {
  photo: "photo",
  passport: "passport",
  transcript: "transcript",
  medical: "medical",
  financial: "financial",
  criminal_record: "criminalRecord",
  recommendation: "recommendation",
  diploma: "diploma",
  recommendation_letter: "recommendationLetter",
  personal_statement: "personalStatement",
} as const satisfies Record<string, keyof ReturnType<typeof useT>["documents"]["types"]>;

export function useDocumentTypeLabel() {
  const t = useT();

  return (key: string) => {
    const labelKey = LABEL_KEYS[key as keyof typeof LABEL_KEYS];
    return labelKey ? t.documents.types[labelKey] : key;
  };
}
