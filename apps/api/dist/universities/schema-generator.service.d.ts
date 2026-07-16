import { ConfigService } from '@nestjs/config';
import type { GenerateUniversitySchemaInput, GenerateUniversitySchemaResult } from './types/schema-generator.types.js';
export declare class SchemaGeneratorService {
    private readonly configService;
    private readonly gemini?;
    private readonly model;
    constructor(configService: ConfigService);
    generateDraft(input: GenerateUniversitySchemaInput): Promise<GenerateUniversitySchemaResult>;
    private assertInput;
    private buildPrompt;
    private parseSchemaJson;
    private extractJson;
    private validateDraft;
}
