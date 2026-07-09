import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { QUEUES } from '@uni-apply/shared';
import { Job, QueueOptions, Worker } from 'bullmq';
import { ParserService } from './parser.service.js';
import type { DocumentParseJobData } from './types/document-api.types.js';

@Injectable()
export class DocumentParseWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentParseWorker.name);
  private worker?: Worker<DocumentParseJobData>;

  constructor(private readonly parserService: ParserService) {}

  onModuleInit() {
    this.worker = new Worker<DocumentParseJobData>(
      QUEUES.DOCUMENT_PARSE,
      (job) => this.process(job),
      {
        connection: this.getRedisConnection(),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Document parse job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<DocumentParseJobData>) {
    return this.parserService.parseDocument(job.data.documentId);
  }

  private getRedisConnection(): QueueOptions['connection'] {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return {
        host: 'localhost',
        port: 6379,
      };
    }

    const parsedUrl = new URL(redisUrl);

    return {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 6379),
      username: parsedUrl.username || undefined,
      password: parsedUrl.password || undefined,
      tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
    };
  }
}

