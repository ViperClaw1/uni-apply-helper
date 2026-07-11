import { WebhookService } from './webhook.service.js';
export declare class WebhookController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    handleGoogleForm(body: unknown): Promise<{
        ok: boolean;
    }>;
}
