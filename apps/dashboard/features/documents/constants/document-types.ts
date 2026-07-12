import type { DocumentTypeOption } from "../types/document.types";

export const DEFAULT_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { key: "passport", label: "Паспорт" },
  { key: "transcript", label: "Транскрипт" },
  { key: "cv", label: "CV / Резюме" },
  { key: "recommendation", label: "Рекомендательное письмо" },
];
