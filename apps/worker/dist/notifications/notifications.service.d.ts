import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private readonly configService;
    private readonly logger;
    private readonly bot?;
    private readonly chatId?;
    constructor(configService: ConfigService);
    notifySubmitted(universityName: string, studentName: string, screenshotUrl?: string): Promise<void>;
    notifyFailed(universityName: string, studentName: string, error: string): Promise<void>;
    private send;
    private escapeHtml;
}
