"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FileAttacher_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAttacher = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const field_locator_js_1 = require("./field.locator.js");
const JPG_ONLY_DOCUMENT_TYPES = new Set([
    'passport',
    'photo',
    'diploma',
    'transcript',
    'recommendation',
    'language_certificate',
    'personal_statement',
]);
const FETCH_TIMEOUT_MS = 30_000;
function labelHintsForDocument(documentType, attachTypeId) {
    const id = attachTypeId ?? '';
    switch (documentType) {
        case 'passport':
            return ['Passport'];
        case 'diploma':
            return [
                'High school education',
                'Highest Education',
                'Diploma',
                'Certificate of Highest',
            ];
        case 'transcript':
            return ['Transcript', 'Certified Copy', 'score'];
        case 'medical':
            return ['Physical Examination', 'checkBody'];
        case 'criminal_record':
            return ['Non-Criminal', 'Non-criminal', 'nonCriminal'];
        case 'financial':
            return ['Economic guarantee', 'deposit certificate', 'financial'];
        case 'recommendation':
        case 'language_certificate':
            return ['HSK', 'Chinese language', 'Learning to prove', 'Employment'];
        default:
            break;
    }
    if (/passport/i.test(id))
        return ['Passport'];
    if (/score/i.test(id))
        return ['Transcript'];
    if (/checkBody/i.test(id))
        return ['Physical Examination'];
    if (/nonCriminal|criminal/i.test(id))
        return ['Non-Criminal'];
    if (/8268823123|HighstEducation|HighestEducation/i.test(id)) {
        return ['High school education', 'Diploma'];
    }
    if (/8268819058/i.test(id))
        return ['HSK', 'Chinese language'];
    if (/8268819131/i.test(id))
        return ['Economic guarantee'];
    return [];
}
let FileAttacher = FileAttacher_1 = class FileAttacher {
    logger = new common_1.Logger(FileAttacher_1.name);
    async attachFiles(page, profile, fields) {
        const fileFields = fields.filter((field) => field.type === 'file' && field.documentType);
        if (fileFields.length === 0) {
            this.logger.warn('Attach: no file fields with documentType in schema — skipping');
            return;
        }
        this.logger.log(`Attach: ${fileFields.length} document(s): ${fileFields
            .map((f) => f.documentType)
            .join(', ')}`);
        await page
            .waitForSelector([
            '[attachTypeId]',
            '.attach-item-list',
            'input[value="Add Document"]',
            'a:has-text("Add Document")',
        ].join(', '), { state: 'attached', timeout: 20_000 })
            .catch(() => undefined);
        for (const field of fileFields) {
            const docType = field.documentType;
            const fileUrls = (0, shared_1.getDocumentUrls)(profile.documents, docType);
            const attachTypeId = this.extractAttachTypeId(field.selector);
            const labelHint = field.labelHint || docType;
            if (fileUrls.length === 0) {
                if (field.required) {
                    throw new Error('Missing required document: ' + docType);
                }
                this.logger.log('Attach: skip ' + docType + ' (not in profile)');
                continue;
            }
            const resolvedId = (await this.resolveLiveAttachTypeId(page, attachTypeId, labelHint)) ??
                attachTypeId;
            const alreadyCount = await this.countRowAttachments(page, resolvedId, labelHint);
            if (alreadyCount >= fileUrls.length) {
                this.logger.log(`Attach: skip ${docType} — row already has ${alreadyCount}/${fileUrls.length} file(s)`);
                continue;
            }
            const startIndex = Math.min(alreadyCount, fileUrls.length);
            if (startIndex > 0) {
                this.logger.log(`Attach: resume ${docType} from [${startIndex + 1}/${fileUrls.length}] (portal has ${alreadyCount})`);
            }
            for (let index = startIndex; index < fileUrls.length; index += 1) {
                const fileUrl = fileUrls[index];
                this.logger.log(`Attach: fetch ${docType} [${index + 1}/${fileUrls.length}]…`);
                const { contentType, buffer } = await this.fetchDocument(docType, fileUrl);
                this.logger.log(`Attach: fetched ${docType} (${contentType}, ${buffer.length} bytes)`);
                if (JPG_ONLY_DOCUMENT_TYPES.has(docType) &&
                    /pdf/i.test(contentType)) {
                    throw new Error(`Document "${docType}" is PDF but 17gz Step 6 accepts only *.jpg/*.jpeg for this row. ` +
                        `Re-upload as JPEG in the dashboard (label: ${field.labelHint ?? docType}).`);
                }
                if (buffer.length > 1.5 * 1024 * 1024) {
                    this.logger.warn(`Attach: ${docType}[${index}] is ${(buffer.length / 1024 / 1024).toFixed(2)}MB (>1.5M portal limit)`);
                }
                const filePayload = this.toFilePayload(docType, contentType, buffer);
                const countBefore = await this.countRowAttachments(page, resolvedId, labelHint);
                const locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
                if (locator && (await locator.count()) > 0) {
                    const tag = await locator
                        .evaluate((el) => el.tagName)
                        .catch(() => '');
                    if (tag === 'INPUT' && fileUrls.length === 1) {
                        await locator.setInputFiles(filePayload);
                        this.logger.log(`Attached ${docType} via file input (${field.selector})`);
                        await this.dismissPostUploadDialogs(page);
                        await this.waitBrieflyForUploadSettle(page);
                        break;
                    }
                }
                const ok = await this.attachViaAddDocument(page, resolvedId, filePayload, labelHint, docType);
                await this.waitBrieflyForUploadSettle(page);
                const countAfter = await this.countRowAttachments(page, resolvedId, labelHint);
                if (ok && countAfter > countBefore) {
                    this.logger.log(`Attached ${docType} [${index + 1}/${fileUrls.length}] via Add Document` +
                        (resolvedId ? ` (${resolvedId})` : '') +
                        ` rowCount=${countAfter}`);
                    continue;
                }
                if (countAfter > countBefore) {
                    this.logger.log(`Attach: ${docType}[${index}] count grew ${countBefore}→${countAfter} despite chooser warn`);
                    continue;
                }
                if (field.required) {
                    const dump = await this.dumpAttachDebug(page);
                    throw new Error(`Failed to attach ${docType} file ${index + 1}/${fileUrls.length}` +
                        `${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
                        (resolvedId ? ` [attachTypeId=${resolvedId}]` : '') +
                        ` (row still has ${countAfter}) | DOM: ${dump}`);
                }
                this.logger.warn(`Attach: could not attach optional ${docType}[${index}] — stopping`);
                break;
            }
        }
    }
    async assertRequiredAttachmentsPresent(page) {
        const missing = await page
            .evaluate(() => {
            const rows = [
                ...document.querySelectorAll('tr:has([attachTypeId]), tr:has(input[value="Add Document"]), tr:has(input[value*="Add Document"])'),
            ];
            const out = [];
            for (const row of rows) {
                const labelCell = row.querySelector('td, th, .label, label') || row;
                const label = (labelCell.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const isRequired = /\*/.test(label) ||
                    /\[Required\]/i.test(label) ||
                    Boolean(row.querySelector('.red, .required, font[color="red"]'));
                if (!isRequired) {
                    continue;
                }
                if (/Other Documents/i.test(label)) {
                    continue;
                }
                const hasUpload = Boolean(row.querySelector('.attach-item-list img, .attach-item-list a, img[src*="attach"], a[href*="downloadAttach"], a[href*="attach"]')) ||
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
            .catch(() => []);
        if (missing.length === 0) {
            this.logger.log('Step 6: all required attach rows have files');
            return;
        }
        throw new Error(`Step 6: required documents still empty after attach (${missing.length}): ` +
            missing.join(' || '));
    }
    async fetchDocument(documentType, fileUrl) {
        let response;
        try {
            response = await fetch(fileUrl, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to download document ${documentType} within ${FETCH_TIMEOUT_MS}ms: ${reason}`);
        }
        if (!response.ok) {
            throw new Error(`Failed to download document ${documentType} (HTTP ${response.status})`);
        }
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const buffer = Buffer.from(await response.arrayBuffer());
        return { contentType, buffer };
    }
    async waitBrieflyForUploadSettle(page) {
        await page.waitForTimeout(500);
        await this.dismissPostUploadDialogs(page);
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
            const busy = await page
                .evaluate(() => {
                const wins = [
                    ...document.querySelectorAll('.messager-window, .panel.window, .window-mask'),
                ];
                return wins.some((win) => {
                    const style = getComputedStyle(win);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    const rect = win.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return false;
                    }
                    return /It'?s processing|please wait|请求正在处理/i.test(win.textContent || '');
                });
            })
                .catch(() => false);
            if (!busy) {
                return;
            }
            await page.waitForTimeout(500);
        }
        this.logger.warn('Step 6: upload processing dialog still visible after 20s — continuing');
    }
    extractAttachTypeId(selector) {
        if (!selector) {
            return undefined;
        }
        const match = selector.match(/attachTypeId=["']([^"']+)["']/i);
        return match?.[1];
    }
    toFilePayload(documentType, contentType, buffer) {
        const forceJpeg = documentType === 'passport' ||
            documentType === 'photo' ||
            /jpeg|jpg|png/i.test(contentType);
        if (forceJpeg && /jpeg|jpg/i.test(contentType)) {
            return { name: `${documentType}.jpg`, mimeType: 'image/jpeg', buffer };
        }
        if (forceJpeg && /png/i.test(contentType)) {
            return { name: `${documentType}.png`, mimeType: 'image/png', buffer };
        }
        if (/pdf/i.test(contentType) && documentType === 'passport') {
            this.logger.warn('Passport document is PDF; 17gz expects *.jpg/*.jpeg — upload may be rejected');
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
    async attachViaAddDocument(page, attachTypeId, filePayload, labelHint, documentType) {
        const addButtons = await this.resolveAddDocumentButtons(page, attachTypeId, labelHint, documentType);
        this.logger.log(`Step 6: Add Document candidates=${addButtons.length}` +
            (attachTypeId ? ` attachTypeId=${attachTypeId}` : '') +
            (labelHint ? ` hint="${labelHint}"` : '') +
            (documentType ? ` type=${documentType}` : ''));
        for (const btn of addButtons) {
            const ok = await this.clickAddDocumentAndSetFiles(page, btn, filePayload);
            if (ok) {
                return true;
            }
        }
        return false;
    }
    async resolveAddDocumentButtons(page, attachTypeId, labelHint, documentType) {
        const buttons = [];
        const seen = new Set();
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
        const pushUnique = async (btn) => {
            if ((await btn.count()) === 0) {
                return;
            }
            const key = await btn
                .evaluate((el) => {
                const tr = el.closest('tr');
                const id = tr?.querySelector('[attachTypeId]')?.getAttribute('attachTypeId') ||
                    '';
                return `${id}|${el.value || el.textContent || ''}`;
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
                const scopes = [
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
        const hints = [
            labelHint,
            ...labelHintsForDocument(documentType, attachTypeId),
        ].filter(Boolean);
        for (const hint of hints) {
            const row = page
                .locator('tr')
                .filter({
                hasText: new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
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
    async countRowAttachments(page, attachTypeId, labelHint) {
        return page
            .evaluate(({ id, hint }) => {
            const rows = [
                ...document.querySelectorAll('tr:has([attachTypeId]), tr:has(input[value="Add Document"]), tr:has(input[value*="Add Document"])'),
            ];
            const match = rows.find((row) => {
                if (id && row.querySelector(`[attachTypeId="${id}"]`)) {
                    return true;
                }
                if (!hint) {
                    return false;
                }
                const label = (row.textContent || '').replace(/\s+/g, ' ');
                return new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(label);
            });
            if (!match) {
                return 0;
            }
            const thumbs = [
                ...match.querySelectorAll('.attach-item-list img, .attach-item-list a[href], img[src*="attach"], a[href*="downloadAttach"], a[href*="attach"]'),
            ];
            const fromQuery = thumbs.filter((el) => {
                if (el.tagName === 'IMG') {
                    const src = el.getAttribute('src') || '';
                    return src.length > 20 && !/icon|blank|spacer/i.test(src);
                }
                return true;
            }).length;
            if (fromQuery > 0) {
                return fromQuery;
            }
            return [...match.querySelectorAll('img')].filter((img) => {
                const src = img.getAttribute('src') || '';
                return src.length > 20 && !/icon|blank|spacer/i.test(src);
            }).length;
        }, { id: attachTypeId ?? '', hint: labelHint ?? '' })
            .catch(() => 0);
    }
    async rowAlreadyHasAttachment(page, attachTypeId, labelHint) {
        return (await this.countRowAttachments(page, attachTypeId, labelHint)) > 0;
    }
    async resolveLiveAttachTypeId(page, attachTypeId, labelHint) {
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
            const re = new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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
    async clickAddDocumentAndSetFiles(page, addBtn, filePayload) {
        await addBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        try {
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 15_000 }),
                addBtn.click({ force: true }),
            ]);
            await chooser.setFiles(filePayload);
        }
        catch (error) {
            this.logger.warn(`filechooser path failed: ${error instanceof Error ? error.message : 'unknown'} — trying injected input`);
            const already = await this.peekAlreadyUploadedDialog(page);
            if (already) {
                this.logger.log(`Step 6: portal says already uploaded — ${already}`);
                await this.dismissPostUploadDialogs(page);
                return true;
            }
            const injected = page
                .locator('input[type="file"]:not([name="photo"])')
                .last();
            if ((await injected.count()) === 0) {
                return false;
            }
            try {
                await injected.setInputFiles(filePayload);
            }
            catch {
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
    async peekAlreadyUploadedDialog(page) {
        return page
            .evaluate(() => {
            for (const win of document.querySelectorAll('.messager-body, .messager-window .panel-body, .messager-window')) {
                const style = getComputedStyle(win);
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
    async dismissPostUploadDialogs(page) {
        await page.evaluate(() => {
            for (const win of document.querySelectorAll('.messager-window, .panel.window')) {
                const text = (win.textContent || '').replace(/\s+/g, ' ');
                if (/It'?s processing|please wait|请求正在处理/i.test(text)) {
                    continue;
                }
                const ok = [
                    ...win.querySelectorAll('input.okButton, input[value="Ok"], input[value="OK"], button'),
                ].find((el) => /^(Ok|OK|确定)$/i.test((el.value || el.textContent || '').trim()));
                ok?.click();
            }
        });
    }
    async dumpAttachDebug(page) {
        return page
            .evaluate(() => {
            const ids = [
                ...document.querySelectorAll('[attachTypeId], .attach-item-list'),
            ]
                .map((el) => el.getAttribute('attachTypeId') || el.tagName)
                .slice(0, 12);
            const addCount = document.querySelectorAll('input[value="Add Document"], a');
            const addTexts = [...addCount]
                .map((el) => (el.value || el.textContent || '')
                .replace(/\s+/g, ' ')
                .trim())
                .filter((t) => /add document|upload|browse/i.test(t))
                .slice(0, 5);
            return `attachTypeIds=[${ids.join(',')}] addBtns=[${addTexts.join(' | ')}]`;
        })
            .catch(() => 'dump-failed');
    }
};
exports.FileAttacher = FileAttacher;
exports.FileAttacher = FileAttacher = FileAttacher_1 = __decorate([
    (0, common_1.Injectable)()
], FileAttacher);
//# sourceMappingURL=file.attacher.js.map