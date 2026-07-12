export type DocumentParseStatus =
  | "pending"
  | "processing"
  | "parsed"
  | "failed"
  | string;

export type StudentDocument = {
  id: string;
  studentId: string;
  type: string;
  fileUrl: string;
  parsedData?: unknown;
  parseStatus: DocumentParseStatus;
  uploadedAt: string;
};

export type DocumentTypeOption = {
  key: string;
  label: string;
};
