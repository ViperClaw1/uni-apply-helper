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
exports.UniversitiesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const schemas_service_js_1 = require("./schemas.service.js");
let UniversitiesService = class UniversitiesService {
    prisma;
    schemasService;
    constructor(prisma, schemasService) {
        this.prisma = prisma;
        this.schemasService = schemasService;
    }
    async findAll() {
        const universities = await this.prisma.universitySchema.findMany({
            orderBy: { displayName: 'asc' },
            select: {
                id: true,
                displayName: true,
                formUrl: true,
                requiresEssay: true,
            },
        });
        const aliasesByUniversityId = await this.getAliasesByUniversityId(universities.map((university) => university.id));
        const databaseSummaries = universities.map((university) => ({
            ...university,
            aliases: aliasesByUniversityId.get(university.id) ?? [],
        }));
        const existingIds = new Set(databaseSummaries.map((university) => university.id));
        const fileSummaries = (await this.schemasService.findAllFromFiles())
            .filter((university) => !existingIds.has(university.id))
            .map((university) => ({
            id: university.id,
            displayName: university.displayName,
            formUrl: university.formUrl,
            requiresEssay: university.requiresEssay,
            aliases: university.aliases,
        }));
        return [...databaseSummaries, ...fileSummaries].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    async findOne(id) {
        const university = await this.prisma.universitySchema.findUnique({
            where: { id },
        });
        if (university) {
            return this.toResponse(university);
        }
        try {
            return await this.schemasService.findByUniversityId(id);
        }
        catch (error) {
            if (!(error instanceof common_1.NotFoundException)) {
                throw error;
            }
            throw new common_1.NotFoundException(`University "${id}" was not found.`);
        }
    }
    async findAliases(universityId) {
        const university = await this.findOne(universityId);
        return university.aliases;
    }
    async resolve(rawName) {
        const normalizedName = rawName.trim();
        if (!normalizedName) {
            return { rawName, university: null };
        }
        const alias = await this.prisma.universityAlias.findFirst({
            where: {
                alias: {
                    equals: normalizedName,
                    mode: 'insensitive',
                },
            },
        });
        if (alias) {
            return {
                rawName,
                university: await this.findOne(alias.universityId),
            };
        }
        const university = await this.prisma.universitySchema.findFirst({
            where: {
                OR: [
                    { id: normalizedName },
                    {
                        displayName: {
                            equals: normalizedName,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
        });
        return {
            rawName,
            university: university
                ? await this.toResponse(university)
                : await this.schemasService.resolveFromFiles(rawName),
        };
    }
    async toResponse(university) {
        return {
            id: university.id,
            displayName: university.displayName,
            formUrl: university.formUrl,
            requiredDocuments: this.toStringArray(university.requiredDocuments),
            fields: this.toFieldConfigArray(university.fields),
            requiresEssay: university.requiresEssay,
            essayPrompt: university.essayPrompt ?? undefined,
            notes: university.notes ?? undefined,
            versionHash: university.versionHash ?? undefined,
            lastValidatedAt: university.lastValidatedAt?.toISOString(),
            aliases: await this.getAliases(university.id),
        };
    }
    async getAliases(universityId) {
        const aliases = await this.prisma.universityAlias.findMany({
            where: { universityId },
            orderBy: { alias: 'asc' },
            select: { alias: true },
        });
        return aliases.map((alias) => alias.alias);
    }
    async getAliasesByUniversityId(universityIds) {
        if (universityIds.length === 0) {
            return new Map();
        }
        const aliases = await this.prisma.universityAlias.findMany({
            where: { universityId: { in: universityIds } },
            orderBy: { alias: 'asc' },
            select: {
                alias: true,
                universityId: true,
            },
        });
        return aliases.reduce((acc, alias) => {
            const existingAliases = acc.get(alias.universityId) ?? [];
            existingAliases.push(alias.alias);
            acc.set(alias.universityId, existingAliases);
            return acc;
        }, new Map());
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
            (typeof field.mapsTo === 'string' || field.mapsTo === null) &&
            typeof field.type === 'string' &&
            typeof field.required === 'boolean');
    }
};
exports.UniversitiesService = UniversitiesService;
exports.UniversitiesService = UniversitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        schemas_service_js_1.SchemasService])
], UniversitiesService);
//# sourceMappingURL=universities.service.js.map