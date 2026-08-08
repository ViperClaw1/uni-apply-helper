import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    sendVerificationEmail(to: string, verifyUrl: string): Promise<void>;
}
