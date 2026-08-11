import { Injectable, Logger } from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { getRedisConnection } from './redis.config.js';

const PAUSED_STATUSES = ['waiting_for_login', 'attention_required'];

/** Un-pauses applications that were parked on a bad university session, once that session is fixed. */
@Injectable()
export class ApplicationResumeService {
  private readonly logger = new Logger(ApplicationResumeService.name);
  private queue?: Queue;

  constructor(private readonly prisma: PrismaService) {}

  async resumePausedApplications(universityId: string): Promise<number> {
    const applications = await this.prisma.application.findMany({
      where: { universityId, status: { in: PAUSED_STATUSES } },
      select: {
        id: true,
        batchId: true,
        batch: { select: { studentId: true } },
      },
    });

    if (applications.length === 0) {
      return 0;
    }

    await this.prisma.application.updateMany({
      where: { id: { in: applications.map((application) => application.id) } },
      data: { status: 'queued', errorMessage: null },
    });

    await Promise.all(
      applications.map((application) =>
        this.prisma.applicationStep.create({
          data: {
            applicationId: application.id,
            stepName: 'session_resumed',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          },
        }),
      ),
    );

    const queue = this.getQueue();

    await Promise.all(
      applications.map((application) =>
        queue.add(QUEUES.APPLICATION_PROCESS, {
          applicationId: application.id,
          batchId: application.batchId,
          studentId: application.batch.studentId,
          universityId,
        }),
      ),
    );

    this.logger.log(
      `Resumed ${applications.length} paused application(s) for university "${universityId}"`,
    );

    return applications.length;
  }

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(QUEUES.APPLICATION_PROCESS, {
        connection: getRedisConnection(),
      });
    }

    return this.queue;
  }
}
