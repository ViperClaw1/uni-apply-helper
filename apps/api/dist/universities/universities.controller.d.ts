import { SchemasService } from './schemas.service.js';
import { SchemaGeneratorService } from './schema-generator.service.js';
import { UniversitiesService } from './universities.service.js';
import type { CreateUniversityAliasInput } from './types/university-api.types.js';
import type { GenerateUniversitySchemaInput } from './types/schema-generator.types.js';
export declare class UniversitiesController {
    private readonly universitiesService;
    private readonly schemasService;
    private readonly schemaGeneratorService;
    constructor(universitiesService: UniversitiesService, schemasService: SchemasService, schemaGeneratorService: SchemaGeneratorService);
    findAll(): Promise<import("./types/university-api.types.js").UniversitySummary[]>;
    resolve(name?: string): Promise<import("./types/university-api.types.js").ResolvedUniversity>;
    createAlias(body: CreateUniversityAliasInput): Promise<{
        universityId: string;
        alias: string;
    }>;
    seedSchemas(): Promise<import("./types/university-api.types.js").SeedUniversitySchemasResult>;
    generateSchemaDraft(body: GenerateUniversitySchemaInput): Promise<import("./types/schema-generator.types.js").GenerateUniversitySchemaResult>;
    findOne(id: string): Promise<import("./types/university-api.types.js").UniversitySchemaResponse>;
    findAliases(id: string): Promise<string[]>;
}
