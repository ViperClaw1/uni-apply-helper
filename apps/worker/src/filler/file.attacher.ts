import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';

@Injectable()
export class FileAttacher {
  async attachFiles(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
  ): Promise<void> {
    const fileFields = fields.filter(
      (field) => field.type === 'file' && field.documentType,
    );

    for (const field of fileFields) {
      const fileUrl = profile.documents[field.documentType!];

      if (!fileUrl) {
        if (field.required) {
          throw new Error(`Missing required document: ${field.documentType}`);
        }

        continue;
      }

      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to download document ${field.documentType}`);
      }

      const contentType =
        response.headers.get('content-type') ?? 'application/octet-stream';
      const buffer = Buffer.from(await response.arrayBuffer());

      await page.locator(field.selector).setInputFiles({
        name: `${field.documentType}.pdf`,
        mimeType: contentType,
        buffer,
      });
    }
  }
}

