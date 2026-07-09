import { UniversitiesService } from './universities.service.js';
export declare class UniversitiesController {
    private readonly universitiesService;
    constructor(universitiesService: UniversitiesService);
    findAll(): Promise<import("./types/university-api.types.js").UniversitySummary[]>;
    resolve(name?: string): Promise<import("./types/university-api.types.js").ResolvedUniversity>;
    findOne(id: string): Promise<import("./types/university-api.types.js").UniversitySchemaResponse>;
    findAliases(id: string): Promise<string[]>;
}
