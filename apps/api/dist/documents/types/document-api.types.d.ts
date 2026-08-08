export type DocumentParseStatus = 'pending' | 'processing' | 'parsed' | 'uploaded' | 'failed';
export type StudentDocumentResponse = {
    id: string;
    studentId: string;
    type: string;
    fileUrl: string;
    parsedData?: unknown;
    parseStatus: string;
    sortOrder: number;
    uploadedAt: string;
};
export type CreateDocumentInput = {
    type: string;
    fileUrl: string;
    parsedData?: unknown;
    parseStatus?: DocumentParseStatus;
    sortOrder?: number;
};
export type UpdateDocumentInput = Partial<CreateDocumentInput>;
export type ReorderDocumentsInput = {
    type: string;
    orderedIds: string[];
};
export type UploadedDocumentFile = {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
};
export type DocumentParseJobData = {
    documentId: string;
};
