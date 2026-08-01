import { Injectable, Logger } from '@nestjs/common';
import { getDocumentUrls, type StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';

const PHOTO_INPUT =
  'input[type="file"][name="photo"], input[name="photo"][type="file"]';

const UPLOAD_IMAGE_BTN = [
  'input[value="Upload Image"]',
  'input[value*="Upload Image"]',
  'button:has-text("Upload Image")',
  'a:has-text("Upload Image")',
].join(', ');

const CONFIRM_PASSPORT_BTN = [
  'input[value="Confirm Passport Information"]',
  'input[value*="Confirm Passport"]',
  'button:has-text("Confirm Passport")',
  'a:has-text("Confirm Passport")',
].join(', ');

const ADD_PHOTO_BTN = [
  'input[value="Add your photo"]',
  'input[value*="Add your photo"]',
  'button:has-text("Add your photo")',
  'a:has-text("Add your photo")',
].join(', ');

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

type OcrDebugState = {
  processingVisible: boolean;
  processingText: string;
  ocrFilled: Array<{ name: string; value: string }>;
  ocrFilledCount: number;
  confirmFound: boolean;
  confirmTag: string;
  confirmDisabled: boolean;
  confirmClass: string;
  applyLastName: string;
  applyPassportNo: string;
};

@Injectable()
export class OcrPassportUploader {
  private readonly logger = new Logger(OcrPassportUploader.name);

  /**
   * PKU Step 1 (verified against live screenshots):
   * Upload Image → wait OCR fields filled → Confirm → wait apply.* sync → photo.
   */
  async upload(page: Page, profile: StudentProfile): Promise<void> {
    this.logger.log('OCR step 1/4: upload passport via Upload Image + filechooser');
    await this.uploadPassportViaButton(
      page,
      getDocumentUrls(profile.documents, 'passport')[0],
    );

    this.logger.log('OCR step 2/4: wait Recognized Information filled');
    await this.waitForOcrReady(page);

    this.logger.log('OCR step 3/4: Confirm Passport Information');
    await this.confirmPassportOcr(page);

    this.logger.log('OCR step 4/4: dismiss copy dialog + wait apply.* + photo');
    await this.dismissInfoDialogs(page);
    await this.waitForApplySync(page);
    await this.dismissInfoDialogs(page);
    await this.closeDatePickers(page);
    await this.uploadPhoto(
      page,
      getDocumentUrls(profile.documents, 'photo')[0],
    );
    await this.dismissInfoDialogs(page);
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

    const btn = page.locator(UPLOAD_IMAGE_BTN).first();
    if ((await btn.count()) === 0) {
      throw new Error('Upload Image button not found for OCR passport');
    }

    await btn.scrollIntoViewIfNeeded().catch(() => undefined);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15_000 }),
      btn.click({ force: true }),
    ]);

    await fileChooser.setFiles(file);
    this.logger.log('Passport filechooser.setFiles done — waiting OCR');
  }

  /**
   * Ready = no visible processing dialog AND at least 2 filled ocr.* text inputs.
   * Screenshot proof: Surname/Given Name/Passport No are real <input name="ocr.*">.
   * Do NOT use button color heuristics — they false-negative on ready UI.
   */
  private async waitForOcrReady(page: Page): Promise<void> {
    const deadline = Date.now() + 90_000;
    let lastState: OcrDebugState | null = null;

    while (Date.now() < deadline) {
      lastState = await this.readOcrDebugState(page);
      this.logger.debug(
        `OCR poll: filled=${lastState.ocrFilledCount} processing=${lastState.processingVisible} confirmDisabled=${lastState.confirmDisabled}`,
      );

      if (!lastState.processingVisible && lastState.ocrFilledCount >= 2) {
        this.logger.log(
          `OCR ready: ${lastState.ocrFilled.map((f) => `${f.name}=${f.value}`).join(', ')}`,
        );
        await page.waitForTimeout(400);
        return;
      }

      await page.waitForTimeout(1_000);
    }

    throw new Error(
      'OCR did not finish within 90s. ' + this.formatDebug(lastState),
    );
  }

  private async confirmPassportOcr(page: Page): Promise<void> {
    const confirm = page.locator(CONFIRM_PASSPORT_BTN).first();
    await confirm.waitFor({ state: 'attached', timeout: 15_000 });

    if ((await confirm.count()) === 0) {
      throw new Error(
        'Confirm Passport Information button not found. ' +
          this.formatDebug(await this.readOcrDebugState(page)),
      );
    }

    await confirm.scrollIntoViewIfNeeded().catch(() => undefined);

    // Prefer a real click; force only if Playwright thinks it's not actionable
    // while OCR data is already present (overlay quirks).
    try {
      await confirm.click({ timeout: 5_000 });
    } catch {
      await confirm.click({ force: true, timeout: 5_000 });
    }

    await page.waitForTimeout(800);
  }

  private async dismissInfoDialogs(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const clicked = await page.evaluate(() => {
        const isVisible = (el: Element) => {
          const style = getComputedStyle(el as HTMLElement);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          const rect = (el as HTMLElement).getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        // Prefer Ok on visible messager windows (e.g. "Successfully copied...")
        const windows = [
          ...document.querySelectorAll(
            '.messager-window, .panel.window, .messager-body',
          ),
        ].filter(isVisible);

        for (const win of windows) {
          const text = (win.textContent || '').replace(/\s+/g, ' ');
          // Never dismiss an in-flight processing dialog via Ok.
          if (/It'?s processing|请求正在处理中|processing your request/i.test(text)) {
            continue;
          }

          const ok = [
            ...win.querySelectorAll(
              'input.okButton, input[value="Ok"], input[value="OK"], a.l-btn, button',
            ),
          ].find((el) =>
            /^(Ok|OK|确定)$/i.test(
              ((el as HTMLInputElement).value || el.textContent || '').trim(),
            ),
          ) as HTMLElement | undefined;

          if (ok) {
            ok.click();
            return true;
          }
        }

        // Global Ok fallback
        const globalOk = [
          ...document.querySelectorAll(
            'input.okButton, .messager-button input[value="Ok"], .messager-button input[value="OK"]',
          ),
        ].find(isVisible) as HTMLElement | undefined;
        if (globalOk) {
          globalOk.click();
          return true;
        }

        return false;
      });

      if (!clicked) {
        break;
      }
      await page.waitForTimeout(400);
    }
  }

  private async closeDatePickers(page: Page): Promise<void> {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(
        '.WdateDiv, #_my97DP, .datebox-calendar-inner, .calendar',
      )) {
        (el as HTMLElement).style.display = 'none';
      }
      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
    });
  }

  private async waitForApplySync(page: Page): Promise<void> {
    await this.waitForVisibleProcessingGone(page, 45_000);

    const synced = await page
      .waitForFunction(() => {
        const last = document.querySelector(
          'input[name="apply.lastName"]',
        ) as HTMLInputElement | null;
        const given = document.querySelector(
          'input[name="apply.givenName"]',
        ) as HTMLInputElement | null;
        const passport = document.querySelector(
          'input[name="apply.passportNo"]',
        ) as HTMLInputElement | null;

        return Boolean(
          (last?.value && last.value.trim().length > 0) ||
            (given?.value && given.value.trim().length > 0) ||
            (passport?.value && passport.value.trim().length > 0),
        );
      }, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    const state = await this.readOcrDebugState(page);
    if (!synced) {
      // Confirm may still have worked with delayed sync — log and continue;
      // fillFieldBatch will overwrite apply.* from profile anyway.
      this.logger.warn(
        `apply.* not synced after Confirm (continuing). ${this.formatDebug(state)}`,
      );
      return;
    }

    this.logger.log(
      `apply.* synced: lastName=${state.applyLastName} passportNo=${state.applyPassportNo}`,
    );
  }

  private async uploadPhoto(
    page: Page,
    fileUrl: string | undefined,
  ): Promise<void> {
    if (!fileUrl) {
      throw new Error('Missing required document: photo');
    }

    const file = await this.downloadFile(fileUrl, 'photo');

    // 1) Direct hidden input[name=photo] (ZZU-style)
    await page
      .waitForSelector(PHOTO_INPUT, { state: 'attached', timeout: 10_000 })
      .catch(() => undefined);

    const photoInput = page.locator(PHOTO_INPUT).first();
    if ((await photoInput.count()) > 0) {
      try {
        await photoInput.setInputFiles(file);
        this.logger.log('Photo uploaded via input[name=photo]');
        await page.waitForTimeout(500);
        return;
      } catch (error) {
        this.logger.warn(
          `setInputFiles(photo) failed, trying Add your photo: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // 2) PKU "Add your photo" → filechooser
    const addBtn = page.locator(ADD_PHOTO_BTN).first();
    await addBtn
      .waitFor({ state: 'attached', timeout: 10_000 })
      .catch(() => undefined);

    if ((await addBtn.count()) === 0) {
      throw new Error(
        `Photo upload failed: neither ${PHOTO_INPUT} nor Add your photo found`,
      );
    }

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15_000 }),
      addBtn.click({ force: true }),
    ]);
    await fileChooser.setFiles(file);
    this.logger.log('Photo uploaded via Add your photo + filechooser');
    await page.waitForTimeout(500);
  }

  private async readOcrDebugState(page: Page): Promise<OcrDebugState> {
    return page.evaluate(() => {
      const isVisible = (el: Element | null) => {
        if (!el) {
          return false;
        }
        const style = getComputedStyle(el as HTMLElement);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        ) {
          return false;
        }
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const processingNodes = [
        ...document.querySelectorAll(
          '.messager-window, .panel.window, .window-mask, .messager-body',
        ),
      ].filter((el) => isVisible(el));

      const processingText = processingNodes
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /processing|please wait|请求正在处理/i.test(t)) ?? '';

      const processingVisible = Boolean(processingText);

      const ocrFilled = (
        [...document.querySelectorAll('input[name^="ocr."]')] as HTMLInputElement[]
      )
        .filter(
          (input) =>
            input.type !== 'checkbox' &&
            input.type !== 'radio' &&
            input.type !== 'hidden' &&
            (input.value || '').trim().length > 0,
        )
        .map((input) => ({
          name: input.name,
          value: input.value.trim().slice(0, 40),
        }));

      const confirm = [
        ...document.querySelectorAll(
          'input[type="button"], input[type="submit"], button, a',
        ),
      ].find((el) =>
        /Confirm Passport/i.test(
          ((el as HTMLInputElement).value || el.textContent || '').trim(),
        ),
      ) as HTMLInputElement | HTMLButtonElement | undefined;

      const applyLastName = (
        document.querySelector(
          'input[name="apply.lastName"]',
        ) as HTMLInputElement | null
      )?.value?.trim() ?? '';
      const applyPassportNo = (
        document.querySelector(
          'input[name="apply.passportNo"]',
        ) as HTMLInputElement | null
      )?.value?.trim() ?? '';

      return {
        processingVisible,
        processingText: processingText.slice(0, 80),
        ocrFilled,
        ocrFilledCount: ocrFilled.length,
        confirmFound: Boolean(confirm),
        confirmTag: confirm ? confirm.tagName.toLowerCase() : '',
        confirmDisabled: Boolean(
          confirm && 'disabled' in confirm && confirm.disabled,
        ),
        confirmClass: confirm?.className?.toString().slice(0, 80) ?? '',
        applyLastName,
        applyPassportNo,
      };
    });
  }

  private formatDebug(state: OcrDebugState | null): string {
    if (!state) {
      return 'debug=unavailable';
    }
    return (
      `debug={processing:${state.processingVisible}` +
      ` "${state.processingText}";` +
      ` ocrFilled:${state.ocrFilledCount}` +
      ` [${state.ocrFilled.map((f) => `${f.name}=${f.value}`).join('; ')}];` +
      ` confirm:${state.confirmFound}/${state.confirmTag}` +
      ` disabled=${state.confirmDisabled}` +
      ` class="${state.confirmClass}";` +
      ` apply.lastName="${state.applyLastName}"` +
      ` apply.passportNo="${state.applyPassportNo}"}`
    );
  }

  private async waitForVisibleProcessingGone(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await this.readOcrDebugState(page);
      if (!state.processingVisible) {
        return;
      }
      await page.waitForTimeout(500);
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
}
