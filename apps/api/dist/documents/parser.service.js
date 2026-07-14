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
var ParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 5000;
const GEMINI_DOCUMENT_MODEL_FALLBACKS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
];
const DOCUMENT_PARSE_PROMPTS = {
    passport: [
        'Extract from this passport scan: surname, givenName, dateOfBirth,',
        'nationality, passportNo, passportExpiry, cityOfBirth.',
        'Return JSON only.',
    ].join(' '),
};
let ParserService = ParserService_1 = class ParserService {
    prisma;
    configService;
    logger = new common_1.Logger(ParserService_1.name);
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
            this.configService.get('GEMINI_DOCUMENT_MODEL') ||
                'gemini-3.5-flash';
    }
    async parseDocument(documentId) {
        const document = await this.prisma.studentDocument.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new common_1.NotFoundException(`Document "${documentId}" was not found.`);
        }
        if (!this.isParseableDocument(document.type)) {
            throw new common_1.BadRequestException(`Document type "${document.type}" does not support parsing.`);
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
            if (document.type === 'passport') {
                await this.updateEmptyStudentPassportFields(document.studentId, parsedData);
            }
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
        try {
            const response = await this.generateGeminiContent([
                {
                    role: 'user',
                    parts: [
                        {
                            text: [
                                this.getParsePrompt(document.type),
                                `Document type: ${document.type}`,
                                'Return only valid JSON. Do not wrap it in markdown.',
                            ].join('\n'),
                        },
                        source,
                    ],
                },
            ]);
            return this.parseJsonObject(response.text ?? '');
        }
        catch (error) {
            throw this.toGeminiUnavailableException(error);
        }
    }
    async generateGeminiContent(contents) {
        let lastError;
        for (const model of this.getModelCandidates()) {
            for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
                try {
                    const response = await this.gemini.models.generateContent({
                        model,
                        contents,
                        config: {
                            responseMimeType: 'application/json',
                        },
                    });
                    if (model !== this.model) {
                        this.logger.warn(`Gemini model "${this.model}" is unavailable, used fallback "${model}". Update GEMINI_DOCUMENT_MODEL.`);
                    }
                    return response;
                }
                catch (error) {
                    lastError = error;
                    if (this.isGeminiModelNotFoundError(error)) {
                        break;
                    }
                    if (this.isGeminiOverloadedError(error)) {
                        if (attempt < GEMINI_MAX_RETRIES) {
                            await this.delay(GEMINI_RETRY_BASE_DELAY_MS * attempt);
                            continue;
                        }
                        this.logger.warn(`Gemini model "${model}" is overloaded after ${GEMINI_MAX_RETRIES} attempts, trying fallback.`);
                        break;
                    }
                    throw error;
                }
            }
        }
        throw lastError;
    }
    getModelCandidates() {
        const configured = this.model;
        const fallbacks = GEMINI_DOCUMENT_MODEL_FALLBACKS.filter((model) => model !== configured);
        const isLegacyModel = /gemini-2\.[05]|gemini-1\.5/.test(configured);
        return isLegacyModel
            ? [...fallbacks, configured]
            : [configured, ...fallbacks];
    }
    isGeminiModelNotFoundError(error) {
        if (typeof error !== 'object' || error === null) {
            return false;
        }
        const err = error;
        const status = err.status ?? err.statusCode;
        if (status === 404) {
            return true;
        }
        const message = err.message ?? (error instanceof Error ? error.message : '');
        return (message.includes('NOT_FOUND') ||
            message.includes('no longer available') ||
            message.includes('is not found for API version'));
    }
    isGeminiOverloadedError(error) {
        if (typeof error !== 'object' || error === null) {
            return false;
        }
        const err = error;
        const status = err.status ?? err.statusCode;
        if (status === 503) {
            return true;
        }
        const message = err.message ?? (error instanceof Error ? error.message : '');
        return message.includes('503') || message.includes('UNAVAILABLE');
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    toGeminiUnavailableException(error) {
        const message = error instanceof Error ? error.message : 'Unknown Gemini error';
        return new common_1.ServiceUnavailableException(`Gemini document parsing failed for model "${this.model}": ${message}`);
    }
    isParseableDocument(documentType) {
        return DOCUMENT_PARSE_PROMPTS[documentType] !== undefined;
    }
    getParsePrompt(documentType) {
        const prompt = DOCUMENT_PARSE_PROMPTS[documentType];
        if (!prompt) {
            throw new common_1.BadRequestException(`Document type "${documentType}" does not support parsing.`);
        }
        return prompt;
    }
    async updateEmptyStudentPassportFields(studentId, parsedData) {
        const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: {
                surname: true,
                givenName: true,
                nationality: true,
                cityOfBirth: true,
                dateOfBirth: true,
                passportNo: true,
                passportExpiry: true,
            },
        });
        if (!student) {
            return;
        }
        const data = {};
        const surname = this.readString(parsedData, 'surname');
        const givenName = this.readString(parsedData, 'givenName');
        const nationality = this.readString(parsedData, 'nationality');
        const cityOfBirth = this.readString(parsedData, 'cityOfBirth');
        const passportNo = this.readString(parsedData, 'passportNo');
        const dateOfBirth = this.readDate(parsedData, 'dateOfBirth');
        const passportExpiry = this.readDate(parsedData, 'passportExpiry');
        if (!student.surname && surname) {
            data.surname = surname;
        }
        if (!student.givenName && givenName) {
            data.givenName = givenName;
        }
        if (!student.nationality && nationality) {
            data.nationality = nationality;
        }
        if (!student.cityOfBirth && cityOfBirth) {
            data.cityOfBirth = cityOfBirth;
        }
        if (!student.passportNo && passportNo) {
            data.passportNo = passportNo;
        }
        if (!student.dateOfBirth && dateOfBirth) {
            data.dateOfBirth = dateOfBirth;
        }
        if (!student.passportExpiry && passportExpiry) {
            data.passportExpiry = passportExpiry;
        }
        if (Object.keys(data).length === 0) {
            return;
        }
        await this.prisma.student.update({
            where: { id: studentId },
            data,
        });
    }
    readString(data, key) {
        const value = data[key];
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    }
    readDate(data, key) {
        const value = this.readString(data, key);
        if (!value) {
            return undefined;
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
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
exports.ParserService = ParserService = ParserService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        config_1.ConfigService])
], ParserService);
//# sourceMappingURL=parser.service.js.map