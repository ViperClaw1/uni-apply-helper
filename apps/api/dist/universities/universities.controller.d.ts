import { SchemasService } from './schemas.service.js';
import { UniversitiesService } from './universities.service.js';
export declare class UniversitiesController {
    private readonly universitiesService;
    private readonly schemasService;
    constructor(universitiesService: UniversitiesService, schemasService: SchemasService);
    findAll(): Promise<import("./types/university-api.types.js").UniversitySummary[]>;
    resolve(name?: string): Promise<import("./types/university-api.types.js").ResolvedUniversity>;
    seedSchemas(): Promise<import("./types/university-api.types.js").SeedUniversitySchemasResult>;
    findOne(id: string): Promise<import("./types/university-api.types.js").UniversitySchemaResponse>;
    findAliases(id: string): Promise<string[]>;
}
