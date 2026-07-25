import { Injectable } from '@nestjs/common';
import type { StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';

const OCR_PASSPORT_INPUT =
  'input[name="ATTACH_TYPE_passportImage"], input[type="file"][name="ATTACH_TYPE_passportImage"]';
const PHOTO_INPUT = 'input[type="file"][name="photo"]';

@Injectable()
export class OcrPassportUploader {
  /**
   * PKU Step 1: upload passport → Confirm OCR → wait → upload personal photo.
   * OCR auto-fills ocr.* / apply.* fields; photo is required before Next.
   */
  async upload(page: Page, profile: StudentProfile): Promise<void> {
    await this.uploadDocument(
      page,
      OCR_PASSPORT_INPUT,
      profile.documents.passport,
      'passport',
      true,
    );

    await this.confirmPassportOcr(page);
    await this.waitForOcr(page);

    await this.uploadDocument(
      page,
      PHOTO_INPUT,
      profile.documents.photo,
      'photo',
      true,
    );
  }

  private async uploadDocument(
    page: Page,
    selector: string,
    fileUrl: string | undefined,
    documentType: string,
    required: boolean,
  ): Promise<void> {
    if (!fileUrl) {
      if (required) {
        throw new Error(`Missing required document: ${documentType}`);
      }
      return;
    }

    const input = page.locator(selector).first();
    if ((await input.count()) === 0) {
      if (required) {
        throw new Error(`File input not found: ${selector}`);
      }
      return;
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document ${documentType}`);
    }

    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : contentType.includes('pdf')
          ? 'pdf'
          : 'bin';

    await input.setInputFiles({
      name: `${documentType}.${ext}`,
      mimeType: contentType,
      buffer,
    });
    await page.waitForTimeout(500);
  }

  private async confirmPassportOcr(page: Page): Promise<void> {
    const clicked = await page.evaluate(() => {
      const btn = [
        ...document.querySelectorAll(
          'input[type="button"], input[type="submit"], button',
        ),
      ].find((el) =>
        /Confirm Passport/i.test(
          ((el as HTMLInputElement).value || el.textContent || '').trim(),
        ),
      ) as HTMLElement | undefined;

      if (!btn) {
        return false;
      }

      btn.click();
      return true;
    });

    if (!clicked) {
      const fallback = page
        .locator(
          'input[value*="Confirm Passport"], button:has-text("Confirm Passport")',
        )
        .first();
      if ((await fallback.count()) > 0) {
        await fallback.click({ force: true });
      }
    }

    await page.waitForTimeout(800);
  }

  private async waitForOcr(page: Page): Promise<void> {
    await page
      .waitForFunction(
        () => {
          const passportNo = document.querySelector(
            'input[name="ocr.passportNo"]',
          ) as HTMLInputElement | null;
          const lastName = document.querySelector(
            'input[name="ocr.lastName"]',
          ) as HTMLInputElement | null;
          const applyLast = document.querySelector(
            'input[name="apply.lastName"]',
          ) as HTMLInputElement | null;

          return Boolean(
            (passportNo?.value && passportNo.value.trim().length > 0) ||
              (lastName?.value && lastName.value.trim().length > 0) ||
              (applyLast?.value && applyLast.value.trim().length > 0),
          );
        },
        { timeout: 45_000 },
      )
      .catch(() => undefined);

    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

    // Processing overlay after OCR confirm
    await page
      .waitForFunction(
        () =>
          !/It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: 45_000 },
      )
      .catch(() => undefined);

    await page.waitForTimeout(500);
  }
}
