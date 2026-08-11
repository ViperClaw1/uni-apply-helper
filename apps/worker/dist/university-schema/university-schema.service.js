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
exports.UniversitySchemaService = void 0;
const common_1 = require("@nestjs/common");
const node_path_1 = require("node:path");
const promises_1 = require("node:fs/promises");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let UniversitySchemaService = class UniversitySchemaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listIds() {
        const rows = await this.prisma.universitySchema.findMany({ select: { id: true } });
        return rows.map((row) => row.id);
    }
    async get(universityId) {
        const university = await this.prisma.universitySchema.findUnique({
            where: { id: universityId },
        });
        if (university) {
            const fileSchema = await this.findFileSchema(universityId);
            const fields = fileSchema?.fields?.length
                ? fileSchema.fields
                : this.toFieldConfigArray(university.fields);
            const requiredDocuments = fileSchema?.requiredDocuments?.length
                ? fileSchema.requiredDocuments
                : this.toStringArray(university.requiredDocuments);
            return {
                id: university.id,
                displayName: fileSchema?.displayName ?? university.displayName,
                formUrl: fileSchema?.formUrl || university.formUrl,
                requiredDocuments,
                fields,
                wizard: fileSchema?.wizard,
                session: fileSchema?.session,
                agent: fileSchema?.agent,
                defaultProgram: fileSchema?.defaultProgram,
                navigationHints: fileSchema?.navigationHints,
                requiresEssay: fileSchema?.requiresEssay ?? university.requiresEssay,
                essayPrompt: fileSchema?.essayPrompt ?? university.essayPrompt ?? undefined,
                notes: fileSchema?.notes ?? university.notes ?? undefined,
            };
        }
        const fileSchema = await this.findFileSchema(universityId);
        if (!fileSchema) {
            throw new Error(`University schema "${universityId}" was not found.`);
        }
        return fileSchema;
    }
    async findFileSchema(universityId) {
        const dir = await this.findSchemasDirectory();
        if (!dir) {
            return null;
        }
        const files = (await (0, promises_1.readdir)(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
        for (const file of files) {
            const raw = await (0, promises_1.readFile)((0, node_path_1.join)(dir, file.name), 'utf8');
            const schema = JSON.parse(raw);
            if (schema.id === universityId) {
                return {
                    id: schema.id,
                    displayName: schema.displayName ?? universityId,
                    formUrl: schema.formUrl ?? '',
                    requiredDocuments: this.toStringArray(schema.requiredDocuments),
                    fields: this.toFieldConfigArray(schema.fields),
                    wizard: schema.wizard,
                    session: schema.session,
                    agent: schema.agent,
                    defaultProgram: schema.defaultProgram,
                    navigationHints: schema.navigationHints,
                    requiresEssay: schema.requiresEssay ?? false,
                    essayPrompt: schema.essayPrompt,
                    notes: schema.notes,
                };
            }
        }
        return null;
    }
    async findSchemasDirectory() {
        let currentDir = process.cwd();
        while (true) {
            const candidate = (0, node_path_1.join)(currentDir, 'data', 'university-schemas');
            try {
                await (0, promises_1.readdir)(candidate);
                return candidate;
            }
            catch {
                const parent = (0, node_path_1.dirname)(currentDir);
                if (parent === currentDir) {
                    return null;
                }
                currentDir = parent;
            }
        }
    }
    toStringArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item) => typeof item === 'string');
    }
    toFieldConfigArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item) => this.isFieldConfig(item));
    }
    isFieldConfig(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const field = value;
        return (typeof field.selector === 'string' &&
            (field.mapsTo === null ||
                typeof field.mapsTo === 'string' ||
                (Array.isArray(field.mapsTo) &&
                    field.mapsTo.every((p) => typeof p === 'string'))) &&
            typeof field.type === 'string' &&
            typeof field.required === 'boolean');
    }
};
exports.UniversitySchemaService = UniversitySchemaService;
exports.UniversitySchemaService = UniversitySchemaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], UniversitySchemaService);
//# sourceMappingURL=university-schema.service.js.map