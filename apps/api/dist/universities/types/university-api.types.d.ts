import type { UniversitySchema } from '@uni-apply/shared';
export type UniversitySummary = Pick<UniversitySchema, 'id' | 'displayName' | 'formUrl' | 'requiresEssay'> & {
    aliases: string[];
};
export type UniversitySchemaResponse = UniversitySchema & {
    aliases: string[];
    versionHash?: string;
    lastValidatedAt?: string;
};
export type ResolvedUniversity = {
    rawName: string;
    university: UniversitySchemaResponse | null;
};
export type UniversitySchemaFile = UniversitySchema & {
    aliases?: string[];
    versionHash?: string;
    lastValidatedAt?: string;
};
export type SeedUniversitySchemasResult = {
    schemas: number;
    aliases: number;
};
