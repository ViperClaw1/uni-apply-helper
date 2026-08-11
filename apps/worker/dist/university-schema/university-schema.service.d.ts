import type { UniversitySchema } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service.js';
export declare class UniversitySchemaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listIds(): Promise<string[]>;
    get(universityId: string): Promise<UniversitySchema>;
    private findFileSchema;
    private findSchemasDirectory;
    private toStringArray;
    private toFieldConfigArray;
    private isFieldConfig;
}
