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
const field_locator_js_1 = require("./field.locator.js");
let FileAttacher = FileAttacher_1 = class FileAttacher {
    logger = new common_1.Logger(FileAttacher_1.name);
    async attachFiles(page, profile, fields) {
        const fileFields = fields.filter((field) => field.type === 'file' && field.documentType);
        if (fileFields.length === 0) {
            return;
        }
        await page
            .waitForSelector([
            '[attachTypeId]',
            '.attach-item-list',
            'input[value="Add Document"]',
            'a:has-text("Add Document")',
        ].join(', '), { state: 'attached', timeout: 20_000 })
            .catch(() => undefined);
        for (const field of fileFields) {
            const fileUrl = profile.documents[field.documentType];
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
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const buffer = Buffer.from(await response.arrayBuffer());
            const filePayload = this.toFilePayload(field.documentType, contentType, buffer);
            const locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
            if (locator && (await locator.count()) > 0) {
                const tag = await locator.evaluate((el) => el.tagName).catch(() => '');
                if (tag === 'INPUT') {
                    await locator.setInputFiles(filePayload);
                    this.logger.log(`Attached ${field.documentType} via file input (${field.selector})`);
                    await this.dismissPostUploadDialogs(page);
                    continue;
                }
            }
            const attachTypeId = this.extractAttachTypeId(field.selector);
            const ok = await this.attachViaAddDocument(page, attachTypeId, filePayload, field.labelHint || field.documentType);
            if (ok) {
                this.logger.log(`Attached ${field.documentType} via Add Document` +
                    (attachTypeId ? ` (${attachTypeId})` : ''));
                continue;
            }
            if (field.required) {
                const dump = await this.dumpAttachDebug(page);
                throw new Error(`File input not found: ${field.selector}` +
                    `${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
                    (attachTypeId ? ` [attachTypeId=${attachTypeId}]` : '') +
                    ` | DOM: ${dump}`);
            }
        }
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
    async attachViaAddDocument(page, attachTypeId, filePayload, labelHint) {
        const addButtons = await this.resolveAddDocumentButtons(page, attachTypeId, labelHint);
        for (const btn of addButtons) {
            const ok = await this.clickAddDocumentAndSetFiles(page, btn, filePayload);
            if (ok) {
                return true;
            }
        }
        return false;
    }
    async resolveAddDocumentButtons(page, attachTypeId, labelHint) {
        const buttons = [];
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
            const scopes = [
                page.locator(`tr:has([attachTypeId="${attachTypeId}"])`).first(),
                page.locator(`[attachTypeId="${attachTypeId}"]`).first(),
                page
                    .locator(`.attach-item-list[attachTypeId="${attachTypeId}"]`)
                    .first(),
                page
                    .locator(`[attachtypeid="${attachTypeId}"], [data-attach-type-id="${attachTypeId}"]`)
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
                const parentTr = scope.locator('xpath=ancestor-or-self::tr[1]');
                if ((await parentTr.count()) > 0) {
                    const inTr = parentTr.locator(addSelector).first();
                    if ((await inTr.count()) > 0) {
                        buttons.push(inTr);
                    }
                }
            }
        }
        const hints = [
            labelHint,
            attachTypeId?.includes('passport') ? 'Passport' : undefined,
            attachTypeId?.includes('HighstEducation') ||
                attachTypeId?.includes('HighestEducation')
                ? 'Diploma'
                : undefined,
            attachTypeId?.includes('score') ? 'Transcript' : undefined,
            attachTypeId?.includes('checkBody') ? 'Physical Examination' : undefined,
        ].filter(Boolean);
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
        if (buttons.length === 0) {
            const global = page.locator(addSelector).first();
            if ((await global.count()) > 0) {
                buttons.push(global);
            }
        }
        return buttons;
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
        await this.dismissPostUploadDialogs(page);
        return true;
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