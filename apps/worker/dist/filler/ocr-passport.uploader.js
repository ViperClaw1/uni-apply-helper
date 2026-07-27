"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OcrPassportUploader_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrPassportUploader = void 0;
const common_1 = require("@nestjs/common");
const PHOTO_INPUT = 'input[type="file"][name="photo"], input[name="photo"][type="file"]';
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
let OcrPassportUploader = OcrPassportUploader_1 = class OcrPassportUploader {
    logger = new common_1.Logger(OcrPassportUploader_1.name);
    async upload(page, profile) {
        this.logger.log('OCR step 1/4: upload passport via Upload Image + filechooser');
        await this.uploadPassportViaButton(page, profile.documents.passport);
        this.logger.log('OCR step 2/4: wait Recognized Information filled');
        await this.waitForOcrReady(page);
        this.logger.log('OCR step 3/4: Confirm Passport Information');
        await this.confirmPassportOcr(page);
        this.logger.log('OCR step 4/4: dismiss copy dialog + wait apply.* + photo');
        await this.dismissInfoDialogs(page);
        await this.waitForApplySync(page);
        await this.dismissInfoDialogs(page);
        await this.closeDatePickers(page);
        await this.uploadPhoto(page, profile.documents.photo);
        await this.dismissInfoDialogs(page);
    }
    async uploadPassportViaButton(page, fileUrl) {
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
    async waitForOcrReady(page) {
        const deadline = Date.now() + 90_000;
        let lastState = null;
        while (Date.now() < deadline) {
            lastState = await this.readOcrDebugState(page);
            this.logger.debug(`OCR poll: filled=${lastState.ocrFilledCount} processing=${lastState.processingVisible} confirmDisabled=${lastState.confirmDisabled}`);
            if (!lastState.processingVisible && lastState.ocrFilledCount >= 2) {
                this.logger.log(`OCR ready: ${lastState.ocrFilled.map((f) => `${f.name}=${f.value}`).join(', ')}`);
                await page.waitForTimeout(400);
                return;
            }
            await page.waitForTimeout(1_000);
        }
        throw new Error('OCR did not finish within 90s. ' + this.formatDebug(lastState));
    }
    async confirmPassportOcr(page) {
        const confirm = page.locator(CONFIRM_PASSPORT_BTN).first();
        await confirm.waitFor({ state: 'attached', timeout: 15_000 });
        if ((await confirm.count()) === 0) {
            throw new Error('Confirm Passport Information button not found. ' +
                this.formatDebug(await this.readOcrDebugState(page)));
        }
        await confirm.scrollIntoViewIfNeeded().catch(() => undefined);
        try {
            await confirm.click({ timeout: 5_000 });
        }
        catch {
            await confirm.click({ force: true, timeout: 5_000 });
        }
        await page.waitForTimeout(800);
    }
    async dismissInfoDialogs(page) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const clicked = await page.evaluate(() => {
                const isVisible = (el) => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                };
                const windows = [
                    ...document.querySelectorAll('.messager-window, .panel.window, .messager-body'),
                ].filter(isVisible);
                for (const win of windows) {
                    const text = (win.textContent || '').replace(/\s+/g, ' ');
                    if (/It'?s processing|请求正在处理中|processing your request/i.test(text)) {
                        continue;
                    }
                    const ok = [
                        ...win.querySelectorAll('input.okButton, input[value="Ok"], input[value="OK"], a.l-btn, button'),
                    ].find((el) => /^(Ok|OK|确定)$/i.test((el.value || el.textContent || '').trim()));
                    if (ok) {
                        ok.click();
                        return true;
                    }
                }
                const globalOk = [
                    ...document.querySelectorAll('input.okButton, .messager-button input[value="Ok"], .messager-button input[value="OK"]'),
                ].find(isVisible);
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
    async closeDatePickers(page) {
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.evaluate(() => {
            for (const el of document.querySelectorAll('.WdateDiv, #_my97DP, .datebox-calendar-inner, .calendar')) {
                el.style.display = 'none';
            }
            const active = document.activeElement;
            active?.blur?.();
        });
    }
    async waitForApplySync(page) {
        await this.waitForVisibleProcessingGone(page, 45_000);
        const synced = await page
            .waitForFunction(() => {
            const last = document.querySelector('input[name="apply.lastName"]');
            const given = document.querySelector('input[name="apply.givenName"]');
            const passport = document.querySelector('input[name="apply.passportNo"]');
            return Boolean((last?.value && last.value.trim().length > 0) ||
                (given?.value && given.value.trim().length > 0) ||
                (passport?.value && passport.value.trim().length > 0));
        }, { timeout: 30_000 })
            .then(() => true)
            .catch(() => false);
        const state = await this.readOcrDebugState(page);
        if (!synced) {
            this.logger.warn(`apply.* not synced after Confirm (continuing). ${this.formatDebug(state)}`);
            return;
        }
        this.logger.log(`apply.* synced: lastName=${state.applyLastName} passportNo=${state.applyPassportNo}`);
    }
    async uploadPhoto(page, fileUrl) {
        if (!fileUrl) {
            throw new Error('Missing required document: photo');
        }
        const file = await this.downloadFile(fileUrl, 'photo');
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
            }
            catch (error) {
                this.logger.warn(`setInputFiles(photo) failed, trying Add your photo: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        const addBtn = page.locator(ADD_PHOTO_BTN).first();
        await addBtn
            .waitFor({ state: 'attached', timeout: 10_000 })
            .catch(() => undefined);
        if ((await addBtn.count()) === 0) {
            throw new Error(`Photo upload failed: neither ${PHOTO_INPUT} nor Add your photo found`);
        }
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 15_000 }),
            addBtn.click({ force: true }),
        ]);
        await fileChooser.setFiles(file);
        this.logger.log('Photo uploaded via Add your photo + filechooser');
        await page.waitForTimeout(500);
    }
    async readOcrDebugState(page) {
        return page.evaluate(() => {
            const isVisible = (el) => {
                if (!el) {
                    return false;
                }
                const style = getComputedStyle(el);
                if (style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    style.opacity === '0') {
                    return false;
                }
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            };
            const processingNodes = [
                ...document.querySelectorAll('.messager-window, .panel.window, .window-mask, .messager-body'),
            ].filter((el) => isVisible(el));
            const processingText = processingNodes
                .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
                .find((t) => /processing|please wait|请求正在处理/i.test(t)) ?? '';
            const processingVisible = Boolean(processingText);
            const ocrFilled = [...document.querySelectorAll('input[name^="ocr."]')]
                .filter((input) => input.type !== 'checkbox' &&
                input.type !== 'radio' &&
                input.type !== 'hidden' &&
                (input.value || '').trim().length > 0)
                .map((input) => ({
                name: input.name,
                value: input.value.trim().slice(0, 40),
            }));
            const confirm = [
                ...document.querySelectorAll('input[type="button"], input[type="submit"], button, a'),
            ].find((el) => /Confirm Passport/i.test((el.value || el.textContent || '').trim()));
            const applyLastName = document.querySelector('input[name="apply.lastName"]')?.value?.trim() ?? '';
            const applyPassportNo = document.querySelector('input[name="apply.passportNo"]')?.value?.trim() ?? '';
            return {
                processingVisible,
                processingText: processingText.slice(0, 80),
                ocrFilled,
                ocrFilledCount: ocrFilled.length,
                confirmFound: Boolean(confirm),
                confirmTag: confirm ? confirm.tagName.toLowerCase() : '',
                confirmDisabled: Boolean(confirm && 'disabled' in confirm && confirm.disabled),
                confirmClass: confirm?.className?.toString().slice(0, 80) ?? '',
                applyLastName,
                applyPassportNo,
            };
        });
    }
    formatDebug(state) {
        if (!state) {
            return 'debug=unavailable';
        }
        return (`debug={processing:${state.processingVisible}` +
            ` "${state.processingText}";` +
            ` ocrFilled:${state.ocrFilledCount}` +
            ` [${state.ocrFilled.map((f) => `${f.name}=${f.value}`).join('; ')}];` +
            ` confirm:${state.confirmFound}/${state.confirmTag}` +
            ` disabled=${state.confirmDisabled}` +
            ` class="${state.confirmClass}";` +
            ` apply.lastName="${state.applyLastName}"` +
            ` apply.passportNo="${state.applyPassportNo}"}`);
    }
    async waitForVisibleProcessingGone(page, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const state = await this.readOcrDebugState(page);
            if (!state.processingVisible) {
                return;
            }
            await page.waitForTimeout(500);
        }
    }
    async downloadFile(fileUrl, documentType) {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to download document ${documentType}`);
        }
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
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
};
exports.OcrPassportUploader = OcrPassportUploader;
exports.OcrPassportUploader = OcrPassportUploader = OcrPassportUploader_1 = __decorate([
    (0, common_1.Injectable)()
], OcrPassportUploader);
//# sourceMappingURL=ocr-passport.uploader.js.map