import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private readonly configService;
    private readonly logger;
    private readonly bot?;
    private readonly chatId?;
    constructor(configService: ConfigService);
    notifySubmitted(universityName: string, studentName: string, screenshotUrl?: string): Promise<void>;
    notifyFailed(universityName: string, studentName: string, error: string): Promise<void>;
    notifySessionExpired(universityName: string, universityId: string): Promise<void>;
    notifyReloginStarted(universityName: string, universityId: string, profileDir?: string): Promise<void>;
    notifyReloginCompleted(universityName: string, universityId: string): Promise<void>;
    private send;
    private escapeHtml;
}
