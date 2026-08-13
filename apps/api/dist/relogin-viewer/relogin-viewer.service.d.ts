import { OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
export declare class ReloginViewerService implements OnModuleDestroy {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis);
    onModuleDestroy(): Promise<void>;
    mintTicket(jobId: string): Promise<string>;
    consumeTicket(ticket: string): Promise<string | null>;
    proxy(ws: WebSocket, jobId: string): void;
}
