export type DocumentParseStatus =
  | "pending"
  | "processing"
  | "parsed"
  | "uploaded"
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
  accept: Record<string, string[]>;
  parse: boolean;
  multiple?: boolean;
};
