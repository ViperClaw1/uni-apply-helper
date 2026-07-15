import { PrismaService } from '../prisma/prisma.service.js';
import type { SeedUniversitySchemasResult, UniversitySchemaResponse } from './types/university-api.types.js';
export declare class SchemasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByUniversityId(universityId: string): Promise<UniversitySchemaResponse>;
    findAllFromFiles(): Promise<UniversitySchemaResponse[]>;
    resolveFromFiles(rawName: string): Promise<UniversitySchemaResponse | null>;
    seedFromFiles(): Promise<SeedUniversitySchemasResult>;
    private findFileSchema;
    private readSchemaFiles;
    private findSchemasDirectory;
    private parseSchema;
    private toResponse;
    private parseWizard;
    private hashSchema;
    private toStringArray;
    private isFieldConfig;
}
