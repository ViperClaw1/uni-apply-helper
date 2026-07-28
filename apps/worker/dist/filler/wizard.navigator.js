"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardNavigator = void 0;
const common_1 = require("@nestjs/common");
const screenshot_service_js_1 = require("../screenshot/screenshot.service.js");
let WizardNavigator = class WizardNavigator {
    screenshotService;
    constructor(screenshotService) {
        this.screenshotService = screenshotService;
    }
    async forEachStep(page, wizard, handler, options) {
        for (let step = 1; step <= wizard.totalSteps; step += 1) {
            await handler(step);
            if (step < wizard.totalSteps) {
                const nextMarker = options?.markerForStep?.(step + 1);
                await this.clickNext(page, wizard.nextButtonSelector, nextMarker, options?.applicationId, step);
            }
        }
    }
    async clickNext(page, selector, nextStepMarker, applicationId, fromStep) {
        await this.waitForProcessingDone(page, 60_000);
        await this.dismissBlockingDialogs(page);
        await this.closeDatePickers(page);
        const next = await this.resolveNextButton(page, selector);
        await next.scrollIntoViewIfNeeded().catch(() => undefined);
        await next.waitFor({ state: 'visible', timeout: 15_000 }).catch(async () => {
            await next.waitFor({ state: 'attached', timeout: 15_000 });
        });
        const beforeSig = await this.getStepSignature(page);
        const beforeUrl = page.url();
        await next.click({ force: true });
        await page.waitForTimeout(300);
        await this.waitForProcessingDone(page, 60_000);
        if (nextStepMarker) {
            await page
                .waitForSelector(nextStepMarker, {
                state: 'attached',
                timeout: 25_000,
            })
                .catch(() => undefined);
        }
        const advanced = await Promise.race([
            page
                .waitForURL((url) => url.toString() !== beforeUrl, { timeout: 25_000 })
                .then(() => true)
                .catch(() => false),
            page
                .waitForFunction((before) => {
                const sig = window
                    .__uniApplyStepSig?.();
                const content = document.querySelector('#main_right_content, #apply_content, .main_right, form[name="applyForm"], form')?.innerHTML ?? '';
                const active = document
                    .querySelector('.list_title li.on, .list_title li.cur, .wizard li.active, li.current, .process li.on')
                    ?.textContent?.replace(/\s+/g, ' ')
                    .trim() ?? '';
                const names = [
                    ...document.querySelectorAll('input[name], select[name], textarea[name]'),
                ]
                    .map((el) => el.name || '')
                    .filter((n) => /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n))
                    .slice(0, 30)
                    .join('|');
                const markers = [
                    document.querySelector('input[name="apply.lastName"]') && 's1',
                    document.querySelector('input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]') && 's2',
                    document.querySelector('input[name="sh.studyPlace"], input[name="sh.startDate"]') && 's3',
                    document.querySelector('input[name="apply.emergencyName"]') && 's4',
                    document.querySelector('input[name="apply.homeMobile"]') && 's5',
                    document.querySelector('input[value="Add Document"], [attachTypeId] input[type="file"]') && 's6',
                    (/preview|submit/i.test(active) ||
                        (document.querySelector('input[value="Submit"]') &&
                            !document.querySelector('input[name="apply.homeMobile"]'))) &&
                        's7',
                ]
                    .filter(Boolean)
                    .join(',');
                const fingerprint = `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
                return (sig ?? fingerprint) !== before;
            }, beforeSig, { timeout: 25_000 })
                .then(() => true)
                .catch(() => false),
        ]);
        await this.waitForProcessingDone(page, 30_000);
        await this.dismissBlockingDialogs(page);
        await this.closeDatePickers(page);
        await page.waitForTimeout(500);
        if (!advanced) {
            const afterSig = await this.getStepSignature(page);
            if (afterSig === beforeSig) {
                const validation = await this.collectValidationHints(page);
                const label = `wizard-stuck-step${fromStep ?? '?'}`;
                const screenshotUrl = applicationId
                    ? await this.screenshotService.captureSafe(page, applicationId, label)
                    : undefined;
                throw new Error('Wizard step did not advance after Next (DOM/URL unchanged). ' +
                    `Still on fields: [${afterSig.split('|').slice(0, 12).join(', ')}]` +
                    (validation ? ` Validation: ${validation}` : '') +
                    (screenshotUrl ? ` Screenshot: ${screenshotUrl}` : ''));
            }
        }
    }
    async collectValidationHints(page) {
        return page.evaluate(() => {
            const texts = [];
            for (const el of document.querySelectorAll('span.error:not(:empty), label.error:not(:empty), .error:not(:empty), .tip-error, .validate-error, .messager-body')) {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (!t ||
                    t.length >= 120 ||
                    /It'?s processing|please wait|请求正在处理/i.test(t)) {
                    continue;
                }
                if (!texts.includes(t)) {
                    texts.push(t);
                }
            }
            const emptyRequired = [];
            for (const el of document.querySelectorAll('input[validate*="required"], select[validate*="required"], textarea[validate*="required"], input[data-options*="required:true"], select[data-options*="required:true"]')) {
                const input = el;
                if (input.type === 'hidden')
                    continue;
                if (input.type === 'checkbox') {
                    if (!input.checked) {
                        emptyRequired.push(input.name || input.id || '?');
                    }
                    continue;
                }
                if (input.type === 'radio') {
                    const name = input.name;
                    if (!name)
                        continue;
                    const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
                    const anyChecked = [...group].some((r) => r.checked);
                    if (!anyChecked && !emptyRequired.includes(name)) {
                        emptyRequired.push(name);
                    }
                    continue;
                }
                const val = (input.value || '').trim();
                if (!val || /please select|^-choose-$/i.test(val)) {
                    emptyRequired.push(input.name || input.id || '?');
                }
            }
            const parts = [
                texts.slice(0, 8).join(' | '),
                emptyRequired.length
                    ? `empty required: ${emptyRequired.slice(0, 15).join(', ')}`
                    : '',
            ].filter(Boolean);
            return parts.join(' || ').slice(0, 800);
        });
    }
    async getStepSignature(page) {
        return page.evaluate(() => {
            const content = document.querySelector('#main_right_content, #apply_content, .main_right, form[name="applyForm"], form')?.innerHTML ?? '';
            const active = document
                .querySelector('.list_title li.on, .list_title li.cur, .wizard li.active, li.current, .process li.on')
                ?.textContent?.replace(/\s+/g, ' ')
                .trim() ?? '';
            const names = [
                ...document.querySelectorAll('input[name], select[name], textarea[name]'),
            ]
                .map((el) => el.name || '')
                .filter((n) => /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n))
                .slice(0, 30)
                .join('|');
            const markers = [
                document.querySelector('input[name="apply.lastName"]') && 's1',
                document.querySelector('input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]') && 's2',
                document.querySelector('input[name="sh.studyPlace"], input[name="sh.startDate"]') &&
                    's3',
                document.querySelector('input[name="apply.emergencyName"]') && 's4',
                document.querySelector('input[name="apply.homeMobile"]') && 's5',
                document.querySelector('input[value="Add Document"], [attachTypeId] input[type="file"]') && 's6',
                (/preview|submit/i.test(active) ||
                    (document.querySelector('input[value="Submit"]') &&
                        !document.querySelector('input[name="apply.homeMobile"]'))) &&
                    's7',
            ]
                .filter(Boolean)
                .join(',');
            return `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
        });
    }
    async resolveNextButton(page, selector) {
        const saveAndNext = page
            .locator('input[value="Save and Next"], input[value="保存并下一步"], button:has-text("Save and Next")')
            .first();
        if ((await saveAndNext.count()) > 0) {
            return saveAndNext;
        }
        const preferred = page.locator('input[type="submit"][value="Next"]').first();
        if ((await preferred.count()) > 0) {
            return preferred;
        }
        const byValue = page.locator('input[value="Next"]').first();
        if ((await byValue.count()) > 0) {
            return byValue;
        }
        const cssButton = page.locator(selector).first();
        if ((await cssButton.count()) > 0) {
            const value = await cssButton.getAttribute('value');
            if (!value || !/^save$/i.test(value.trim())) {
                return cssButton;
            }
        }
        const fallbacks = [
            'input[value="下一步"]',
            'button:has-text("Next")',
            'button:has-text("下一步")',
        ];
        for (const fallback of fallbacks) {
            const btn = page.locator(fallback).first();
            if ((await btn.count()) > 0) {
                return btn;
            }
        }
        const semanticButton = page
            .getByRole('button', {
            name: /save and next|^(next|下一步|保存并下一步)$/i,
        })
            .first();
        if ((await semanticButton.count()) > 0) {
            return semanticButton;
        }
        return preferred;
    }
    async dismissBlockingDialogs(page) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const processingVisible = await this.isProcessingVisible(page);
            if (processingVisible) {
                await this.waitForProcessingDone(page, 60_000);
                continue;
            }
            const okButton = page
                .locator([
                '.messager-button .okButton',
                '.messager-button input[value="Ok"]',
                '.messager-button input[value="OK"]',
                '.messager-button a.l-btn:has-text("Ok")',
                '.messager-button a.l-btn:has-text("OK")',
                '.messager-button a:has-text("Ok")',
                '.messager-button a:has-text("OK")',
                '.messager-button a:has-text("确定")',
                'input.okButton',
                'button:has-text("OK")',
                'button:has-text("Ok")',
                'button:has-text("Continue")',
                'button:has-text("Accept")',
                'button:has-text("确定")',
                'a.l-btn:has-text("Ok")',
                'a.l-btn:has-text("OK")',
            ].join(', '))
                .first();
            if ((await okButton.count()) === 0) {
                break;
            }
            if (!(await okButton.isVisible().catch(() => false))) {
                break;
            }
            const isProcessingDialog = await page
                .evaluate(() => {
                const wins = [
                    ...document.querySelectorAll('.messager-window, .panel.window'),
                ];
                return wins.some((win) => {
                    const style = getComputedStyle(win);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    return /It'?s processing|please wait|请求正在处理/i.test(win.textContent || '');
                });
            })
                .catch(() => false);
            if (isProcessingDialog) {
                await this.waitForProcessingDone(page, 60_000);
                continue;
            }
            await okButton.click({ force: true }).catch(() => undefined);
            await page.waitForTimeout(400);
        }
    }
    async clickSubmit(page, selector) {
        await this.waitForProcessingDone(page, 60_000);
        await this.dismissBlockingDialogs(page);
        await this.closeDatePickers(page);
        const submit = await this.resolveSubmitButton(page, selector);
        await submit.scrollIntoViewIfNeeded().catch(() => undefined);
        await submit
            .waitFor({ state: 'visible', timeout: 15_000 })
            .catch(async () => {
            await submit.waitFor({ state: 'attached', timeout: 15_000 });
        });
        const beforeSig = await this.getStepSignature(page);
        await submit.click({ force: true });
        await page.waitForTimeout(300);
        await this.confirmSubmitDialog(page);
        await this.waitForProcessingDone(page, 90_000);
        await this.dismissBlockingDialogs(page);
        const success = await page
            .waitForFunction((before) => {
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
            if (/successfully submitted|submit(ted)? successfully|application (has been )?submitted|申请.*成功|提交成功|has been received|status\s*[:：]\s*submitted/i.test(text)) {
                return true;
            }
            if (/are you sure you want to submit|can not be revised|cannot be revised/i.test(text)) {
                return false;
            }
            if (/\bfilled in\b/i.test(text) && /Application Status/i.test(text)) {
                return false;
            }
            const content = document.querySelector('#main_right_content, #apply_content, .main_right, form')?.innerHTML ?? '';
            const active = document
                .querySelector('.list_title li.on, .list_title li.cur, .wizard li.active, li.current')
                ?.textContent?.replace(/\s+/g, ' ')
                .trim() ?? '';
            const names = [
                ...document.querySelectorAll('input[name], select[name]'),
            ]
                .map((el) => el.name || '')
                .filter((n) => /^(apply|applyEx|sh\.|wh\.|ocr)/.test(n))
                .slice(0, 30)
                .join('|');
            const markers = [
                document.querySelector('input[name="apply.lastName"]') && 's1',
                document.querySelector('input[name="apply.fieldEnglish"], input[name="apply.studyStartDate"]') && 's2',
                document.querySelector('input[name="sh.studyPlace"], input[name="sh.startDate"]') && 's3',
                document.querySelector('input[name="apply.emergencyName"]') &&
                    's4',
                document.querySelector('input[name="apply.homeMobile"]') && 's5',
                document.querySelector('input[value="Add Document"], [attachTypeId]') && 's6',
                /preview|submit/i.test(active) && 's7',
            ]
                .filter(Boolean)
                .join(',');
            const sig = `${location.pathname}|${active}|${markers}|${content.length}|${names}`;
            return sig !== before;
        }, beforeSig, { timeout: 20_000 })
            .then(() => true)
            .catch(() => false);
        await this.confirmSubmitDialog(page);
        await this.dismissBlockingDialogs(page);
        await page.waitForTimeout(500);
        const stillPending = await page.evaluate(() => {
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
            return (/are you sure you want to submit|can not be revised|cannot be revised/i.test(text) ||
                (/\bfilled in\b/i.test(text) && /Application Status/i.test(text)));
        });
        if (stillPending || !success) {
            const hasError = await page.evaluate(() => {
                const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
                return (/failed|error|invalid|必填|不能为空/i.test(text) &&
                    Boolean(document.querySelector('span.error:not(:empty), label.error:not(:empty), .validate-error')));
            });
            if (hasError || stillPending) {
                throw new Error(stillPending
                    ? 'Final submit stopped on Confirm dialog or status still "filled in" — Ok was not confirmed.'
                    : 'Final submit did not succeed (validation/error still on page, URL unchanged as expected for 17gz AJAX).');
            }
        }
    }
    async confirmSubmitDialog(page) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const visible = await page.evaluate(() => {
                const wins = [
                    ...document.querySelectorAll('.messager-window, .panel.window'),
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
                    return /are you sure you want to submit|can not be revised|cannot be revised|确认提交|无法修改/i.test(win.textContent || '');
                });
            });
            if (!visible) {
                return;
            }
            const ok = page
                .locator([
                '.messager-window:visible .messager-button a.l-btn:has-text("Ok")',
                '.messager-window:visible .messager-button a:has-text("Ok")',
                '.messager-window:visible .messager-button input[value="Ok"]',
                '.messager-window:visible .messager-button a:has-text("确定")',
                '.messager-button a.l-btn:has-text("Ok")',
                '.messager-button a:has-text("Ok")',
                'input.okButton',
            ].join(', '))
                .first();
            if ((await ok.count()) > 0) {
                await ok.click({ force: true }).catch(() => undefined);
                await page.waitForTimeout(500);
                await this.waitForProcessingDone(page, 60_000);
            }
            else {
                await this.dismissBlockingDialogs(page);
            }
        }
    }
    async resolveSubmitButton(page, selector) {
        const explicit = page
            .locator('input[value="Submit"], input[value="提交"], button:has-text("Submit"), button:has-text("提交")')
            .first();
        if ((await explicit.count()) > 0) {
            return explicit;
        }
        const saveAndNext = page
            .locator('input[value="Save and Next"], input[value="保存并下一步"], button:has-text("Save and Next")')
            .first();
        if ((await saveAndNext.count()) > 0) {
            return saveAndNext;
        }
        const css = page.locator(selector).first();
        if ((await css.count()) > 0) {
            return css;
        }
        return explicit;
    }
    async waitForUiReady(page) {
        await page
            .locator('.window-mask, .el-loading-mask, .datagrid-mask')
            .first()
            .waitFor({ state: 'hidden', timeout: 20_000 })
            .catch(() => undefined);
        await this.waitForProcessingDone(page, 60_000);
    }
    async waitForProcessingDone(page, timeoutMs = 60_000) {
        await page
            .waitForFunction(() => {
            const bodyText = document.body?.innerText ?? '';
            if (/It'?s processing|请求正在处理中|please wait|processing your request/i.test(bodyText)) {
                const wins = [
                    ...document.querySelectorAll('.messager-window, .panel.window, .window-mask, .datagrid-mask'),
                ];
                const visibleProcessing = wins.some((win) => {
                    const style = getComputedStyle(win);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    const rect = win.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return false;
                    }
                    return /It'?s processing|please wait|请求正在处理|processing your request/i.test(win.textContent || '');
                });
                return !visibleProcessing;
            }
            return true;
        }, { timeout: timeoutMs })
            .catch(() => undefined);
        await page.waitForTimeout(300);
    }
    async isProcessingVisible(page) {
        return page
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
                return /It'?s processing|please wait|请求正在处理|processing your request/i.test(win.textContent || '');
            });
        })
            .catch(() => false);
    }
    async closeDatePickers(page) {
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.evaluate(() => {
            for (const el of document.querySelectorAll('.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel')) {
                el.style.display = 'none';
            }
            document.activeElement?.blur?.();
        });
    }
};
exports.WizardNavigator = WizardNavigator;
exports.WizardNavigator = WizardNavigator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [screenshot_service_js_1.ScreenshotService])
], WizardNavigator);
//# sourceMappingURL=wizard.navigator.js.map