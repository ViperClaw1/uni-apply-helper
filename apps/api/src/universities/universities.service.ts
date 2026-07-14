import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FieldConfig } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  matchUniversityName,
  normalizeUniversityName,
  type UniversityMatchEntry,
} from './lib/university-name-matcher.js';
import { SchemasService } from './schemas.service.js';
import type {
  CreateUniversityAliasInput,
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
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      throw new NotFoundException(`University "${id}" was not found.`);
    }
  }

  async findAliases(universityId: string): Promise<string[]> {
    const university = await this.findOne(universityId);

    return university.aliases;
  }

  async createAlias(input: CreateUniversityAliasInput) {
    await this.findOne(input.universityId);

    const alias = input.alias.trim();

    if (!alias) {
      throw new BadRequestException('Alias cannot be empty.');
    }

    return this.prisma.universityAlias.upsert({
      where: { alias },
      update: { universityId: input.universityId },
      create: {
        alias,
        universityId: input.universityId,
      },
    });
  }

  async resolve(rawName: string): Promise<ResolvedUniversity> {
    const normalizedName = rawName.trim();

    if (!normalizedName) {
      return { rawName, university: null, candidates: [] };
    }

    const exactMatch = await this.findExactMatch(normalizedName);

    if (exactMatch) {
      return {
        rawName,
        university: exactMatch,
        candidates: [],
      };
    }

    const entries = await this.getMatchEntries();
    const { universityId, candidates } = matchUniversityName(
      normalizedName,
      entries,
    );

    if (universityId) {
      return {
        rawName,
        university: await this.findOne(universityId),
        candidates,
      };
    }

    const fileMatch = await this.schemasService.resolveFromFiles(normalizedName);

    return {
      rawName,
      university: fileMatch,
      candidates,
    };
  }

  private async findExactMatch(
    rawName: string,
  ): Promise<UniversitySchemaResponse | null> {
    const normalized = normalizeUniversityName(rawName);

    const alias = await this.prisma.universityAlias.findFirst({
      where: {
        alias: {
          equals: rawName,
          mode: 'insensitive',
        },
      },
    });

    if (alias) {
      return this.findOne(alias.universityId);
    }

    const universities = await this.prisma.universitySchema.findMany();

    for (const university of universities) {
      const aliases = await this.getAliases(university.id);
      const variants = new Set([
        normalizeUniversityName(university.id.replace(/-/g, ' ')),
        normalizeUniversityName(university.displayName),
        ...aliases.map((item) => normalizeUniversityName(item)),
      ]);

      if (variants.has(normalized)) {
        return this.toResponse(university);
      }
    }

    const containsMatch = await this.prisma.universitySchema.findFirst({
      where: {
        OR: [
          {
            displayName: {
              contains: rawName,
              mode: 'insensitive',
            },
          },
          {
            id: {
              contains: rawName.replace(/\s+/g, '-').toLowerCase(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    return containsMatch ? this.toResponse(containsMatch) : null;
  }

  private async getMatchEntries(): Promise<UniversityMatchEntry[]> {
    const summaries = await this.findAll();

    return summaries.map((university) => ({
      id: university.id,
      displayName: university.displayName,
      aliases: university.aliases,
    }));
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
