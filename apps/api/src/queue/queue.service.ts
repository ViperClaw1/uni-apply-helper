import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue, QueueOptions } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  async addJob(queueName: string, data: unknown, opts: JobsOptions = {}) {
    return this.getQueue(queueName).add(queueName, data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
      ...opts,
    });
  }

  async getJobStatus(queueName: string, jobId: string) {
    const job = await this.getQueue(queueName).getJob(jobId);

    return job?.getState();
  }

  private getQueue(name: string): Queue {
    const existingQueue = this.queues.get(name);

    if (existingQueue) {
      return existingQueue;
    }

    const queue = new Queue(name, {
      connection: this.getRedisConnection(),
    });

    this.queues.set(name, queue);

    return queue;
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
