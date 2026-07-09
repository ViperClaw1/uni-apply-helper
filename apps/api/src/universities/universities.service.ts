import { Injectable, NotFoundException } from '@nestjs/common';
import type { FieldConfig } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchemasService } from './schemas.service.js';
import type {
  ResolvedUniversity,
  UniversitySchemaResponse,
  UniversitySummary,
} from './types/university-api.types.js';

type UniversityRecord = {
  id: string;
  displayName: string;
  formUrl: string;
  requiredDocuments: unknown;
  fields: unknown;
  requiresEssay: boolean;
  essayPrompt: string | null;
  versionHash: string | null;
  lastValidatedAt: Date | null;
  notes: string | null;
};

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemasService: SchemasService,
  ) {}

  async findAll(): Promise<UniversitySummary[]> {
    const universities = await this.prisma.universitySchema.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        formUrl: true,
        requiresEssay: true,
      },
    });

    const aliasesByUniversityId = await this.getAliasesByUniversityId(
      universities.map((university) => university.id),
    );

    const databaseSummaries = universities.map((university) => ({
      ...university,
      aliases: aliasesByUniversityId.get(university.id) ?? [],
    }));

    const existingIds = new Set(databaseSummaries.map((university) => university.id));
    const fileSummaries = (await this.schemasService.findAllFromFiles())
      .filter((university) => !existingIds.has(university.id))
      .map((university) => ({
        id: university.id,
        displayName: university.displayName,
        formUrl: university.formUrl,
        requiresEssay: university.requiresEssay,
        aliases: university.aliases,
      }));

    return [...databaseSummaries, ...fileSummaries].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  async findOne(id: string): Promise<UniversitySchemaResponse> {
    const university = await this.prisma.universitySchema.findUnique({
      where: { id },
    });

    if (university) {
      return this.toResponse(university);
    }

    try {
      return await this.schemasService.findByUniversityId(id);
    } catch {
      throw new NotFoundException(`University "${id}" was not found.`);
    }
  }

  async findAliases(universityId: string): Promise<string[]> {
    const university = await this.findOne(universityId);

    return university.aliases;
  }

  async resolve(rawName: string): Promise<ResolvedUniversity> {
    const normalizedName = rawName.trim();

    if (!normalizedName) {
      return { rawName, university: null };
    }

    const alias = await this.prisma.universityAlias.findFirst({
      where: {
        alias: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (alias) {
      return {
        rawName,
        university: await this.findOne(alias.universityId),
      };
    }

    const university = await this.prisma.universitySchema.findFirst({
      where: {
        OR: [
          { id: normalizedName },
          {
            displayName: {
              equals: normalizedName,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    return {
      rawName,
      university: university
        ? await this.toResponse(university)
        : await this.schemasService.resolveFromFiles(rawName),
    };
  }

  private async toResponse(
    university: UniversityRecord,
  ): Promise<UniversitySchemaResponse> {
    return {
      id: university.id,
      displayName: university.displayName,
      formUrl: university.formUrl,
      requiredDocuments: this.toStringArray(university.requiredDocuments),
      fields: this.toFieldConfigArray(university.fields),
      requiresEssay: university.requiresEssay,
      essayPrompt: university.essayPrompt ?? undefined,
      notes: university.notes ?? undefined,
      versionHash: university.versionHash ?? undefined,
      lastValidatedAt: university.lastValidatedAt?.toISOString(),
      aliases: await this.getAliases(university.id),
    };
  }

  private async getAliases(universityId: string): Promise<string[]> {
    const aliases = await this.prisma.universityAlias.findMany({
      where: { universityId },
      orderBy: { alias: 'asc' },
      select: { alias: true },
    });

    return aliases.map((alias) => alias.alias);
  }

  private async getAliasesByUniversityId(
    universityIds: string[],
  ): Promise<Map<string, string[]>> {
    if (universityIds.length === 0) {
      return new Map();
    }

    const aliases = await this.prisma.universityAlias.findMany({
      where: { universityId: { in: universityIds } },
      orderBy: { alias: 'asc' },
      select: {
        alias: true,
        universityId: true,
      },
    });

    return aliases.reduce((acc, alias) => {
      const existingAliases = acc.get(alias.universityId) ?? [];

      existingAliases.push(alias.alias);
      acc.set(alias.universityId, existingAliases);

      return acc;
    }, new Map<string, string[]>());
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toFieldConfigArray(value: unknown): FieldConfig[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item) => this.isFieldConfig(item));
  }

  private isFieldConfig(value: unknown): value is FieldConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const field = value as Partial<FieldConfig>;

    return (
      typeof field.selector === 'string' &&
      (typeof field.mapsTo === 'string' || field.mapsTo === null) &&
      typeof field.type === 'string' &&
      typeof field.required === 'boolean'
    );
  }
}

