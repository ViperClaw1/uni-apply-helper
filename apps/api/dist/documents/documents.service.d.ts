import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDocumentInput, StudentDocumentResponse, UpdateDocumentInput, UploadedDocumentFile } from './types/document-api.types.js';
export declare class DocumentsService {
    private readonly prisma;
    private readonly configService;
    private readonly s3?;
    private readonly bucket?;
    private readonly publicUrl?;
    constructor(prisma: PrismaService, configService: ConfigService);
    findByStudent(studentId: string): Promise<StudentDocumentResponse[]>;
    findOne(id: string): Promise<StudentDocumentResponse>;
    create(studentId: string, input: CreateDocumentInput): Promise<StudentDocumentResponse>;
    upload(studentId: string, type: string | undefined, file: UploadedDocumentFile | undefined): Promise<StudentDocumentResponse>;
    update(id: string, input: UpdateDocumentInput): Promise<StudentDocumentResponse>;
    remove(id: string): Promise<StudentDocumentResponse>;
    private ensureStudentExists;
    private assertDocumentInput;
    private uploadToStorage;
    private toJsonInput;
    private toResponse;
    private slugify;
}
