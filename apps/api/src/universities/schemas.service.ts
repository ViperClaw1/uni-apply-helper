import { Injectable, NotFoundException } from '@nestjs/common';
import {
  matchUniversityName,
  normalizeUniversityName,
} from './lib/university-name-matcher.js';
import { Prisma } from '@uni-apply/database';
import type { FieldConfig, WizardConfig } from '@uni-apply/shared';
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
    const normalizedName = rawName.trim();

    if (!normalizedName) {
      return null;
    }

    const schemas = await this.readSchemaFiles();
    const exactSchema = schemas.find((item) => {
      const aliases = item.aliases ?? [];

      return (
        normalizeUniversityName(item.id.replace(/-/g, ' ')) ===
          normalizeUniversityName(normalizedName) ||
        normalizeUniversityName(item.displayName) ===
          normalizeUniversityName(normalizedName) ||
        aliases.some(
          (alias) =>
            normalizeUniversityName(alias) ===
            normalizeUniversityName(normalizedName),
        )
      );
    });

    if (exactSchema) {
      return this.toResponse(exactSchema);
    }

    const { universityId } = matchUniversityName(
      normalizedName,
      schemas.map((schema) => ({
        id: schema.id,
        displayName: schema.displayName,
        aliases: schema.aliases ?? [],
      })),
    );

    if (!universityId) {
      return null;
    }

    const schema = schemas.find((item) => item.id === universityId);

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
      wizard: this.parseWizard(parsed.wizard),
      session: parsed.session,
      agent: parsed.agent,
      defaultProgram:
        typeof parsed.defaultProgram === 'string'
          ? parsed.defaultProgram
          : undefined,
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
      wizard: schema.wizard,
      session: schema.session,
      agent: schema.agent,
      defaultProgram: schema.defaultProgram,
      requiresEssay: schema.requiresEssay,
      essayPrompt: schema.essayPrompt,
      notes: schema.notes,
      versionHash: schema.versionHash ?? this.hashSchema(schema),
      lastValidatedAt: schema.lastValidatedAt,
      aliases: schema.aliases ?? [],
    };
  }

  private parseWizard(value: unknown): WizardConfig | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const wizard = value as Partial<WizardConfig>;

    if (
      typeof wizard.totalSteps !== 'number' ||
      typeof wizard.nextButtonSelector !== 'string' ||
      typeof wizard.submitButtonSelector !== 'string'
    ) {
      return undefined;
    }

    return {
      totalSteps: wizard.totalSteps,
      nextButtonSelector: wizard.nextButtonSelector,
      submitButtonSelector: wizard.submitButtonSelector,
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

