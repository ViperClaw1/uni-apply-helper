import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';

@Injectable()
export class ScreenshotService {
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly publicUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('R2_BUCKET');
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL');

    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: this.configService.get<string>('R2_REGION') ?? 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  async capture(page: Page, applicationId: string, label: string): Promise<string> {
    if (!this.s3 || !this.bucket || !this.publicUrl) {
      throw new ServiceUnavailableException('R2 storage is not configured.');
    }

    const body = await page.screenshot({ fullPage: true, type: 'png' });
    const key = [
      'applications',
      applicationId,
      'screenshots',
      `${label}-${randomUUID()}.png`,
    ].join('/');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'image/png',
      }),
    );

    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }
}

