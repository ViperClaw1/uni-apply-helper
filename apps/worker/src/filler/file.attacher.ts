import { Injectable, Logger } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { resolveFieldLocator } from './field.locator.js';

@Injectable()
export class FileAttacher {
  private readonly logger = new Logger(FileAttacher.name);

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
      const filePayload = {
        name: this.fileNameFor(field.documentType!, contentType),
        mimeType: contentType,
        buffer,
      };

      const locator = await resolveFieldLocator(page, field);
      if (locator && (await locator.count()) > 0) {
        await locator.setInputFiles(filePayload);
        this.logger.log(
          `Attached ${field.documentType} via file input (${field.selector})`,
        );
        continue;
      }

      // PKU/17gz Step 6: no input[type=file] in DOM — "Add Document" opens filechooser.
      const attachTypeId = this.extractAttachTypeId(field.selector);
      if (attachTypeId) {
        const ok = await this.attachViaAddDocument(
          page,
          attachTypeId,
          filePayload,
        );
        if (ok) {
          this.logger.log(
            `Attached ${field.documentType} via Add Document (${attachTypeId})`,
          );
          continue;
        }
      }

      if (field.required) {
        throw new Error(
          `File input not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
            (attachTypeId ? ` [attachTypeId=${attachTypeId}]` : ''),
        );
      }
    }
  }

  private extractAttachTypeId(selector?: string): string | undefined {
    if (!selector) {
      return undefined;
    }
    const match = selector.match(/attachTypeId=["']([^"']+)["']/i);
    return match?.[1];
  }

  private fileNameFor(documentType: string, contentType: string): string {
    if (/jpeg|jpg/i.test(contentType)) {
      return `${documentType}.jpg`;
    }
    if (/png/i.test(contentType)) {
      return `${documentType}.png`;
    }
    return `${documentType}.pdf`;
  }

  private async attachViaAddDocument(
    page: Page,
    attachTypeId: string,
    filePayload: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<boolean> {
    const row = page.locator(`[attachTypeId="${attachTypeId}"]`).first();
    if ((await row.count()) === 0) {
      // Some skins put attachTypeId on a child / data attribute
      const alt = page
        .locator(
          `[data-attach-type-id="${attachTypeId}"], tr:has([onclick*="${attachTypeId}"])`,
        )
        .first();
      if ((await alt.count()) === 0) {
        return false;
      }
      return this.clickAddDocumentAndSetFiles(page, alt, filePayload);
    }

    return this.clickAddDocumentAndSetFiles(page, row, filePayload);
  }

  private async clickAddDocumentAndSetFiles(
    page: Page,
    scope: ReturnType<Page['locator']>,
    filePayload: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<boolean> {
    const addBtn = scope
      .locator(
        [
          'input[value="Add Document"]',
          'input[value="Upload"]',
          'input[value="Browse"]',
          'button:has-text("Add Document")',
          'a:has-text("Add Document")',
          'input[onclick*="showUpload"]',
          'a[onclick*="showUpload"]',
        ].join(', '),
      )
      .first();

    if ((await addBtn.count()) === 0) {
      // Global fallback: any Add Document whose onclick mentions nothing useful —
      // prefer row-scoped only.
      return false;
    }

    await addBtn.scrollIntoViewIfNeeded().catch(() => undefined);

    try {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15_000 }),
        addBtn.click({ force: true }),
      ]);
      await chooser.setFiles(filePayload);
    } catch {
      // Dialog may inject a temporary <input type=file>
      const injected = page.locator('input[type="file"]:not([name="photo"])').last();
      if ((await injected.count()) === 0) {
        return false;
      }
      await injected.setInputFiles(filePayload).catch(() => undefined);
    }

    // Dismiss success / processing dialogs after upload
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      for (const win of document.querySelectorAll(
        '.messager-window, .panel.window',
      )) {
        const text = (win.textContent || '').replace(/\s+/g, ' ');
        if (/It'?s processing|please wait|请求正在处理/i.test(text)) {
          continue;
        }
        const ok = [
          ...win.querySelectorAll(
            'input.okButton, input[value="Ok"], input[value="OK"], button',
          ),
        ].find((el) =>
          /^(Ok|OK|确定)$/i.test(
            ((el as HTMLInputElement).value || el.textContent || '').trim(),
          ),
        ) as HTMLElement | undefined;
        ok?.click();
      }
    });

    return true;
  }
}
