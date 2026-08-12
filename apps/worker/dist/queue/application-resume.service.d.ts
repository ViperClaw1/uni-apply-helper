import { PrismaService } from '../prisma/prisma.service.js';
export declare class ApplicationResumeService {
    private readonly prisma;
    private readonly logger;
    private queue?;
    constructor(prisma: PrismaService);
    resumePausedApplications(universityId: string): Promise<number>;
    private getQueue;
}
