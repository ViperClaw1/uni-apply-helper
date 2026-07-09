"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let ParserService = class ParserService {
    prisma;
    configService;
    gemini;
    model;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (apiKey) {
            this.gemini = new genai_1.GoogleGenAI({ apiKey });
        }
        this.model =
            this.configService.get('GEMINI_DOCUMENT_MODEL') || 'gemini-2.5-flash';
    }
    async parseDocument(documentId) {
        const document = await this.prisma.studentDocument.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new common_1.NotFoundException(`Document "${documentId}" was not found.`);
        }
        if (!this.gemini) {
            throw new common_1.ServiceUnavailableException('GEMINI_API_KEY is not configured.');
        }
        await this.prisma.studentDocument.update({
            where: { id: documentId },
            data: { parseStatus: 'processing' },
        });
        try {
            const parsedData = await this.parseWithGemini(document);
            const updatedDocument = await this.prisma.studentDocument.update({
                where: { id: documentId },
                data: {
                    parsedData: parsedData,
                    parseStatus: 'parsed',
                },
            });
            return this.toResponse(updatedDocument);
        }
        catch (error) {
            await this.prisma.studentDocument.update({
                where: { id: documentId },
                data: {
                    parseStatus: 'failed',
                    parsedData: {
                        error: error instanceof Error ? error.message : 'Unknown parse error',
                    },
                },
            });
            throw error;
        }
    }
    async parseWithGemini(document) {
        const source = await this.fetchDocumentSource(document.fileUrl);
        const response = await this.gemini.models.generateContent({
            model: this.model,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: [
                                'Extract structured data from this student application document.',
                                `Document type: ${document.type}`,
                                'Return only valid JSON. Do not wrap it in markdown.',
                            ].join('\n'),
                        },
                        source,
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
            },
        });
        return this.parseJsonObject(response.text ?? '');
    }
    async fetchDocumentSource(fileUrl) {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to download document: ${response.status}`);
        }
        const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
        const data = Buffer.from(await response.arrayBuffer()).toString('base64');
        return {
            inlineData: {
                mimeType,
                data,
            },
        };
    }
    parseJsonObject(text) {
        const normalizedText = this.stripMarkdownFence(text);
        const parsed = JSON.parse(normalizedText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Gemini response is not a JSON object.');
        }
        return parsed;
    }
    stripMarkdownFence(text) {
        return text
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');
    }
    toResponse(document) {
        return {
            id: document.id,
            studentId: document.studentId,
            type: document.type,
            fileUrl: document.fileUrl,
            parsedData: document.parsedData ?? undefined,
            parseStatus: document.parseStatus,
            uploadedAt: document.uploadedAt.toISOString(),
        };
    }
};
exports.ParserService = ParserService;
exports.ParserService = ParserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        config_1.ConfigService])
], ParserService);
//# sourceMappingURL=parser.service.js.map