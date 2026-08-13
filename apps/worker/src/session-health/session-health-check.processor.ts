import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import { Queue, Worker } from 'bullmq';
import { BrowserService } from '../browser/browser.service.js';
import { assertSessionValid } from '../browser/session.validator.js';
import { AttentionRequiredError } from '../errors/attention-required.error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationResumeService } from '../queue/application-resume.service.js';
import { getRedisConnection } from '../queue/redis.config.js';
import { UniversitySchemaService } from '../university-schema/university-schema.service.js';

const SCHEDULER_ID = 'session-health-check';
const DEFAULT_INTERVAL_MS = 45 * 60_000;
/** How close to expiresAt counts as "stale" rather than "fresh". */
const STALE_THRESHOLD_MS = 2 * 60 * 60_000;

@Injectable()
export class SessionHealthCheckProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SessionHealthCheckProcessor.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly browserService: BrowserService,
    private readonly prisma: PrismaService,
    private readonly universitySchemaService: UniversitySchemaService,
    private readonly applicationResumeService: ApplicationResumeService,
  ) {}

  async onModuleInit() {
    const connection = getRedisConnection();
    const intervalMs =
      Number(process.env.SESSION_HEALTH_CHECK_INTERVAL_MS) ||
      DEFAULT_INTERVAL_MS;

    this.queue = new Queue(QUEUES.SESSION_HEALTH_CHECK, { connection });
    // immediately: false — upsertJobScheduler fires on first registration by default, which
    // would mean every worker restart/redeploy re-runs a live health check against every
    // seeded university's real site. We only want the recurring cadence, not a boot-time run.
    await this.queue.upsertJobScheduler(SCHEDULER_ID, {
      every: intervalMs,
      immediately: false,
    });

    this.worker = new Worker(
      QUEUES.SESSION_HEALTH_CHECK,
      () => this.process(),
      { connection },
    );

    this.logger.log(
      `Listening on queue "${QUEUES.SESSION_HEALTH_CHECK}" (every ${intervalMs}ms)`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async process(): Promise<void> {
    const universityIds = await this.universitySchemaService.listIds();

    for (const universityId of universityIds) {
      try {
        await this.checkOne(universityId);
      } catch (error) {
        this.logger.warn(
          `Health check failed to run for "${universityId}": ${(error as Error).message}`,
        );
      }
    }
  }

  private async checkOne(universityId: string): Promise<void> {
    const university = await this.universitySchemaService.get(universityId);
    // The bare origin isn't session-aware on every platform — on 17gz (pku/kmmc/csu/...) it
    // IS the public login gate regardless of auth state, so it can never confirm a session is
    // valid. formUrl is the same page OpenFormStep already navigates to for real jobs, so it
    // reliably differs between an authenticated and expired session.
    const targetUrl = university.session?.healthCheckUrl ?? university.formUrl;

    if (!targetUrl) {
      return;
    }

    const previous = await this.prisma.browserSession.findUnique({
      where: { universityId },
      select: { status: true },
    });

    try {
      await this.browserService.withPageOptions(
        { universityId },
        async (page) => {
          await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          await assertSessionValid(page, university);
        },
      );

      await this.recordResult(universityId, 'valid');

      if (
        previous &&
        previous.status !== 'fresh' &&
        previous.status !== 'stale'
      ) {
        await this.applicationResumeService.resumePausedApplications(
          universityId,
        );
      }
    } catch (error) {
      await this.recordResult(
        universityId,
        error instanceof AttentionRequiredError
          ? 'attention_required'
          : 'expired',
      );
      throw error;
    }
  }

  private async recordResult(
    universityId: string,
    outcome: 'valid' | 'expired' | 'attention_required',
  ): Promise<void> {
    const now = new Date();

    if (outcome !== 'valid') {
      await this.prisma.browserSession.upsert({
        where: { universityId },
        create: {
          universityId,
          status: outcome,
          lastValidatedAt: now,
          validationMethod: 'health_check',
          consecutiveFailures: 1,
        },
        update: {
          status: outcome,
          lastValidatedAt: now,
          validationMethod: 'health_check',
          consecutiveFailures: { increment: 1 },
        },
      });
      return;
    }

    const existing = await this.prisma.browserSession.findUnique({
      where: { universityId },
    });
    const status = this.isNearExpiry(existing?.expiresAt ?? null, now)
      ? 'stale'
      : 'fresh';

    await this.prisma.browserSession.upsert({
      where: { universityId },
      create: {
        universityId,
        status,
        lastValidatedAt: now,
        validationMethod: 'health_check',
        consecutiveFailures: 0,
      },
      update: {
        status,
        lastValidatedAt: now,
        validationMethod: 'health_check',
        consecutiveFailures: 0,
      },
    });
  }

  private isNearExpiry(expiresAt: Date | null, now: Date): boolean {
    if (!expiresAt) {
      return false;
    }

    return expiresAt.getTime() - now.getTime() <= STALE_THRESHOLD_MS;
  }
}
