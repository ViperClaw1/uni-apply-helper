import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StudentDocumentResponse } from './types/document-api.types.js';
export declare class ParserService {
    private readonly prisma;
    private readonly configService;
    private readonly gemini?;
    private readonly model;
    constructor(prisma: PrismaService, configService: ConfigService);
    parseDocument(documentId: string): Promise<StudentDocumentResponse>;
    private parseWithGemini;
    private toGeminiUnavailableException;
    private fetchDocumentSource;
    private parseJsonObject;
    private stripMarkdownFence;
    private toResponse;
}
