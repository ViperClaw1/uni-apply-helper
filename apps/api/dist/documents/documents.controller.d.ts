import { DocumentsService } from './documents.service.js';
import type { CreateDocumentInput, UpdateDocumentInput } from './types/document-api.types.js';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    findByStudent(studentId: string): Promise<import("./types/document-api.types.js").StudentDocumentResponse[]>;
    create(studentId: string, body: CreateDocumentInput): Promise<import("./types/document-api.types.js").StudentDocumentResponse>;
    upload(studentId: string, type: string | undefined, file: Express.Multer.File | undefined): Promise<import("./types/document-api.types.js").StudentDocumentResponse>;
    findOne(id: string): Promise<import("./types/document-api.types.js").StudentDocumentResponse>;
    update(id: string, body: UpdateDocumentInput): Promise<import("./types/document-api.types.js").StudentDocumentResponse>;
    remove(id: string): Promise<import("./types/document-api.types.js").StudentDocumentResponse>;
}
