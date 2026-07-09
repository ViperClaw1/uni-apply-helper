import { PrismaService } from '../prisma/prisma.service.js';
import type { ResolvedUniversity, UniversitySchemaResponse, UniversitySummary } from './types/university-api.types.js';
export declare class UniversitiesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<UniversitySummary[]>;
    findOne(id: string): Promise<UniversitySchemaResponse>;
    findAliases(universityId: string): Promise<string[]>;
    resolve(rawName: string): Promise<ResolvedUniversity>;
    private toResponse;
    private getAliases;
    private getAliasesByUniversityId;
    private toStringArray;
    private toFieldConfigArray;
    private isFieldConfig;
}
