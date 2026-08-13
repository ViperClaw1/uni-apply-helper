import { QueueService } from '../queue/queue.service.js';
import { ReloginViewerService } from './relogin-viewer.service.js';
export declare class ReloginViewerController {
    private readonly reloginViewerService;
    private readonly queueService;
    constructor(reloginViewerService: ReloginViewerService, queueService: QueueService);
    mintTicket(jobId?: string): Promise<{
        ticket: string;
        expiresInMs: number;
    }>;
}
