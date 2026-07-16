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
exports.SchemaGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const STUDENT_PROFILE_PATHS = [
    'personal.surname',
    'personal.givenName',
    'personal.chineseName',
    'personal.sex',
    'personal.nationality',
    'personal.cityOfBirth',
    'personal.dateOfBirth',
    'personal.religion',
    'personal.passportNo',
    'personal.passportExpiry',
    'personal.consulate',
    'personal.maritalStatus',
    'personal.email',
    'personal.phone',
    'personal.hobby',
    'personal.permanentAddress',
    'personal.postCode',
    'personal.currentInstitution',
    'personal.beenToChina',
    'personal.studiedInChina',
    'education[0].degree',
    'education[0].institution',
    'education[0].major',
    'guarantor.name',
    'guarantor.phone',
    'emergencyContact.name',
    'emergencyContact.phone',
];
const DOCUMENT_TYPES = [
    'photo',
    'passport',
    'transcript',
    'medical',
    'financial',
    'diploma',
    'language_certificate',
];
const FIELD_TYPES = [
    'text',
    'number',
    'select',
    'radio',
    'checkbox',
    'textarea',
    'essay',
    'file',
];
let SchemaGeneratorService = class SchemaGeneratorService {
    configService;
    gemini;
    model;
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (apiKey) {
            this.gemini = new genai_1.GoogleGenAI({ apiKey });
        }
        this.model =
            this.configService.get('GEMINI_SCHEMA_MODEL') ||
                this.configService.get('GEMINI_LETTER_MODEL') ||
                'gemini-3.5-flash';
    }
    async generateDraft(input) {
        this.assertInput(input);
        if (!this.gemini) {
            throw new common_1.ServiceUnavailableException('GEMINI_API_KEY is not configured.');
        }
        const prompt = this.buildPrompt(input);
        try {
            const response = await this.gemini.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            const raw = (response.text ?? '').trim();
            const schema = this.parseSchemaJson(raw, input);
            const warnings = this.validateDraft(schema);
            return { schema, warnings, model: this.model };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Unknown Gemini error';
            throw new common_1.ServiceUnavailableException(`Gemini schema generation failed for model "${this.model}": ${message}`);
        }
    }
    assertInput(input) {
        if (!input.id?.trim()) {
            throw new common_1.BadRequestException('id is required.');
        }
        if (!input.displayName?.trim()) {
            throw new common_1.BadRequestException('displayName is required.');
        }
        if (!input.formUrl?.trim()) {
            throw new common_1.BadRequestException('formUrl is required.');
        }
        if (!Array.isArray(input.captures) || input.captures.length === 0) {
            throw new common_1.BadRequestException('captures must contain at least one step.');
        }
    }
    buildPrompt(input) {
        return [
            'You are a schema generator for a university application autofill system.',
            'Given DOM field captures from a real application form, produce a JSON university schema.',
            '',
            'Return ONLY valid JSON matching this TypeScript shape (no markdown, no commentary):',
            '{',
            '  "id": string,',
            '  "displayName": string,',
            '  "formUrl": string,',
            '  "aliases": string[],',
            '  "requiredDocuments": string[],',
            '  "fields": Array<{',
            '    "selector": string,',
            '    "mapsTo": string | null,',
            `    "type": ${JSON.stringify(FIELD_TYPES)},`,
            '    "required": boolean,',
            '    "wizardStep"?: number,',
            '    "options"?: string[],',
            '    "essayPrompt"?: string,',
            '    "documentType"?: string',
            '  }>,',
            '  "wizard"?: {',
            '    "totalSteps": number,',
            '    "nextButtonSelector": string,',
            '    "submitButtonSelector": string',
            '  },',
            '  "requiresEssay": boolean,',
            '  "essayPrompt"?: string,',
            '  "notes"?: string',
            '}',
            '',
            'Mapping rules:',
            `- mapsTo must be one of these StudentProfile paths when applicable: ${STUDENT_PROFILE_PATHS.join(', ')}`,
            `- documentType for file fields: ${DOCUMENT_TYPES.join(', ')}`,
            '- Use essay type with mapsTo=null for motivation/study plan/personal statement fields',
            '- Prefer selectors from capture (name/id). Use CSS: input[name="..."], select[name="..."], textarea[name="..."]',
            '- Set wizardStep from capture.wizardStep when wizard detected',
            '- Infer wizard.totalSteps from captures if multiple steps present',
            '- nextButtonSelector: input[value="Save and Next"], input[value="Next"] unless capture suggests otherwise',
            '- submitButtonSelector: input[value="Submit"], button[type="submit"] unless capture suggests otherwise',
            '- requiredDocuments: list document types needed based on file fields',
            '- requiresEssay: true if any essay field exists',
            '- notes: mention pre-wizard manual steps (login, agree, program selection) if URL/titles suggest wizard',
            '',
            `Target university id: ${input.id}`,
            `Target displayName: ${input.displayName}`,
            `Target formUrl: ${input.formUrl}`,
            `Aliases: ${JSON.stringify(input.aliases ?? [input.displayName])}`,
            input.notes ? `Consultant notes: ${input.notes}` : '',
            '',
            'DOM captures (one object per wizard step or page):',
            JSON.stringify(input.captures, null, 2),
        ]
            .filter(Boolean)
            .join('\n');
    }
    parseSchemaJson(raw, input) {
        const jsonText = this.extractJson(raw);
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        }
        catch {
            throw new common_1.BadRequestException('Gemini returned invalid JSON for university schema.');
        }
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadRequestException('Gemini schema response must be a JSON object.');
        }
        const schema = parsed;
        return {
            id: input.id.trim(),
            displayName: input.displayName.trim(),
            formUrl: input.formUrl.trim(),
            aliases: input.aliases ?? [input.displayName],
            requiredDocuments: Array.isArray(schema.requiredDocuments)
                ? schema.requiredDocuments.filter((item) => typeof item === 'string')
                : [],
            fields: Array.isArray(schema.fields) ? schema.fields : [],
            wizard: schema.wizard,
            requiresEssay: schema.requiresEssay ?? false,
            essayPrompt: schema.essayPrompt,
            notes: schema.notes ??
                'LLM-generated draft — verify selectors on real form before production use.',
        };
    }
    extractJson(raw) {
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
            return fenced[1].trim();
        }
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return raw.slice(start, end + 1);
        }
        return raw;
    }
    validateDraft(schema) {
        const warnings = [];
        if (schema.fields.length === 0) {
            warnings.push('No fields generated — check capture quality.');
        }
        for (const field of schema.fields) {
            if (!field.selector?.trim()) {
                warnings.push('Field missing selector.');
            }
            if (field.type === 'file' && !field.documentType) {
                warnings.push(`File field ${field.selector} has no documentType.`);
            }
            if (field.mapsTo && !STUDENT_PROFILE_PATHS.includes(field.mapsTo)) {
                warnings.push(`Unusual mapsTo path: ${field.mapsTo}`);
            }
        }
        if (schema.wizard && schema.wizard.totalSteps < 1) {
            warnings.push('wizard.totalSteps looks invalid.');
        }
        return warnings;
    }
};
exports.SchemaGeneratorService = SchemaGeneratorService;
exports.SchemaGeneratorService = SchemaGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SchemaGeneratorService);
//# sourceMappingURL=schema-generator.service.js.map