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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let ParserService = class ParserService {
    prisma;
    configService;
    anthropic;
    model;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        const apiKey = this.configService.get('ANTHROPIC_API_KEY');
        if (apiKey) {
            this.anthropic = new sdk_1.default({ apiKey });
        }
        this.model =
            this.configService.get('ANTHROPIC_DOCUMENT_MODEL') ??
                'claude-sonnet-4-5';
    }
    async parseDocument(documentId) {
        const document = await this.prisma.studentDocument.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new common_1.NotFoundException(`Document "${documentId}" was not found.`);
        }
        if (!this.anthropic) {
            throw new common_1.ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');
        }
        await this.prisma.studentDocument.update({
            where: { id: documentId },
            data: { parseStatus: 'processing' },
        });
        try {
            const parsedData = await this.parseWithClaude(document);
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
    async parseWithClaude(document) {
        const source = await this.fetchDocumentSource(document.fileUrl);
        const content = [
            {
                type: 'text',
                text: [
                    'Extract structured data from this student application document.',
                    `Document type: ${document.type}`,
                    'Return only valid JSON. Do not wrap it in markdown.',
                ].join('\n'),
            },
            source,
        ];
        const message = await this.anthropic.messages.create({
            model: this.model,
            max_tokens: 2048,
            messages: [
                {
                    role: 'user',
                    content: content,
                },
            ],
        });
        const text = message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n')
            .trim();
        return this.parseJsonObject(text);
    }
    async fetchDocumentSource(fileUrl) {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to download document: ${response.status}`);
        }
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const data = Buffer.from(await response.arrayBuffer()).toString('base64');
        if (contentType.startsWith('image/')) {
            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: contentType,
                    data,
                },
            };
        }
        return {
            type: 'document',
            source: {
                type: 'base64',
                media_type: contentType,
                data,
            },
        };
    }
    parseJsonObject(text) {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Claude response is not a JSON object.');
        }
        return parsed;
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