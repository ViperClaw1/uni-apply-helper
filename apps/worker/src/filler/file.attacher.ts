import { Injectable, Logger } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { resolveFieldLocator } from './field.locator.js';

type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

/** 17gz Step 6 rows that reject PDF (Accept: *.jpg, *.jpeg). */
const JPG_ONLY_DOCUMENT_TYPES = new Set([
  'passport',
  'photo',
  'diploma',
  'transcript',
  'criminal_record',
  'recommendation',
  'language_certificate',
  'personal_statement',
  'medical',
]);

const FETCH_TIMEOUT_MS = 30_000;

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
      this.logger.warn(
        'Step 6: no file fields with documentType in schema — skipping attach',
      );
      return;
    }

    this.logger.log(
      `Step 6: attaching ${fileFields.length} document(s): ${fileFields
        .map((f) => f.documentType)
        .join(', ')}`,
    );

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
      const docType = field.documentType!;
      const fileUrl = profile.documents[docType];
      const attachTypeId = this.extractAttachTypeId(field.selector);
      const labelHint = field.labelHint || docType;

      if (
        await this.rowAlreadyHasAttachment(page, attachTypeId, labelHint)
      ) {
        this.logger.log(
          `Step 6: skip ${docType} — already attached on page` +
            (attachTypeId ? ` (${attachTypeId})` : ''),
        );
        continue;
      }

      if (!fileUrl) {
        if (field.required) {
          throw new Error(`Missing required document: ${docType}`);
        }
        this.logger.log(`Step 6: skip ${docType} (not in profile)`);
        continue;
      }

      this.logger.log(`Step 6: fetch ${docType}…`);
      const { contentType, buffer } = await this.fetchDocument(docType, fileUrl);
      this.logger.log(
        `Step 6: fetched ${docType} (${contentType}, ${buffer.length} bytes)`,
      );

      if (
        JPG_ONLY_DOCUMENT_TYPES.has(docType) &&
        /pdf/i.test(contentType)
      ) {
        throw new Error(
          `Document "${docType}" is PDF but 17gz Step 6 accepts only *.jpg/*.jpeg for this row. ` +
            `Re-upload as JPEG in the dashboard (label: ${field.labelHint ?? docType}).`,
        );
      }

      const filePayload = this.toFilePayload(docType, contentType, buffer);

      const locator = await resolveFieldLocator(page, field);
      if (locator && (await locator.count()) > 0) {
        const tag = await locator.evaluate((el) => el.tagName).catch(() => '');
        if (tag === 'INPUT') {
          await locator.setInputFiles(filePayload);
          this.logger.log(
            `Attached ${docType} via file input (${field.selector})`,
          );
          await this.dismissPostUploadDialogs(page);
          await this.waitBrieflyForUploadSettle(page);
          continue;
        }
      }

      // PKU/17gz Step 6: no input[type=file] until "Add Document" → filechooser.
      const resolvedId =
        (await this.resolveLiveAttachTypeId(page, attachTypeId, labelHint)) ??
        attachTypeId;
      const ok = await this.attachViaAddDocument(
        page,
        resolvedId,
        filePayload,
        labelHint,
      );
      if (ok) {
        this.logger.log(
          `Attached ${docType} via Add Document` +
            (resolvedId ? ` (${resolvedId})` : ''),
        );
        await this.waitBrieflyForUploadSettle(page);
        continue;
      }

      // Portal may refuse a second passport upload with a messager instead of filechooser.
      if (
        await this.rowAlreadyHasAttachment(page, resolvedId, labelHint)
      ) {
        this.logger.log(
          `Step 6: treat ${docType} as done after attach attempt (row has file)`,
        );
        continue;
      }

      if (field.required) {
        const dump = await this.dumpAttachDebug(page);
        throw new Error(
          `File input not found: ${field.selector}` +
            `${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
            (resolvedId ? ` [attachTypeId=${resolvedId}]` : '') +
            ` | DOM: ${dump}`,
        );
      }

      this.logger.warn(
        `Step 6: could not attach optional ${docType} — Add Document not found`,
      );
    }
  }

  /**
   * Portal marks rows with * / [Required]. Empty ones block Save and Next —
   * fail here with a clear list instead of agent limbo / BullMQ stall.
   */
  async assertRequiredAttachmentsPresent(page: Page): Promise<void> {
    const missing = await page
      .evaluate(() => {
        const rows = [
          ...document.querySelectorAll(
            'tr:has([attachTypeId]), tr:has(input[value="Add Document"]), tr:has(input[value*="Add Document"])',
          ),
        ];
        const out: string[] = [];

        for (const row of rows) {
          const labelCell =
            row.querySelector('td, th, .label, label') || row;
          const label = (labelCell.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
          const isRequired =
            /\*/.test(label) ||
            /\[Required\]/i.test(label) ||
            Boolean(row.querySelector('.red, .required, font[color="red"]'));

          if (!isRequired) {
            continue;
          }
          if (/Other Documents/i.test(label)) {
            continue;
          }

          const hasUpload =
            Boolean(
              row.querySelector(
                '.attach-item-list img, .attach-item-list a, img[src*="attach"], a[href*="downloadAttach"], a[href*="attach"]',
              ),
            ) ||
            [...row.querySelectorAll('img')].some((img) => {
              const src = img.getAttribute('src') || '';
              return src.length > 20 && !/icon|blank|spacer/i.test(src);
            });

          if (!hasUpload) {
            out.push(label.slice(0, 120));
          }
        }

        return out;
      })
      .catch(() => [] as string[]);

    if (missing.length === 0) {
      this.logger.log('Step 6: all required attach rows have files');
      return;
    }

    throw new Error(
      `Step 6: required documents still empty after attach (${missing.length}): ` +
        missing.join(' || '),
    );
  }

  private async fetchDocument(
    documentType: string,
    fileUrl: string,
  ): Promise<{ contentType: string; buffer: Buffer }> {
    let response: Response;
    try {
      response = await fetch(fileUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to download document ${documentType} within ${FETCH_TIMEOUT_MS}ms: ${reason}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to download document ${documentType} (HTTP ${response.status})`,
      );
    }

    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { contentType, buffer };
  }

  private async waitBrieflyForUploadSettle(page: Page): Promise<void> {
    await page.waitForTimeout(500);
    await this.dismissPostUploadDialogs(page);
    // Cap wait — never block for minutes on a stuck "It's processing".
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const busy = await page
        .evaluate(() => {
          const wins = [
            ...document.querySelectorAll(
              '.messager-window, .panel.window, .window-mask',
            ),
          ];
          return wins.some((win) => {
            const style = getComputedStyle(win as HTMLElement);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            const rect = (win as HTMLElement).getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              return false;
            }
            return /It'?s processing|please wait|请求正在处理/i.test(
              win.textContent || '',
            );
          });
        })
        .catch(() => false);
      if (!busy) {
        return;
      }
      await page.waitForTimeout(500);
    }
    this.logger.warn(
      'Step 6: upload processing dialog still visible after 20s — continuing',
    );
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

    this.logger.log(
      `Step 6: Add Document candidates=${addButtons.length}` +
        (attachTypeId ? ` attachTypeId=${attachTypeId}` : '') +
        (labelHint ? ` hint="${labelHint}"` : ''),
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
   *
   * Never fall back to the first Add Document on the page — that re-uploads
   * passport when schema attachTypeIds don't match this university skin.
   */
  private async resolveAddDocumentButtons(
    page: Page,
    attachTypeId: string | undefined,
    labelHint?: string,
  ): Promise<Locator[]> {
    const buttons: Locator[] = [];
    const seen = new Set<string>();
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

    const pushUnique = async (btn: Locator) => {
      if ((await btn.count()) === 0) {
        return;
      }
      const key = await btn
        .evaluate((el) => {
          const tr = el.closest('tr');
          const id =
            tr?.querySelector('[attachTypeId]')?.getAttribute('attachTypeId') ||
            '';
          return `${id}|${(el as HTMLInputElement).value || el.textContent || ''}`;
        })
        .catch(() => Math.random().toString());
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      buttons.push(btn);
    };

    if (attachTypeId) {
      const idPresent = await page
        .locator(`[attachTypeId="${attachTypeId}"]`)
        .count()
        .then((n) => n > 0)
        .catch(() => false);

      if (idPresent) {
        const scopes: Locator[] = [
          page.locator(`tr:has([attachTypeId="${attachTypeId}"])`).first(),
          page.locator(`[attachTypeId="${attachTypeId}"]`).first(),
          page
            .locator(`.attach-item-list[attachTypeId="${attachTypeId}"]`)
            .first(),
        ];

        for (const scope of scopes) {
          if ((await scope.count()) === 0) {
            continue;
          }
          await pushUnique(scope.locator(addSelector).first());
          const parentTr = scope.locator('xpath=ancestor-or-self::tr[1]');
          if ((await parentTr.count()) > 0) {
            await pushUnique(parentTr.locator(addSelector).first());
          }
        }
      }
    }

    // Label match — primary fallback when attachTypeIds differ per university.
    const hints = [
      labelHint,
      attachTypeId?.includes('passport') ? 'Passport' : undefined,
      /HighstEducation|HighestEducation|152223612/i.test(attachTypeId ?? '')
        ? 'Diploma'
        : undefined,
      /score|152223620/i.test(attachTypeId ?? '') ? 'Transcript' : undefined,
      attachTypeId?.includes('checkBody')
        ? 'Physical Examination'
        : undefined,
      /criminal|2251456278|115623117/i.test(attachTypeId ?? '')
        ? 'Non-criminal'
        : undefined,
      /Learning|Employment|152223633|8135227092/i.test(
        `${labelHint ?? ''}${attachTypeId ?? ''}`,
      )
        ? 'Learning to prove'
        : undefined,
    ].filter(Boolean) as string[];

    for (const hint of hints) {
      const row = page
        .locator('tr')
        .filter({
          hasText: new RegExp(
            hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i',
          ),
        })
        .filter({ has: page.locator(addSelector) })
        .first();
      if ((await row.count()) === 0) {
        continue;
      }
      await pushUnique(row.locator(addSelector).first());
    }

    return buttons;
  }

  /** Skip re-upload when the row already shows a thumbnail / attachment. */
  private async rowAlreadyHasAttachment(
    page: Page,
    attachTypeId: string | undefined,
    labelHint?: string,
  ): Promise<boolean> {
    return page
      .evaluate(
        ({ id, hint }) => {
          const rows = [
            ...document.querySelectorAll(
              'tr:has([attachTypeId]), tr:has(input[value="Add Document"]), tr:has(input[value*="Add Document"])',
            ),
          ];

          const match = rows.find((row) => {
            if (
              id &&
              row.querySelector(`[attachTypeId="${id}"]`)
            ) {
              return true;
            }
            if (!hint) {
              return false;
            }
            const label = (row.textContent || '').replace(/\s+/g, ' ');
            return new RegExp(
              hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              'i',
            ).test(label);
          });

          if (!match) {
            return false;
          }

          return (
            Boolean(
              match.querySelector(
                '.attach-item-list img, .attach-item-list a, img[src*="attach"], a[href*="downloadAttach"], a[href*="attach"]',
              ),
            ) ||
            [...match.querySelectorAll('img')].some((img) => {
              const src = img.getAttribute('src') || '';
              return src.length > 20 && !/icon|blank|spacer/i.test(src);
            })
          );
        },
        { id: attachTypeId ?? '', hint: labelHint ?? '' },
      )
      .catch(() => false);
  }

  /** If schema id missing on page, pick live attachTypeId from the labeled row. */
  private async resolveLiveAttachTypeId(
    page: Page,
    attachTypeId: string | undefined,
    labelHint?: string,
  ): Promise<string | undefined> {
    if (attachTypeId) {
      const present = await page
        .locator(`[attachTypeId="${attachTypeId}"]`)
        .count()
        .then((n) => n > 0)
        .catch(() => false);
      if (present) {
        return attachTypeId;
      }
    }

    if (!labelHint) {
      return attachTypeId;
    }

    return page
      .evaluate((hint) => {
        const re = new RegExp(
          hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        );
        for (const row of document.querySelectorAll('tr')) {
          if (!re.test((row.textContent || '').replace(/\s+/g, ' '))) {
            continue;
          }
          const id = row
            .querySelector('[attachTypeId]')
            ?.getAttribute('attachTypeId');
          if (id) {
            return id;
          }
        }
        return null;
      }, labelHint)
      .then((id) => id ?? attachTypeId)
      .catch(() => attachTypeId);
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

      const already = await this.peekAlreadyUploadedDialog(page);
      if (already) {
        this.logger.log(`Step 6: portal says already uploaded — ${already}`);
        await this.dismissPostUploadDialogs(page);
        return true;
      }

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
    const alreadyAfter = await this.peekAlreadyUploadedDialog(page);
    if (alreadyAfter) {
      this.logger.log(`Step 6: portal says already uploaded — ${alreadyAfter}`);
    }
    await this.dismissPostUploadDialogs(page);
    return true;
  }

  private async peekAlreadyUploadedDialog(page: Page): Promise<string | null> {
    return page
      .evaluate(() => {
        for (const win of document.querySelectorAll(
          '.messager-body, .messager-window .panel-body, .messager-window',
        )) {
          const style = getComputedStyle(win as HTMLElement);
          if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
          }
          const t = (win.textContent || '').replace(/\s+/g, ' ').trim();
          if (/already uploaded|Click Save and Next/i.test(t)) {
            return t.slice(0, 200);
          }
        }
        return null;
      })
      .catch(() => null);
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
