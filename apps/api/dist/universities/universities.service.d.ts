import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { SchemasService } from './schemas.service.js';
import type { CreateUniversityAliasInput, ResolvedUniversity, UniversitySchemaResponse, UniversitySummary } from './types/university-api.types.js';
export declare class UniversitiesService {
    private readonly prisma;
    private readonly schemasService;
    private readonly queueService;
    constructor(prisma: PrismaService, schemasService: SchemasService, queueService: QueueService);
    findAll(): Promise<UniversitySummary[]>;
    findOne(id: string): Promise<UniversitySchemaResponse>;
    getFullSchemaForExtension(universityId: string): Promise<UniversitySchemaResponse>;
    findByFormUrl(pageUrl: string): Promise<UniversitySchemaResponse | null>;
    private normalizePageUrl;
    private formUrlsMatch;
    findAliases(universityId: string): Promise<string[]>;
    requestRelogin(universityId: string): Promise<{
        jobId: string | undefined;
        status: string;
        universityId: string;
        profilePath: string;
        message: string;
    }>;
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
