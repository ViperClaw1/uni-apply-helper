import { Injectable } from '@nestjs/common';
import type { FieldConfig, UniversitySchema } from '@uni-apply/shared';
import { dirname, join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Resolves the effective UniversitySchema for a university id, merging the DB row with the
 * on-disk file schema (data/university-schemas/*.json) when present — file wins over DB,
 * since the DB seed often lags a live edit to the file (or the seed proxy dies).
 *
 * `session`/`wizard`/`agent`/`navigationHints`/`defaultProgram` only ever come from the file —
 * they aren't Prisma columns at all.
 */
@Injectable()
export class UniversitySchemaService {
  constructor(private readonly prisma: PrismaService) {}

  /** All university ids currently seeded in the DB. File-only schemas are not included. */
  async listIds(): Promise<string[]> {
    const rows = await this.prisma.universitySchema.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }

  async get(universityId: string): Promise<UniversitySchema> {
    const university = await this.prisma.universitySchema.findUnique({
      where: { id: universityId },
    });

    if (university) {
      const fileSchema = await this.findFileSchema(universityId);
      // Prefer on-disk schema fields when present — DB seed often lags / proxy dies.
      const fields = fileSchema?.fields?.length
        ? fileSchema.fields
        : this.toFieldConfigArray(university.fields);
      const requiredDocuments = fileSchema?.requiredDocuments?.length
        ? fileSchema.requiredDocuments
        : this.toStringArray(university.requiredDocuments);

      return {
        id: university.id,
        displayName: fileSchema?.displayName ?? university.displayName,
        formUrl: fileSchema?.formUrl || university.formUrl,
        requiredDocuments,
        fields,
        wizard: fileSchema?.wizard,
        session: fileSchema?.session,
        agent: fileSchema?.agent,
        defaultProgram: fileSchema?.defaultProgram,
        navigationHints: fileSchema?.navigationHints,
        requiresEssay: fileSchema?.requiresEssay ?? university.requiresEssay,
        essayPrompt:
          fileSchema?.essayPrompt ?? university.essayPrompt ?? undefined,
        notes: fileSchema?.notes ?? university.notes ?? undefined,
      };
    }

    const fileSchema = await this.findFileSchema(universityId);

    if (!fileSchema) {
      throw new Error(`University schema "${universityId}" was not found.`);
    }

    return fileSchema;
  }

  private async findFileSchema(
    universityId: string,
  ): Promise<UniversitySchema | null> {
    const dir = await this.findSchemasDirectory();

    if (!dir) {
      return null;
    }

    const files = (await readdir(dir, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json'),
    );

    for (const file of files) {
      const raw = await readFile(join(dir, file.name), 'utf8');
      const schema = JSON.parse(raw) as Partial<UniversitySchema>;

      if (schema.id === universityId) {
        return {
          id: schema.id,
          displayName: schema.displayName ?? universityId,
          formUrl: schema.formUrl ?? '',
          requiredDocuments: this.toStringArray(schema.requiredDocuments),
          fields: this.toFieldConfigArray(schema.fields),
          wizard: schema.wizard,
          session: schema.session,
          agent: schema.agent,
          defaultProgram: schema.defaultProgram,
          navigationHints: schema.navigationHints,
          requiresEssay: schema.requiresEssay ?? false,
          essayPrompt: schema.essayPrompt,
          notes: schema.notes,
        };
      }
    }

    return null;
  }

  private async findSchemasDirectory(): Promise<string | null> {
    let currentDir = process.cwd();

    while (true) {
      const candidate = join(currentDir, 'data', 'university-schemas');

      try {
        await readdir(candidate);
        return candidate;
      } catch {
        const parent = dirname(currentDir);

        if (parent === currentDir) {
          return null;
        }

        currentDir = parent;
      }
    }
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

    return value.filter((item): item is FieldConfig => this.isFieldConfig(item));
  }

  private isFieldConfig(value: unknown): value is FieldConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const field = value as Partial<FieldConfig>;

    return (
      typeof field.selector === 'string' &&
      (field.mapsTo === null ||
        typeof field.mapsTo === 'string' ||
        (Array.isArray(field.mapsTo) &&
          field.mapsTo.every((p) => typeof p === 'string'))) &&
      typeof field.type === 'string' &&
      typeof field.required === 'boolean'
    );
  }
}
