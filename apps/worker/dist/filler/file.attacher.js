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
            const filePayload = {
                name: this.fileNameFor(field.documentType, contentType),
                mimeType: contentType,
                buffer,
            };
            const locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
            if (locator && (await locator.count()) > 0) {
                await locator.setInputFiles(filePayload);
                this.logger.log(`Attached ${field.documentType} via file input (${field.selector})`);
                continue;
            }
            const attachTypeId = this.extractAttachTypeId(field.selector);
            if (attachTypeId) {
                const ok = await this.attachViaAddDocument(page, attachTypeId, filePayload);
                if (ok) {
                    this.logger.log(`Attached ${field.documentType} via Add Document (${attachTypeId})`);
                    continue;
                }
            }
            if (field.required) {
                throw new Error(`File input not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
                    (attachTypeId ? ` [attachTypeId=${attachTypeId}]` : ''));
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
    fileNameFor(documentType, contentType) {
        if (/jpeg|jpg/i.test(contentType)) {
            return `${documentType}.jpg`;
        }
        if (/png/i.test(contentType)) {
            return `${documentType}.png`;
        }
        return `${documentType}.pdf`;
    }
    async attachViaAddDocument(page, attachTypeId, filePayload) {
        const row = page.locator(`[attachTypeId="${attachTypeId}"]`).first();
        if ((await row.count()) === 0) {
            const alt = page
                .locator(`[data-attach-type-id="${attachTypeId}"], tr:has([onclick*="${attachTypeId}"])`)
                .first();
            if ((await alt.count()) === 0) {
                return false;
            }
            return this.clickAddDocumentAndSetFiles(page, alt, filePayload);
        }
        return this.clickAddDocumentAndSetFiles(page, row, filePayload);
    }
    async clickAddDocumentAndSetFiles(page, scope, filePayload) {
        const addBtn = scope
            .locator([
            'input[value="Add Document"]',
            'input[value="Upload"]',
            'input[value="Browse"]',
            'button:has-text("Add Document")',
            'a:has-text("Add Document")',
            'input[onclick*="showUpload"]',
            'a[onclick*="showUpload"]',
        ].join(', '))
            .first();
        if ((await addBtn.count()) === 0) {
            return false;
        }
        await addBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        try {
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 15_000 }),
                addBtn.click({ force: true }),
            ]);
            await chooser.setFiles(filePayload);
        }
        catch {
            const injected = page.locator('input[type="file"]:not([name="photo"])').last();
            if ((await injected.count()) === 0) {
                return false;
            }
            await injected.setInputFiles(filePayload).catch(() => undefined);
        }
        await page.waitForTimeout(500);
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
        return true;
    }
};
exports.FileAttacher = FileAttacher;
exports.FileAttacher = FileAttacher = FileAttacher_1 = __decorate([
    (0, common_1.Injectable)()
], FileAttacher);
//# sourceMappingURL=file.attacher.js.map