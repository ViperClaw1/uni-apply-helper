import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import type { FieldConfig } from '@uni-apply/shared';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
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
  UniversitySessionStatus,
  UniversitySessionSummary,
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
    private readonly queueService: QueueService,
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

    const existingIds = new Set(
      databaseSummaries.map((university) => university.id),
    );
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

  async getFullSchemaForExtension(
    universityId: string,
  ): Promise<UniversitySchemaResponse> {
    const base = await this.findOne(universityId);

    try {
      const fileSchema =
        await this.schemasService.findByUniversityId(universityId);

      return {
        ...base,
        fields: fileSchema.fields.length > 0 ? fileSchema.fields : base.fields,
        wizard: fileSchema.wizard ?? base.wizard,
        notes: fileSchema.notes ?? base.notes,
      };
    } catch {
      return base;
    }
  }

  async findByFormUrl(
    pageUrl: string,
  ): Promise<UniversitySchemaResponse | null> {
    let normalizedPageUrl: { originPath: string; hostname: string };

    try {
      normalizedPageUrl = this.normalizePageUrl(pageUrl);
    } catch {
      return null;
    }

    const universities = await this.findAll();

    for (const summary of universities) {
      const university = await this.findOne(summary.id);

      if (this.formUrlsMatch(normalizedPageUrl, university.formUrl)) {
        return university;
      }
    }

    return null;
  }

  async resolveByFormUrl(formUrl: string): Promise<UniversitySchemaResponse> {
    const trimmed = formUrl?.trim();

    if (!trimmed) {
      throw new BadRequestException('formUrl is required.');
    }

    let parsed: URL;

    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(`Invalid URL: "${formUrl}".`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('URL must use http or https.');
    }

    const university = await this.findByFormUrl(parsed.toString());

    if (!university) {
      throw new NotFoundException(
        `No university schema matches form URL "${trimmed}".`,
      );
    }

    return university;
  }

  private normalizePageUrl(url: string): {
    originPath: string;
    hostname: string;
  } {
    const parsed = new URL(url);

    return {
      originPath: `${parsed.origin}${parsed.pathname}`.replace(/\/$/, ''),
      hostname: parsed.hostname,
    };
  }

  private formUrlsMatch(
    page: { originPath: string; hostname: string },
    formUrl: string,
  ): boolean {
    const form = this.normalizePageUrl(formUrl);

    if (page.originPath === form.originPath) {
      return true;
    }

    if (page.hostname === form.hostname) {
      return true;
    }

    return (
      page.originPath.startsWith(form.originPath) ||
      form.originPath.startsWith(page.originPath)
    );
  }

  async findAliases(universityId: string): Promise<string[]> {
    const university = await this.findOne(universityId);

    return university.aliases;
  }

  /** Dashboard's "University Sessions" panel — session freshness never leaves this method as raw cookies/tokens, only a status label. */
  async listSessions(): Promise<UniversitySessionSummary[]> {
    const universities = await this.findAll();
    const sessions = await this.prisma.browserSession.findMany();
    const sessionByUniversityId = new Map(
      sessions.map((session) => [session.universityId, session]),
    );

    const applicationCounts = await this.prisma.application.groupBy({
      by: ['universityId'],
      _count: { _all: true },
    });
    const applicationCountByUniversityId = new Map(
      applicationCounts.map((row) => [row.universityId, row._count._all]),
    );

    return universities.map((university) => {
      const session = sessionByUniversityId.get(university.id);

      return {
        universityId: university.id,
        displayName: university.displayName,
        status: this.toSessionStatus(session),
        lastCheckedAt: session?.lastValidatedAt?.toISOString(),
        applications: applicationCountByUniversityId.get(university.id) ?? 0,
      };
    });
  }

  private toSessionStatus(session?: {
    status: string;
    capturedAt: Date | null;
  }): UniversitySessionStatus {
    if (!session || session.status === 'unknown') {
      return 'login_required';
    }

    if (session.status === 'attention_required') {
      return 'attention_required';
    }

    if (session.status === 'expired') {
      return session.capturedAt ? 'expired' : 'login_required';
    }

    // 'fresh' | 'stale' — both still authenticate; 'stale' just means nearing expiry.
    return 'active';
  }

  async requestRelogin(universityId: string) {
    await this.findOne(universityId);

    // attempts: 1 — this waits up to 15 min for a human, once. Auto-retrying a timeout would
    // silently open a second headed browser and wait another 15 min with no signal to the agent.
    const job = await this.queueService.addJob(
      QUEUES.BROWSER_RELOGIN,
      { universityId },
      { attempts: 1 },
    );

    const profilesRoot =
      process.env.BROWSER_PROFILES_DIR ?? join(process.cwd(), 'profiles');

    return {
      jobId: job.id,
      status: 'queued',
      universityId,
      profilePath: join(profilesRoot, universityId),
      message:
        'Headed browser will open on the worker. Log in manually — session is saved to the profile directory.',
    };
  }

  /** Lets the dashboard's renew-session modal tell a dead job apart from "still waiting on a human". */
  async getReloginStatus(
    jobId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    return this.queueService.getJobDetails(QUEUES.BROWSER_RELOGIN, jobId);
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

    const fileMatch =
      await this.schemasService.resolveFromFiles(normalizedName);

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
      (field.mapsTo === null ||
        typeof field.mapsTo === 'string' ||
        (Array.isArray(field.mapsTo) &&
          field.mapsTo.every((p) => typeof p === 'string'))) &&
      typeof field.type === 'string' &&
      typeof field.required === 'boolean'
    );
  }
}
