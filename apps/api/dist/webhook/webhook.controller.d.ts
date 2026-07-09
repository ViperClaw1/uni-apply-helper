import { WebhookService } from './webhook.service.js';
export declare class WebhookController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    handleGoogleForm(body: Record<string, unknown>): Promise<{
        ok: boolean;
    }>;
}
