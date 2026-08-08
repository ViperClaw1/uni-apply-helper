import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      this.logger.warn(
        `RESEND_API_KEY/EMAIL_FROM not configured — logging verification link instead of emailing ${to}: ${verifyUrl}`,
      );
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Confirm your email — LotsApply',
        html: `<p>Click the link below to confirm your email and finish setting up your LotsApply account.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Resend request failed (${response.status}): ${body}`);
      throw new Error('Failed to send verification email.');
    }
  }
}
