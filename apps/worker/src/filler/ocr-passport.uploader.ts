import { Injectable } from '@nestjs/common';
import type { StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';

const OCR_PASSPORT_INPUT = [
  'input[name="ATTACH_TYPE_passportImage"]',
  'input[type="file"][name="ATTACH_TYPE_passportImage"]',
  '[attachTypeId="ATTACH_TYPE_passportImage"] input[type="file"]',
].join(', ');

const PHOTO_INPUT =
  'input[type="file"][name="photo"], input[name="photo"][type="file"]';

const UPLOAD_IMAGE_BTN = [
  'input[value="Upload Image"]',
  'input[value*="Upload Image"]',
  'button:has-text("Upload Image")',
  'a:has-text("Upload Image")',
  'input[value="上传图片"]',
  'button:has-text("上传图片")',
].join(', ');

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

@Injectable()
export class OcrPassportUploader {
  /**
   * PKU Step 1: upload passport → Confirm OCR → wait → upload personal photo.
   * OCR auto-fills ocr.* / apply.* fields; photo is required before Next.
   *
   * PKU creates ATTACH_TYPE_passportImage only after "Upload Image" (OSS form).
   * Prefer filechooser intercept; fall back to direct setInputFiles.
   */
  async upload(page: Page, profile: StudentProfile): Promise<void> {
    await this.uploadPassport(page, profile.documents.passport);
    await this.confirmPassportOcr(page);
    await this.waitForOcr(page);
    await this.uploadViaSelector(
      page,
      PHOTO_INPUT,
      profile.documents.photo,
      'photo',
      true,
    );
  }

  private async uploadPassport(
    page: Page,
    fileUrl: string | undefined,
  ): Promise<void> {
    if (!fileUrl) {
      throw new Error('Missing required document: passport');
    }

    const file = await this.downloadFile(fileUrl, 'passport');

    // 1) Direct input (ZZU/KMMC / already in DOM)
    if (await this.trySetInputFiles(page, OCR_PASSPORT_INPUT, file)) {
      await page.waitForTimeout(500);
      return;
    }

    // 2) PKU: "Upload Image" opens native chooser / injects OSS file input
    await page
      .waitForSelector(UPLOAD_IMAGE_BTN, { state: 'attached', timeout: 15_000 })
      .catch(() => undefined);

    const uploadBtn = page.locator(UPLOAD_IMAGE_BTN).first();
    if ((await uploadBtn.count()) > 0) {
      const viaChooser = await this.tryFileChooser(page, uploadBtn, file);
      if (viaChooser) {
        await page.waitForTimeout(800);
        return;
      }

      // Click may have injected the input without firing chooser to Playwright
      await page
        .waitForSelector(OCR_PASSPORT_INPUT, {
          state: 'attached',
          timeout: 10_000,
        })
        .catch(() => undefined);

      if (await this.trySetInputFiles(page, OCR_PASSPORT_INPUT, file)) {
        await page.waitForTimeout(500);
        return;
      }

      // Any new file input that appeared after the click (except photo)
      const generic = page
        .locator(
          'input[type="file"]:not([name="photo"]):not([name*="photo"])',
        )
        .last();
      if ((await generic.count()) > 0) {
        await generic.setInputFiles(file);
        await page.waitForTimeout(500);
        return;
      }
    }

    throw new Error(
      `File input not found: ${OCR_PASSPORT_INPUT} (and Upload Image / filechooser failed)`,
    );
  }

  private async uploadViaSelector(
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

    const file = await this.downloadFile(fileUrl, documentType);

    await page
      .waitForSelector(selector, { state: 'attached', timeout: 20_000 })
      .catch(() => undefined);

    if (await this.trySetInputFiles(page, selector, file)) {
      await page.waitForTimeout(500);
      return;
    }

    if (required) {
      throw new Error(`File input not found: ${selector}`);
    }
  }

  private async trySetInputFiles(
    page: Page,
    selector: string,
    file: FilePayload,
  ): Promise<boolean> {
    await page
      .waitForSelector(selector, { state: 'attached', timeout: 3_000 })
      .catch(() => undefined);

    const input = page.locator(selector).first();
    if ((await input.count()) === 0) {
      return false;
    }

    await input.setInputFiles(file);
    return true;
  }

  private async tryFileChooser(
    page: Page,
    uploadBtn: ReturnType<Page['locator']>,
    file: FilePayload,
  ): Promise<boolean> {
    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 8_000 }),
        uploadBtn.click({ force: true }),
      ]);
      await fileChooser.setFiles(file);
      return true;
    } catch {
      // Click may have already fired and injected OSS input without chooser event.
      await page.waitForTimeout(500);
      return false;
    }
  }

  private async downloadFile(
    fileUrl: string,
    documentType: string,
  ): Promise<FilePayload> {
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

    return {
      name: `${documentType}.${ext}`,
      mimeType: contentType,
      buffer,
    };
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

    await page
      .waitForLoadState('networkidle', { timeout: 20_000 })
      .catch(() => undefined);

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
