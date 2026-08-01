import type { DocumentTypeOption } from "../types/document.types";

export const DEFAULT_DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    key: "photo",
    label: "Фото 3x4",
    accept: { "image/*": [] },
    parse: false,
  },
  {
    key: "passport",
    label: "Загранпаспорт",
    accept: { "application/pdf": [".pdf"], "image/*": [] },
    parse: true,
  },
  {
    key: "transcript",
    label: "Аттестат с оценками + перевод",
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
    label: "Медицинская справка",
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
    label: "Справка о финансовой состоятельности",
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    parse: false,
  },
  {
    key: "criminal_record",
    label: "Справка о несудимости",
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
    label: "Рекомендации / Портфолио / Языковые сертификаты",
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
    label: "Диплом / Diploma",
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
    label: "Рекомендательное письмо / Recommendation Letter",
    accept: { "application/pdf": [".pdf"], "image/*": [] },
    parse: false,
  },
  {
    key: "personal_statement",
    label: "Personal Statement / Мотивационное письмо",
    accept: { "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    parse: false,
  },
];
