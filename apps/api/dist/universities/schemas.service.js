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
exports.SchemasService = void 0;
const common_1 = require("@nestjs/common");
const university_name_matcher_js_1 = require("./lib/university-name-matcher.js");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let SchemasService = class SchemasService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByUniversityId(universityId) {
        const schema = await this.findFileSchema(universityId);
        if (!schema) {
            throw new common_1.NotFoundException(`University schema "${universityId}" was not found.`);
        }
        return this.toResponse(schema);
    }
    async findAllFromFiles() {
        const schemas = await this.readSchemaFiles();
        return schemas.map((schema) => this.toResponse(schema));
    }
    async resolveFromFiles(rawName) {
        const normalizedName = rawName.trim();
        if (!normalizedName) {
            return null;
        }
        const schemas = await this.readSchemaFiles();
        const exactSchema = schemas.find((item) => {
            const aliases = item.aliases ?? [];
            return ((0, university_name_matcher_js_1.normalizeUniversityName)(item.id.replace(/-/g, ' ')) ===
                (0, university_name_matcher_js_1.normalizeUniversityName)(normalizedName) ||
                (0, university_name_matcher_js_1.normalizeUniversityName)(item.displayName) ===
                    (0, university_name_matcher_js_1.normalizeUniversityName)(normalizedName) ||
                aliases.some((alias) => (0, university_name_matcher_js_1.normalizeUniversityName)(alias) ===
                    (0, university_name_matcher_js_1.normalizeUniversityName)(normalizedName)));
        });
        if (exactSchema) {
            return this.toResponse(exactSchema);
        }
        const { universityId } = (0, university_name_matcher_js_1.matchUniversityName)(normalizedName, schemas.map((schema) => ({
            id: schema.id,
            displayName: schema.displayName,
            aliases: schema.aliases ?? [],
        })));
        if (!universityId) {
            return null;
        }
        const schema = schemas.find((item) => item.id === universityId);
        return schema ? this.toResponse(schema) : null;
    }
    async seedFromFiles() {
        const schemas = await this.readSchemaFiles();
        let aliasesCount = 0;
        for (const schema of schemas) {
            const versionHash = schema.versionHash ?? this.hashSchema(schema);
            await this.prisma.universitySchema.upsert({
                where: { id: schema.id },
                update: {
                    displayName: schema.displayName,
                    formUrl: schema.formUrl,
                    requiredDocuments: schema.requiredDocuments,
                    fields: schema.fields,
                    requiresEssay: schema.requiresEssay,
                    essayPrompt: schema.essayPrompt,
                    versionHash,
                    notes: schema.notes,
                },
                create: {
                    id: schema.id,
                    displayName: schema.displayName,
                    formUrl: schema.formUrl,
                    requiredDocuments: schema.requiredDocuments,
                    fields: schema.fields,
                    requiresEssay: schema.requiresEssay,
                    essayPrompt: schema.essayPrompt,
                    versionHash,
                    notes: schema.notes,
                },
            });
            for (const alias of schema.aliases ?? []) {
                await this.prisma.universityAlias.upsert({
                    where: { alias },
                    update: { universityId: schema.id },
                    create: { alias, universityId: schema.id },
                });
                aliasesCount += 1;
            }
        }
        return {
            schemas: schemas.length,
            aliases: aliasesCount,
        };
    }
    async findFileSchema(universityId) {
        const schemas = await this.readSchemaFiles();
        return schemas.find((schema) => schema.id === universityId) ?? null;
    }
    async readSchemaFiles() {
        const dir = await this.findSchemasDirectory();
        if (!dir) {
            return [];
        }
        const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
        const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
        const schemas = await Promise.all(files.map(async (file) => {
            const raw = await (0, promises_1.readFile)((0, node_path_1.join)(dir, file.name), 'utf8');
            return this.parseSchema(raw, file.name);
        }));
        return schemas.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    async findSchemasDirectory() {
        let currentDir = process.cwd();
        while (true) {
            const candidate = (0, node_path_1.join)(currentDir, 'data', 'university-schemas');
            try {
                const entries = await (0, promises_1.readdir)(candidate);
                if (entries) {
                    return candidate;
                }
            }
            catch {
            }
            const parent = (0, node_path_1.dirname)(currentDir);
            if (parent === currentDir) {
                return null;
            }
            currentDir = parent;
        }
    }
    parseSchema(raw, fileName) {
        const parsed = JSON.parse(raw);
        if (!parsed.id ||
            !parsed.displayName ||
            !parsed.formUrl ||
            !Array.isArray(parsed.requiredDocuments) ||
            !Array.isArray(parsed.fields)) {
            throw new Error(`Invalid university schema file: ${fileName}`);
        }
        return {
            id: parsed.id,
            displayName: parsed.displayName,
            formUrl: parsed.formUrl,
            aliases: this.toStringArray(parsed.aliases),
            requiredDocuments: this.toStringArray(parsed.requiredDocuments),
            fields: parsed.fields.filter((field) => this.isFieldConfig(field)),
            requiresEssay: parsed.requiresEssay ?? false,
            essayPrompt: parsed.essayPrompt,
            notes: parsed.notes,
            versionHash: parsed.versionHash,
            lastValidatedAt: parsed.lastValidatedAt,
        };
    }
    toResponse(schema) {
        return {
            id: schema.id,
            displayName: schema.displayName,
            formUrl: schema.formUrl,
            requiredDocuments: schema.requiredDocuments,
            fields: schema.fields,
            requiresEssay: schema.requiresEssay,
            essayPrompt: schema.essayPrompt,
            notes: schema.notes,
            versionHash: schema.versionHash ?? this.hashSchema(schema),
            lastValidatedAt: schema.lastValidatedAt,
            aliases: schema.aliases ?? [],
        };
    }
    hashSchema(schema) {
        return (0, node_crypto_1.createHash)('sha256')
            .update(JSON.stringify(schema))
            .digest('hex');
    }
    toStringArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item) => typeof item === 'string');
    }
    isFieldConfig(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const field = value;
        return (typeof field.selector === 'string' &&
            (typeof field.mapsTo === 'string' || field.mapsTo === null) &&
            typeof field.type === 'string' &&
            typeof field.required === 'boolean');
    }
};
exports.SchemasService = SchemasService;
exports.SchemasService = SchemasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], SchemasService);
//# sourceMappingURL=schemas.service.js.map