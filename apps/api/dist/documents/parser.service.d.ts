import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StudentDocumentResponse } from './types/document-api.types.js';
export declare class ParserService {
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private readonly gemini?;
    private readonly model;
    constructor(prisma: PrismaService, configService: ConfigService);
    parseDocument(documentId: string): Promise<StudentDocumentResponse>;
    private parseWithGemini;
    private generateGeminiContent;
    private getModelCandidates;
    private isGeminiModelNotFoundError;
    private isGeminiOverloadedError;
    private delay;
    private toGeminiUnavailableException;
    private isParseableDocument;
    private getParsePrompt;
    private updateEmptyStudentPassportFields;
    private readString;
    private readDate;
    private fetchDocumentSource;
    private parseJsonObject;
    private stripMarkdownFence;
    private toResponse;
}
