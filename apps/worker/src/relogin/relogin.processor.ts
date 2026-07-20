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
import { getRedisConnection } from '../queue/redis.config.js';

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
  ) {}

  onModuleInit() {
    this.worker = new Worker<BrowserReloginJobData>(
      QUEUES.BROWSER_RELOGIN,
      (job) => this.process(job),
      {
        connection: getRedisConnection(),
      },
    );

    this.logger.log(`Listening on queue "${QUEUES.BROWSER_RELOGIN}"`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<BrowserReloginJobData>) {
    const university = await this.prisma.universitySchema.findUnique({
      where: { id: job.data.universityId },
    });

    if (!university) {
      throw new Error(`University "${job.data.universityId}" was not found.`);
    }

    const profileDir = this.browserService.getProfileDir(university.id);
    const loginUrl = getLoginUrl(university.formUrl);

    await this.notificationsService.notifyReloginStarted(
      university.displayName,
      university.id,
      profileDir,
    );

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
            await this.notificationsService.notifyReloginCompleted(
              university.displayName,
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
  }
}
