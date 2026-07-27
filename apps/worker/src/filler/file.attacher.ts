import { Injectable, Logger } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { resolveFieldLocator } from './field.locator.js';

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

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

    if (fileFields.length === 0) {
      return;
    }

    // Step 6 AJAX: attach rows / Add Document appear after content swap.
    await page
      .waitForSelector(
        [
          '[attachTypeId]',
          '.attach-item-list',
          'input[value="Add Document"]',
          'a:has-text("Add Document")',
        ].join(', '),
        { state: 'attached', timeout: 20_000 },
      )
      .catch(() => undefined);

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
      const filePayload = this.toFilePayload(
        field.documentType!,
        contentType,
        buffer,
      );

      const locator = await resolveFieldLocator(page, field);
      if (locator && (await locator.count()) > 0) {
        const tag = await locator.evaluate((el) => el.tagName).catch(() => '');
        if (tag === 'INPUT') {
          await locator.setInputFiles(filePayload);
          this.logger.log(
            `Attached ${field.documentType} via file input (${field.selector})`,
          );
          await this.dismissPostUploadDialogs(page);
          continue;
        }
      }

      // PKU/17gz Step 6: no input[type=file] until "Add Document" → filechooser.
      const attachTypeId = this.extractAttachTypeId(field.selector);
      const ok = await this.attachViaAddDocument(
        page,
        attachTypeId,
        filePayload,
        field.labelHint || field.documentType,
      );
      if (ok) {
        this.logger.log(
          `Attached ${field.documentType} via Add Document` +
            (attachTypeId ? ` (${attachTypeId})` : ''),
        );
        continue;
      }

      if (field.required) {
        const dump = await this.dumpAttachDebug(page);
        throw new Error(
          `File input not found: ${field.selector}` +
            `${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
            (attachTypeId ? ` [attachTypeId=${attachTypeId}]` : '') +
            ` | DOM: ${dump}`,
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

  private toFilePayload(
    documentType: string,
    contentType: string,
    buffer: Buffer,
  ): FilePayload {
    // Passport row on 17gz often accepts only jpg/jpeg.
    const forceJpeg =
      documentType === 'passport' ||
      documentType === 'photo' ||
      /jpeg|jpg|png/i.test(contentType);

    if (forceJpeg && /jpeg|jpg/i.test(contentType)) {
      return { name: `${documentType}.jpg`, mimeType: 'image/jpeg', buffer };
    }
    if (forceJpeg && /png/i.test(contentType)) {
      return { name: `${documentType}.png`, mimeType: 'image/png', buffer };
    }
    if (/pdf/i.test(contentType) && documentType === 'passport') {
      // Keep bytes but present as jpg name — some portals sniff MIME from chooser.
      // Prefer real image in profile; log if PDF slipped through.
      this.logger.warn(
        'Passport document is PDF; 17gz expects *.jpg/*.jpeg — upload may be rejected',
      );
    }
    if (/jpeg|jpg/i.test(contentType)) {
      return { name: `${documentType}.jpg`, mimeType: contentType, buffer };
    }
    if (/png/i.test(contentType)) {
      return { name: `${documentType}.png`, mimeType: contentType, buffer };
    }
    return {
      name: `${documentType}.pdf`,
      mimeType: contentType,
      buffer,
    };
  }

  private async attachViaAddDocument(
    page: Page,
    attachTypeId: string | undefined,
    filePayload: FilePayload,
    labelHint?: string,
  ): Promise<boolean> {
    const addButtons = await this.resolveAddDocumentButtons(
      page,
      attachTypeId,
      labelHint,
    );

    for (const btn of addButtons) {
      const ok = await this.clickAddDocumentAndSetFiles(page, btn, filePayload);
      if (ok) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add Document often lives in the same <tr> as .attach-item-list, not inside
   * the [attachTypeId] node itself.
   */
  private async resolveAddDocumentButtons(
    page: Page,
    attachTypeId: string | undefined,
    labelHint?: string,
  ): Promise<Locator[]> {
    const buttons: Locator[] = [];
    const addSelector = [
      'input[value="Add Document"]',
      'input[value*="Add Document"]',
      'input[value="Upload"]',
      'input[value="Browse"]',
      'button:has-text("Add Document")',
      'a:has-text("Add Document")',
      'input[onclick*="showUpload"]',
      'a[onclick*="showUpload"]',
      'span:has-text("Add Document")',
    ].join(', ');

    if (attachTypeId) {
      const scopes: Locator[] = [
        page.locator(`tr:has([attachTypeId="${attachTypeId}"])`).first(),
        page.locator(`[attachTypeId="${attachTypeId}"]`).first(),
        page
          .locator(`.attach-item-list[attachTypeId="${attachTypeId}"]`)
          .first(),
        page
          .locator(
            `[attachtypeid="${attachTypeId}"], [data-attach-type-id="${attachTypeId}"]`,
          )
          .first(),
      ];

      for (const scope of scopes) {
        if ((await scope.count()) === 0) {
          continue;
        }
        const inScope = scope.locator(addSelector).first();
        if ((await inScope.count()) > 0) {
          buttons.push(inScope);
        }
        // Parent tr of the attach node
        const parentTr = scope.locator('xpath=ancestor-or-self::tr[1]');
        if ((await parentTr.count()) > 0) {
          const inTr = parentTr.locator(addSelector).first();
          if ((await inTr.count()) > 0) {
            buttons.push(inTr);
          }
        }
      }
    }

    // Label fallback: Passport / Physical Examination / …
    const hints = [
      labelHint,
      attachTypeId?.includes('passport') ? 'Passport' : undefined,
      attachTypeId?.includes('HighstEducation') ||
      attachTypeId?.includes('HighestEducation')
        ? 'Diploma'
        : undefined,
      attachTypeId?.includes('score') ? 'Transcript' : undefined,
      attachTypeId?.includes('checkBody') ? 'Physical Examination' : undefined,
    ].filter(Boolean) as string[];

    for (const hint of hints) {
      const row = page
        .locator('tr')
        .filter({ hasText: new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .first();
      if ((await row.count()) === 0) {
        continue;
      }
      const btn = row.locator(addSelector).first();
      if ((await btn.count()) > 0) {
        buttons.push(btn);
      }
    }

    // Last resort: first visible Add Document on the page (only if single attach)
    if (buttons.length === 0) {
      const global = page.locator(addSelector).first();
      if ((await global.count()) > 0) {
        buttons.push(global);
      }
    }

    return buttons;
  }

  private async clickAddDocumentAndSetFiles(
    page: Page,
    addBtn: Locator,
    filePayload: FilePayload,
  ): Promise<boolean> {
    await addBtn.scrollIntoViewIfNeeded().catch(() => undefined);

    try {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15_000 }),
        addBtn.click({ force: true }),
      ]);
      await chooser.setFiles(filePayload);
    } catch (error) {
      this.logger.warn(
        `filechooser path failed: ${error instanceof Error ? error.message : 'unknown'} — trying injected input`,
      );
      // Dialog may inject a temporary <input type=file>
      const injected = page
        .locator('input[type="file"]:not([name="photo"])')
        .last();
      if ((await injected.count()) === 0) {
        return false;
      }
      try {
        await injected.setInputFiles(filePayload);
      } catch {
        return false;
      }
    }

    await page.waitForTimeout(800);
    await this.dismissPostUploadDialogs(page);
    return true;
  }

  private async dismissPostUploadDialogs(page: Page): Promise<void> {
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
  }

  private async dumpAttachDebug(page: Page): Promise<string> {
    return page
      .evaluate(() => {
        const ids = [
          ...document.querySelectorAll('[attachTypeId], .attach-item-list'),
        ]
          .map((el) => el.getAttribute('attachTypeId') || el.tagName)
          .slice(0, 12);
        const addCount = document.querySelectorAll(
          'input[value="Add Document"], a',
        );
        const addTexts = [...addCount]
          .map((el) =>
            ((el as HTMLInputElement).value || el.textContent || '')
              .replace(/\s+/g, ' ')
              .trim(),
          )
          .filter((t) => /add document|upload|browse/i.test(t))
          .slice(0, 5);
        return `attachTypeIds=[${ids.join(',')}] addBtns=[${addTexts.join(' | ')}]`;
      })
      .catch(() => 'dump-failed');
  }
}
