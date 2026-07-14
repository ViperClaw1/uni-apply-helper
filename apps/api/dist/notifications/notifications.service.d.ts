import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private readonly configService;
    private readonly logger;
    private readonly bot?;
    private readonly chatId?;
    constructor(configService: ConfigService);
    notifyNewStudent(student: {
        givenName?: string;
        surname?: string;
        email?: string;
    }): Promise<void>;
    notifyBatchCreated(batch: {
        total: number;
        blocked: number;
    }, profile: any): Promise<void>;
    notifySubmitted(universityName: string, studentName: string, screenshotUrl?: string): Promise<void>;
    notifyFailed(universityName: string, studentName: string, error: string): Promise<void>;
    notifyBlocked(studentName: string, universityName: string, missing: string[]): Promise<void>;
    notifyUnresolved(studentName: string, unresolved: Array<{
        rawName: string;
        candidates: Array<{
            id: string;
            displayName: string;
            score: number;
        }>;
    }>): Promise<void>;
    private send;
    private escapeHtml;
}
