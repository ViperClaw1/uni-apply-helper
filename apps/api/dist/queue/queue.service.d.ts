import { OnModuleDestroy } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
export declare class QueueService implements OnModuleDestroy {
    private readonly queues;
    onModuleDestroy(): Promise<void>;
    addJob(queueName: string, data: unknown, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string>>;
    getJobStatus(queueName: string, jobId: string): Promise<import("bullmq").JobState | "unknown" | undefined>;
    private getQueue;
    private getRedisConnection;
}
