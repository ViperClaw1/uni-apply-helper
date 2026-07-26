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

const CONFIRM_PASSPORT_BTN = [
  'input[value="Confirm Passport Information"]',
  'input[value*="Confirm Passport"]',
  'button:has-text("Confirm Passport")',
].join(', ');

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

@Injectable()
export class OcrPassportUploader {
  /**
   * PKU Step 1 flow (from live screenshots):
   * 1. Upload Image → filechooser (OSS)
   * 2. "It's processing!" dialog while OCR runs; Confirm is greyed/disabled
   * 3. OCR fills Recognized Information; Confirm turns blue/enabled
   * 4. Click Confirm → apply.* sync
   * 5. Upload personal photo
   */
  async upload(page: Page, profile: StudentProfile): Promise<void> {
    await this.uploadPassportViaButton(page, profile.documents.passport);
    await this.waitForOcrReady(page);
    await this.confirmPassportOcr(page);
    await this.waitForProcessingGone(page, 45_000);
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
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15_000 }),
      btn.click({ force: true }),
    ]);

    await fileChooser.setFiles(file);
    await page.waitForTimeout(1_000);
  }

  /**
   * Wait until OCR finishes: processing dialog gone + Confirm enabled (blue).
   * Do NOT rely on input[name="ocr.*"] — Recognized Information may render
   * values in table cells / styled inputs with different names.
   */
  private async waitForOcrReady(page: Page): Promise<void> {
    await this.waitForProcessingGone(page, 90_000);

    const ready = await page
      .waitForFunction(
        () => {
          const processing =
            /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
              document.body?.innerText ?? '',
            );
          if (processing) {
            return false;
          }

          const confirm = [
            ...document.querySelectorAll(
              'input[type="button"], input[type="submit"], button',
            ),
          ].find((el) =>
            /Confirm Passport/i.test(
              ((el as HTMLInputElement).value || el.textContent || '').trim(),
            ),
          ) as HTMLInputElement | HTMLButtonElement | undefined;

          if (!confirm) {
            return false;
          }

          if (confirm.disabled) {
            return false;
          }

          const style = getComputedStyle(confirm);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.pointerEvents === 'none'
          ) {
            return false;
          }

          // Greyed-out Confirm (Image 1) vs active blue (Image 2)
          const bg = style.backgroundColor || '';
          const opacity = Number(style.opacity || '1');
          if (opacity < 0.6) {
            return false;
          }

          // Disabled-looking grey backgrounds (#ccc / light gray)
          const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (rgb) {
            const [, r, g, b] = rgb.map(Number);
            const isGrey =
              Math.abs(r - g) < 12 &&
              Math.abs(g - b) < 12 &&
              r > 160 &&
              r < 230;
            if (isGrey) {
              return false;
            }
          }

          // Soft check: some recognized value present (surname / passport no)
          const body = document.body?.innerText ?? '';
          const hasRecognizedBlock = /Recognized Information/i.test(body);
          const hasLikelyData =
            /Passport No|护照|Surname|姓/i.test(body) &&
            (/[A-Z]{2,}/.test(body) || /\d{6,}/.test(body));

          return hasRecognizedBlock ? hasLikelyData : true;
        },
        { timeout: 90_000 },
      )
      .then(() => true)
      .catch(() => false);

    if (!ready) {
      throw new Error(
        'OCR did not finish: Confirm Passport Information stayed disabled/grey. ' +
          'Upload Image / OSS / recognition likely failed.',
      );
    }

    await page.waitForTimeout(500);
  }

  private async waitForProcessingGone(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    await page
      .waitForFunction(
        () => {
          const text = document.body?.innerText ?? '';
          if (
            /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
              text,
            )
          ) {
            return false;
          }

          const messager = document.querySelector(
            '.messager-window:not([style*="display: none"]), .messager-body',
          );
          if (messager) {
            const t = (messager.textContent || '').trim();
            if (/processing|please wait|请求正在处理/i.test(t)) {
              return false;
            }
          }

          return true;
        },
        { timeout: timeoutMs },
      )
      .catch(() => undefined);
  }

  private async confirmPassportOcr(page: Page): Promise<void> {
    const confirm = page.locator(CONFIRM_PASSPORT_BTN).first();

    await confirm
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined);

    if ((await confirm.count()) === 0) {
      throw new Error('Confirm Passport Information button not found');
    }

    // Ensure enabled before click — force:true would click a greyed button.
    await page
      .waitForFunction(() => {
        const btn = [
          ...document.querySelectorAll(
            'input[type="button"], input[type="submit"], button',
          ),
        ].find((el) =>
          /Confirm Passport/i.test(
            ((el as HTMLInputElement).value || el.textContent || '').trim(),
          ),
        ) as HTMLInputElement | undefined;
        return Boolean(btn && !btn.disabled);
      }, { timeout: 15_000 })
      .catch(() => undefined);

    await confirm.scrollIntoViewIfNeeded().catch(() => undefined);
    await (confirm as Locator).click({ force: false });
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
}
