import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { QueueService } from '../queue/queue.service.js';
import { ReloginViewerService } from './relogin-viewer.service.js';

const IN_FLIGHT_STATUSES = new Set(['active', 'waiting', 'delayed']);

@Controller('universities')
@UseGuards(SessionAuthGuard)
export class ReloginViewerController {
  constructor(
    private readonly reloginViewerService: ReloginViewerService,
    private readonly queueService: QueueService,
  ) {}

  @Post('relogin-viewer-ticket')
  async mintTicket(@Body('jobId') jobId?: string) {
    if (!jobId?.trim()) {
      throw new BadRequestException('jobId is required.');
    }

    const job = await this.queueService.getJobDetails(
      QUEUES.BROWSER_RELOGIN,
      jobId,
    );

    if (!IN_FLIGHT_STATUSES.has(job.status)) {
      throw new BadRequestException(
        `Relogin job "${jobId}" is not currently running (status: ${job.status}).`,
      );
    }

    const ticket = await this.reloginViewerService.mintTicket(jobId);

    return { ticket, expiresInMs: 60_000 };
  }
}
