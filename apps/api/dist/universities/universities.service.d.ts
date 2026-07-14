import { PrismaService } from '../prisma/prisma.service.js';
import { SchemasService } from './schemas.service.js';
import type { CreateUniversityAliasInput, ResolvedUniversity, UniversitySchemaResponse, UniversitySummary } from './types/university-api.types.js';
export declare class UniversitiesService {
    private readonly prisma;
    private readonly schemasService;
    constructor(prisma: PrismaService, schemasService: SchemasService);
    findAll(): Promise<UniversitySummary[]>;
    findOne(id: string): Promise<UniversitySchemaResponse>;
    findAliases(universityId: string): Promise<string[]>;
    createAlias(input: CreateUniversityAliasInput): Promise<{
        universityId: string;
        alias: string;
    }>;
    resolve(rawName: string): Promise<ResolvedUniversity>;
    private findExactMatch;
    private getMatchEntries;
    private toResponse;
    private getAliases;
    private getAliasesByUniversityId;
    private toStringArray;
    private toFieldConfigArray;
    private isFieldConfig;
}
