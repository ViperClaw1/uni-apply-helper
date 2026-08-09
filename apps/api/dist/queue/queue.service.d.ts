import { OnModuleDestroy } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
export declare class QueueService implements OnModuleDestroy {
    private readonly queues;
    onModuleDestroy(): Promise<void>;
    addJob(queueName: string, data: unknown, opts?: JobsOptions): Promise<any>;
    getJobStatus(queueName: string, jobId: string): Promise<any>;
    private getQueue;
    private getRedisConnection;
}
