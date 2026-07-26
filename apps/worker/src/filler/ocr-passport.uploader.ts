import { Injectable } from '@nestjs/common';
import type { StudentProfile } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';

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
   * PKU Step 1: Upload Image (OSS filechooser) → Confirm OCR → photo.
   *
   * Do NOT setInputFiles on hidden ATTACH_TYPE_passportImage — Aliyun OSS
   * signed params (OSSAccessKeyId/policy/signature) are only filled when the
   * native file dialog selects a file. Playwright must intercept filechooser
   * via locator.click() (CDP), never evaluate().click().
   */
  async upload(page: Page, profile: StudentProfile): Promise<void> {
    await this.uploadPassportViaButton(page, profile.documents.passport);
    await this.confirmPassportOcr(page);
    await this.waitForOcr(page);
    await this.uploadPhoto(page, profile.documents.photo);
  }

  private async uploadPassportViaButton(
    page: Page,
    fileUrl: string | undefined,
  ): Promise<void> {
    if (!fileUrl) {
      throw new Error('Missing required document: passport');
    }

    const file = await this.downloadFile(fileUrl, 'passport');

    await page
      .waitForSelector(UPLOAD_IMAGE_BTN, { state: 'attached', timeout: 20_000 })
      .catch(() => undefined);

    // Prefer exact value match — PKU OCR widget button.
    const uploadBtn = page.locator('input[value="Upload Image"]').first();
    const btn =
      (await uploadBtn.count()) > 0
        ? uploadBtn
        : page.locator(UPLOAD_IMAGE_BTN).first();

    if ((await btn.count()) === 0) {
      throw new Error('Upload Image button not found for OCR passport');
    }

    await btn.scrollIntoViewIfNeeded().catch(() => undefined);

    // locator.click (CDP) — required for Playwright to intercept filechooser.
    // evaluate(btn.click()) opens the dialog without a chooser event.
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15_000 }),
      btn.click({ force: true }),
    ]);

    await fileChooser.setFiles(file);

    // OSS direct upload + 17gz callback — wait for activity to settle.
    await this.waitForOssUpload(page);
  }

  private async waitForOssUpload(page: Page): Promise<void> {
    // Give the OSS POST a moment to start.
    await page.waitForTimeout(1_000);

    await page
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .catch(() => undefined);

    // Dialog / processing overlay after OSS select
    await page
      .waitForFunction(
        () =>
          !/It'?s processing|请求正在处理中|please wait|processing your request|uploading/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: 45_000 },
      )
      .catch(() => undefined);

    // Soft signal: OSS form got a key / signature, or preview appeared
    await page
      .waitForFunction(
        () => {
          const key = document.querySelector(
            'input[name="key"], input[name="OSSAccessKeyId"]',
          ) as HTMLInputElement | null;
          if (key?.value && key.value.trim().length > 0) {
            return true;
          }
          // Some portals show filename / thumb after upload
          const body = document.body?.innerText ?? '';
          return /passport\.(jpg|jpeg|png|pdf)|upload\s*success|上传成功/i.test(
            body,
          );
        },
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    await page.waitForTimeout(800);
  }

  private async uploadPhoto(
    page: Page,
    fileUrl: string | undefined,
  ): Promise<void> {
    if (!fileUrl) {
      throw new Error('Missing required document: photo');
    }

    const file = await this.downloadFile(fileUrl, 'photo');

    await page
      .waitForSelector(PHOTO_INPUT, { state: 'attached', timeout: 20_000 })
      .catch(() => undefined);

    const input = page.locator(PHOTO_INPUT).first();
    if ((await input.count()) === 0) {
      throw new Error(`File input not found: ${PHOTO_INPUT}`);
    }

    // Personal photo is a normal <input type=file> — setInputFiles is fine.
    await input.setInputFiles(file);
    await page.waitForTimeout(500);
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
    // Playwright locator click — same CDP path as Upload Image.
    const confirm = page
      .locator(
        [
          'input[value="Confirm Passport Information"]',
          'input[value*="Confirm Passport"]',
          'button:has-text("Confirm Passport")',
        ].join(', '),
      )
      .first();

    await confirm
      .waitFor({ state: 'attached', timeout: 15_000 })
      .catch(() => undefined);

    if ((await confirm.count()) === 0) {
      throw new Error('Confirm Passport Information button not found');
    }

    await confirm.scrollIntoViewIfNeeded().catch(() => undefined);
    await (confirm as Locator).click({ force: true });
    await page.waitForTimeout(800);
  }

  private async waitForOcr(page: Page): Promise<void> {
    const filled = await page
      .waitForFunction(
        () => {
          const passportNo = document.querySelector(
            'input[name="ocr.passportNo"]',
          ) as HTMLInputElement | null;
          const lastName = document.querySelector(
            'input[name="ocr.lastName"]',
          ) as HTMLInputElement | null;
          const givenName = document.querySelector(
            'input[name="ocr.givenName"]',
          ) as HTMLInputElement | null;

          return Boolean(
            (passportNo?.value && passportNo.value.trim().length > 2) ||
              (lastName?.value && lastName.value.trim().length > 0) ||
              (givenName?.value && givenName.value.trim().length > 0),
          );
        },
        { timeout: 60_000 },
      )
      .then(() => true)
      .catch(() => false);

    await page
      .waitForFunction(
        () =>
          !/It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: 60_000 },
      )
      .catch(() => undefined);

    if (!filled) {
      throw new Error(
        'OCR passport did not populate ocr.* fields after Confirm. ' +
          'Upload Image / OSS callback likely failed.',
      );
    }

    await page.waitForTimeout(500);
  }
}
