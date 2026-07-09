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
exports.LettersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const students_service_js_1 = require("../students/students.service.js");
const universities_service_js_1 = require("../universities/universities.service.js");
let LettersService = class LettersService {
    prisma;
    configService;
    studentsService;
    universitiesService;
    gemini;
    model;
    constructor(prisma, configService, studentsService, universitiesService) {
        this.prisma = prisma;
        this.configService = configService;
        this.studentsService = studentsService;
        this.universitiesService = universitiesService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (apiKey) {
            this.gemini = new genai_1.GoogleGenAI({ apiKey });
        }
        this.model =
            this.configService.get('GEMINI_LETTER_MODEL') || 'gemini-2.5-flash';
    }
    async generate(input) {
        this.assertGenerateInput(input);
        const type = input.type ?? 'motivation_letter';
        const [profile, university] = await Promise.all([
            this.studentsService.getFullProfile(input.studentId),
            this.universitiesService.findOne(input.universityId),
        ]);
        const content = await this.generateWithGemini({
            profile,
            university,
            type,
            prompt: input.prompt,
        });
        const letter = await this.prisma.generatedDocument.create({
            data: {
                studentId: input.studentId,
                universityId: input.universityId,
                type,
                content,
            },
        });
        return this.toResponse(letter);
    }
    async findByStudent(studentId) {
        await this.studentsService.findOne(studentId);
        const letters = await this.prisma.generatedDocument.findMany({
            where: { studentId },
            orderBy: { generatedAt: 'desc' },
        });
        return letters.map((letter) => this.toResponse(letter));
    }
    async findByUniversity(universityId) {
        await this.universitiesService.findOne(universityId);
        const letters = await this.prisma.generatedDocument.findMany({
            where: { universityId },
            orderBy: { generatedAt: 'desc' },
        });
        return letters.map((letter) => this.toResponse(letter));
    }
    async findOne(id) {
        const letter = await this.prisma.generatedDocument.findUnique({
            where: { id },
        });
        if (!letter) {
            throw new common_1.NotFoundException(`Letter "${id}" was not found.`);
        }
        return this.toResponse(letter);
    }
    async update(id, input) {
        await this.findOne(id);
        if (input.content !== undefined && !input.content.trim()) {
            throw new common_1.BadRequestException('Letter content cannot be empty.');
        }
        const approvedByConsultant = input.approvedByConsultant;
        const letter = await this.prisma.generatedDocument.update({
            where: { id },
            data: {
                content: input.content?.trim(),
                approvedByConsultant,
                approvedAt: approvedByConsultant === undefined
                    ? undefined
                    : approvedByConsultant
                        ? new Date()
                        : null,
            },
        });
        return this.toResponse(letter);
    }
    async approve(id) {
        return this.update(id, { approvedByConsultant: true });
    }
    async unapprove(id) {
        return this.update(id, { approvedByConsultant: false });
    }
    async remove(id) {
        await this.findOne(id);
        const letter = await this.prisma.generatedDocument.delete({
            where: { id },
        });
        return this.toResponse(letter);
    }
    async generateWithGemini(input) {
        if (!this.gemini) {
            throw new common_1.ServiceUnavailableException('GEMINI_API_KEY is not configured.');
        }
        const response = await this.gemini.models.generateContent({
            model: this.model,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: this.buildPrompt(input) }],
                },
            ],
        });
        return (response.text ?? '').trim();
    }
    buildPrompt(input) {
        const studentName = [
            input.profile.personal.givenName,
            input.profile.personal.surname,
        ]
            .filter(Boolean)
            .join(' ');
        const target = input.profile.applicationTargets.find((item) => item.universityId === input.university.id);
        const universityPrompt = input.prompt ?? input.university.essayPrompt ?? 'Write a strong motivation letter.';
        return [
            `Write a ${input.type.replace(/_/g, ' ')} for a university application.`,
            'Return only the final letter text. Do not include analysis, markdown fences, or metadata.',
            '',
            `Student: ${studentName}`,
            `Email: ${input.profile.personal.email}`,
            `Nationality: ${input.profile.personal.nationality ?? 'not provided'}`,
            `Current institution: ${input.profile.personal.currentInstitution ?? 'not provided'}`,
            `Education: ${JSON.stringify(input.profile.education)}`,
            `Languages: ${JSON.stringify(input.profile.languages)}`,
            `Application major: ${target?.major ?? 'not provided'}`,
            `Application degree: ${target?.degree ?? 'not provided'}`,
            `Funding source: ${target?.fundingSource ?? 'not provided'}`,
            '',
            `University: ${input.university.displayName}`,
            `University notes: ${input.university.notes ?? 'not provided'}`,
            `University prompt: ${universityPrompt}`,
            '',
            'Keep it specific, natural, and consultant-ready.',
        ].join('\n');
    }
    assertGenerateInput(input) {
        if (!input.studentId?.trim()) {
            throw new common_1.BadRequestException('studentId is required.');
        }
        if (!input.universityId?.trim()) {
            throw new common_1.BadRequestException('universityId is required.');
        }
    }
    toResponse(letter) {
        return {
            id: letter.id,
            studentId: letter.studentId,
            universityId: letter.universityId,
            type: letter.type,
            content: letter.content,
            approvedByConsultant: letter.approvedByConsultant,
            approvedAt: letter.approvedAt?.toISOString(),
            generatedAt: letter.generatedAt.toISOString(),
        };
    }
};
exports.LettersService = LettersService;
exports.LettersService = LettersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        config_1.ConfigService,
        students_service_js_1.StudentsService,
        universities_service_js_1.UniversitiesService])
], LettersService);
//# sourceMappingURL=letters.service.js.map