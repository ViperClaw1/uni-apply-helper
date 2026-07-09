import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FieldConfig } from '@uni-apply/shared';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  SeedUniversitySchemasResult,
  UniversitySchemaFile,
  UniversitySchemaResponse,
} from './types/university-api.types.js';

@Injectable()
export class SchemasService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUniversityId(
    universityId: string,
  ): Promise<UniversitySchemaResponse> {
    const schema = await this.findFileSchema(universityId);

    if (!schema) {
      throw new NotFoundException(`University schema "${universityId}" was not found.`);
    }

    return this.toResponse(schema);
  }

  async findAllFromFiles(): Promise<UniversitySchemaResponse[]> {
    const schemas = await this.readSchemaFiles();

    return schemas.map((schema) => this.toResponse(schema));
  }

  async resolveFromFiles(rawName: string): Promise<UniversitySchemaResponse | null> {
    const normalizedName = rawName.trim().toLowerCase();

    if (!normalizedName) {
      return null;
    }

    const schemas = await this.readSchemaFiles();
    const schema = schemas.find((item) => {
      const aliases = item.aliases ?? [];

      return (
        item.id.toLowerCase() === normalizedName ||
        item.displayName.toLowerCase() === normalizedName ||
        aliases.some((alias) => alias.toLowerCase() === normalizedName)
      );
    });

    return schema ? this.toResponse(schema) : null;
  }

  async seedFromFiles(): Promise<SeedUniversitySchemasResult> {
    const schemas = await this.readSchemaFiles();
    let aliasesCount = 0;

    for (const schema of schemas) {
      const versionHash = schema.versionHash ?? this.hashSchema(schema);

      await this.prisma.universitySchema.upsert({
        where: { id: schema.id },
        update: {
          displayName: schema.displayName,
          formUrl: schema.formUrl,
          requiredDocuments: schema.requiredDocuments,
          fields: schema.fields as unknown as Prisma.InputJsonValue,
          requiresEssay: schema.requiresEssay,
          essayPrompt: schema.essayPrompt,
          versionHash,
          notes: schema.notes,
        },
        create: {
          id: schema.id,
          displayName: schema.displayName,
          formUrl: schema.formUrl,
          requiredDocuments: schema.requiredDocuments,
          fields: schema.fields as unknown as Prisma.InputJsonValue,
          requiresEssay: schema.requiresEssay,
          essayPrompt: schema.essayPrompt,
          versionHash,
          notes: schema.notes,
        },
      });

      for (const alias of schema.aliases ?? []) {
        await this.prisma.universityAlias.upsert({
          where: { alias },
          update: { universityId: schema.id },
          create: { alias, universityId: schema.id },
        });

        aliasesCount += 1;
      }
    }

    return {
      schemas: schemas.length,
      aliases: aliasesCount,
    };
  }

  private async findFileSchema(
    universityId: string,
  ): Promise<UniversitySchemaFile | null> {
    const schemas = await this.readSchemaFiles();

    return schemas.find((schema) => schema.id === universityId) ?? null;
  }

  private async readSchemaFiles(): Promise<UniversitySchemaFile[]> {
    const dir = await this.findSchemasDirectory();

    if (!dir) {
      return [];
    }

    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json'),
    );

    const schemas = await Promise.all(
      files.map(async (file) => {
        const raw = await readFile(join(dir, file.name), 'utf8');
        return this.parseSchema(raw, file.name);
      }),
    );

    return schemas.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private async findSchemasDirectory(): Promise<string | null> {
    let currentDir = process.cwd();

    while (true) {
      const candidate = join(currentDir, 'data', 'university-schemas');

      try {
        const entries = await readdir(candidate);

        if (entries) {
          return candidate;
        }
      } catch {
        // Keep walking up until the repository root is found.
      }

      const parent = dirname(currentDir);

      if (parent === currentDir) {
        return null;
      }

      currentDir = parent;
    }
  }

  private parseSchema(raw: string, fileName: string): UniversitySchemaFile {
    const parsed = JSON.parse(raw) as Partial<UniversitySchemaFile>;

    if (
      !parsed.id ||
      !parsed.displayName ||
      !parsed.formUrl ||
      !Array.isArray(parsed.requiredDocuments) ||
      !Array.isArray(parsed.fields)
    ) {
      throw new Error(`Invalid university schema file: ${fileName}`);
    }

    return {
      id: parsed.id,
      displayName: parsed.displayName,
      formUrl: parsed.formUrl,
      aliases: this.toStringArray(parsed.aliases),
      requiredDocuments: this.toStringArray(parsed.requiredDocuments),
      fields: parsed.fields.filter((field): field is FieldConfig =>
        this.isFieldConfig(field),
      ),
      requiresEssay: parsed.requiresEssay ?? false,
      essayPrompt: parsed.essayPrompt,
      notes: parsed.notes,
      versionHash: parsed.versionHash,
      lastValidatedAt: parsed.lastValidatedAt,
    };
  }

  private toResponse(schema: UniversitySchemaFile): UniversitySchemaResponse {
    return {
      id: schema.id,
      displayName: schema.displayName,
      formUrl: schema.formUrl,
      requiredDocuments: schema.requiredDocuments,
      fields: schema.fields,
      requiresEssay: schema.requiresEssay,
      essayPrompt: schema.essayPrompt,
      notes: schema.notes,
      versionHash: schema.versionHash ?? this.hashSchema(schema),
      lastValidatedAt: schema.lastValidatedAt,
      aliases: schema.aliases ?? [],
    };
  }

  private hashSchema(schema: UniversitySchemaFile): string {
    return createHash('sha256')
      .update(JSON.stringify(schema))
      .digest('hex');
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
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

