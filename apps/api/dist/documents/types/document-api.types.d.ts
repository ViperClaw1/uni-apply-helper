export type DocumentParseStatus = 'pending' | 'parsed' | 'failed';
export type StudentDocumentResponse = {
    id: string;
    studentId: string;
    type: string;
    fileUrl: string;
    parsedData?: unknown;
    parseStatus: string;
    uploadedAt: string;
};
export type CreateDocumentInput = {
    type: string;
    fileUrl: string;
    parsedData?: unknown;
    parseStatus?: DocumentParseStatus;
};
export type UpdateDocumentInput = Partial<CreateDocumentInput>;
export type UploadedDocumentFile = {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
};
