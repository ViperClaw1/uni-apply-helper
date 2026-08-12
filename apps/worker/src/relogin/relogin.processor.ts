import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import { Job, Worker } from 'bullmq';
import { BrowserService } from '../browser/browser.service.js';
import { getLoginUrl } from '../browser/session.validator.js';
import { isLoginPage } from '../browser/zzu-session.loader.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationResumeService } from '../queue/application-resume.service.js';
import { getRedisConnection } from '../queue/redis.config.js';
import { UniversitySchemaService } from '../university-schema/university-schema.service.js';

type BrowserReloginJobData = {
  universityId: string;
};

@Injectable()
export class ReloginProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReloginProcessor.name);
  private worker?: Worker<BrowserReloginJobData>;

  constructor(
    private readonly browserService: BrowserService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly universitySchemaService: UniversitySchemaService,
    private readonly applicationResumeService: ApplicationResumeService,
  ) {}

  onModuleInit() {
    // Waits up to 15 min for a human to log in. BullMQ default lockDuration is 30s — if the
    // worker process stalls or redeploys mid-wait, Redis marks the job stalled and BullMQ
    // retries it, opening a second headed browser and re-sending the "re-login started"
    // notification for the same university. Same fix as the main application Processor.
    this.worker = new Worker<BrowserReloginJobData>(
      QUEUES.BROWSER_RELOGIN,
      (job) => this.process(job),
      {
        connection: getRedisConnection(),
        lockDuration: 16 * 60_000,
        stalledInterval: 60_000,
        maxStalledCount: 1,
      },
    );

    this.logger.log(`Listening on queue "${QUEUES.BROWSER_RELOGIN}"`);

    // Backstop for failures that never reach process()'s own catch (e.g. a stall/crash mid-job)
    // — without this, a dead job is silent: no notification, and the dashboard polls forever.
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Relogin job ${job?.id ?? 'unknown'} (university ${job?.data?.universityId ?? 'unknown'}) failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<BrowserReloginJobData>) {
    const university = await this.universitySchemaService.get(
      job.data.universityId,
    );

    const profileDir = this.browserService.getProfileDir(university.id);
    const loginUrl = getLoginUrl(university.formUrl);

    await this.notificationsService.notifyReloginStarted(
      university.displayName,
      university.id,
      profileDir,
    );

    try {
      await this.browserService.withPageOptions(
        { universityId: university.id, headed: true },
        async (page) => {
          await page.goto(loginUrl, {
            waitUntil: 'networkidle',
            timeout: 60_000,
          });

          const deadline = Date.now() + 15 * 60_000;

          while (Date.now() < deadline) {
            if (!(await isLoginPage(page))) {
              await this.recordCaptured(
                university.id,
                university.session?.sessionTtlHours,
              );
              await this.notificationsService.notifyReloginCompleted(
                university.displayName,
                university.id,
              );
              await this.applicationResumeService.resumePausedApplications(
                university.id,
              );
              return;
            }

            await page.waitForTimeout(2_000);
          }

          throw new Error(
            `Re-login timed out for ${university.displayName} — login not completed within 15 minutes`,
          );
        },
      );
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // Playwright's own message when `headless:false` has no X server to attach to — this
      // worker's container has no virtual display, so every headed launch fails this way.
      const isNoDisplay = /XServer|Xvfb|X server|DISPLAY environment/i.test(
        rawMessage,
      );
      const message = isNoDisplay
        ? `This worker can't open a headed browser — no virtual display is configured here. Capture the session locally instead (see apps/worker/scripts/capture-*-session.mjs) and update the deployed session for ${university.displayName}.`
        : rawMessage;

      await this.notificationsService.notifyReloginFailed(
        university.displayName,
        university.id,
        message,
      );

      throw isNoDisplay ? new Error(message) : error;
    }
  }

  private async recordCaptured(
    universityId: string,
    sessionTtlHours?: number,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = sessionTtlHours
      ? new Date(now.getTime() + sessionTtlHours * 3_600_000)
      : null;

    await this.prisma.browserSession.upsert({
      where: { universityId },
      create: {
        universityId,
        status: 'fresh',
        capturedAt: now,
        lastValidatedAt: now,
        expiresAt,
        validationMethod: 'relogin',
        consecutiveFailures: 0,
      },
      update: {
        status: 'fresh',
        capturedAt: now,
        lastValidatedAt: now,
        expiresAt,
        validationMethod: 'relogin',
        consecutiveFailures: 0,
      },
    });
  }
}
