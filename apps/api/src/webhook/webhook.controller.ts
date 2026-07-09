import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service.js';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('google-form')
  @HttpCode(200)
  async handleGoogleForm(@Body() body: Record<string, unknown>) {
    await this.webhookService.processFormSubmission(body);

    return { ok: true };
  }
}
