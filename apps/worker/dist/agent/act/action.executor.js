"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ActionExecutor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionExecutor = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
let ActionExecutor = ActionExecutor_1 = class ActionExecutor {
    logger = new common_1.Logger(ActionExecutor_1.name);
    async execute(page, action) {
        switch (action.type) {
            case 'fill':
                await this.fillValue(page, action);
                return;
            case 'select':
                await this.resolveLocator(page, action.target)
                    .selectOption({ label: action.value ?? '' })
                    .catch(async () => {
                    await this.resolveLocator(page, action.target).selectOption(action.value ?? '');
                });
                return;
            case 'check':
                await this.resolveLocator(page, action.target).check();
                return;
            case 'click':
                if (this.isForbiddenWizardBackNav(action)) {
                    this.logger.warn(`Blocked agent back-navigation: ${JSON.stringify(action.target)} — stay on current step`);
                    throw new Error('Refusing to navigate to an earlier wizard step. Fill the current step and click Save and Next.');
                }
                await this.resolveLocator(page, action.target).click({ force: true });
                return;
            case 'upload':
                await this.executeUpload(page, action);
                return;
            case 'wait':
                await page.waitForTimeout(Number(action.value ?? 1_000));
                return;
            case 'done':
            case 'fail':
                return;
            default:
                throw new Error(`Unsupported agent action: ${action.type}`);
        }
    }
    isForbiddenWizardBackNav(action) {
        const blob = [
            action.target?.selector,
            action.target?.name,
            action.target?.label,
            action.reason,
        ]
            .filter(Boolean)
            .join(' ');
        if (/Save and Next|保存并下一步|Next|下一步|Previous|上一步/i.test(blob) &&
            !/Step\s*[1-3]\b|Basic Info|Study Plan/i.test(blob)) {
            return false;
        }
        return (/step\s*=\s*[123]\b|step-[123]\b|Basic Info|Study Plan|Education & Employment/i.test(blob) ||
            /wizard step\s*[123]\b|navigate bac|go back to step/i.test(blob));
    }
    async fillValue(page, action) {
        const raw = action.value ?? '';
        const value = normalizeDateLike(raw);
        const locator = this.resolveLocator(page, action.target);
        const looksLikeDate = isDateLikeValue(value) || isDateTarget(action.target);
        if (looksLikeDate) {
            const set = await locator
                .evaluate((el, nextValue) => {
                const input = el;
                input.focus();
                input.value = nextValue;
                input.setAttribute('value', nextValue);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
                return true;
            }, value)
                .catch(() => false);
            await this.closeDatePickers(page);
            if (set)
                return;
        }
        await locator.fill(value);
        if (looksLikeDate) {
            await this.closeDatePickers(page);
        }
    }
    async closeDatePickers(page) {
        await page.evaluate(() => {
            const roots = [
                ...document.querySelectorAll('.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel'),
            ];
            for (const root of roots) {
                const style = getComputedStyle(root);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    continue;
                }
                const ok = [
                    ...root.querySelectorAll('#dpOkInput, input[value="OK"], input[value="Ok"], input[value="确定"], button'),
                ].find((el) => /^(OK|Ok|确定)$/i.test((el.value || el.textContent || '').trim()));
                ok?.click();
            }
        });
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.evaluate(() => {
            for (const el of document.querySelectorAll('.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel')) {
                el.style.display = 'none';
            }
            document.activeElement?.blur?.();
        });
    }
    async executeUpload(page, action) {
        const source = action.filePath ?? action.value;
        if (!source?.trim()) {
            throw new Error('upload action requires filePath or value');
        }
        const payload = await this.resolveFilePayload(source.trim());
        if (action.target) {
            try {
                const locator = this.resolveLocator(page, action.target);
                if ((await locator.count()) > 0) {
                    const tag = await locator
                        .evaluate((el) => el.tagName)
                        .catch(() => '');
                    const type = await locator
                        .evaluate((el) => el.type)
                        .catch(() => '');
                    if (tag === 'INPUT' && type === 'file') {
                        await locator.setInputFiles(payload);
                        return;
                    }
                }
            }
            catch {
            }
        }
        if (!action.target) {
            throw new Error('upload: target required (do not click first Add Document on Step 6)');
        }
        try {
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 15_000 }),
                this.resolveLocator(page, action.target).click({ force: true }),
            ]);
            await chooser.setFiles(payload);
        }
        catch (error) {
            const already = await page
                .evaluate(() => {
                for (const win of document.querySelectorAll('.messager-body, .messager-window')) {
                    const t = (win.textContent || '').replace(/\s+/g, ' ');
                    if (/already uploaded|Click Save and Next/i.test(t)) {
                        return t.slice(0, 200);
                    }
                }
                return null;
            })
                .catch(() => null);
            if (already) {
                this.logger.log(`upload skipped — already uploaded: ${already}`);
                await page.evaluate(() => {
                    for (const win of document.querySelectorAll('.messager-window, .panel.window')) {
                        const ok = [
                            ...win.querySelectorAll('input.okButton, input[value="Ok"], input[value="OK"], button, a'),
                        ].find((el) => /^(Ok|OK|确定)$/i.test((el.value || el.textContent || '').trim()));
                        ok?.click();
                    }
                });
                return;
            }
            throw error;
        }
        const label = typeof payload === 'string' ? payload : payload.name;
        this.logger.log(`upload via filechooser: ${label}`);
    }
    async resolveFilePayload(source) {
        if (/^https?:\/\//i.test(source)) {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`upload: failed to download ${source} (${response.status})`);
            }
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const buffer = Buffer.from(await response.arrayBuffer());
            const ext = extensionFromMime(contentType);
            return {
                name: `upload${ext}`,
                mimeType: contentType.split(';')[0]?.trim() || 'application/octet-stream',
                buffer,
            };
        }
        if (!(0, node_fs_1.existsSync)(source)) {
            throw new Error(`upload: file not found: ${source}`);
        }
        return source;
    }
    resolveLocator(page, target) {
        if (!target) {
            throw new Error('Agent action target is required.');
        }
        if (target.selector) {
            const first = target.selector
                .split(',')
                .map((part) => part.trim())
                .find((part) => part.length > 0);
            return page.locator(first || target.selector).first();
        }
        if (target.label) {
            return page.getByLabel(target.label, { exact: false }).first();
        }
        if (target.placeholder) {
            return page.getByPlaceholder(target.placeholder, { exact: false }).first();
        }
        if (target.role && target.name) {
            return page
                .getByRole(target.role, {
                name: target.name,
                exact: false,
            })
                .first();
        }
        if (target.name) {
            return page.getByText(target.name, { exact: false }).first();
        }
        throw new Error('Could not resolve locator from agent target.');
    }
};
exports.ActionExecutor = ActionExecutor;
exports.ActionExecutor = ActionExecutor = ActionExecutor_1 = __decorate([
    (0, common_1.Injectable)()
], ActionExecutor);
function extensionFromMime(mime) {
    const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
    if (base.includes('pdf'))
        return '.pdf';
    if (base.includes('png'))
        return '.png';
    if (base.includes('jpeg') || base.includes('jpg'))
        return '.jpg';
    if (base.includes('webp'))
        return '.webp';
    return '.bin';
}
function normalizeDateLike(value) {
    const trimmed = value.trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    return iso?.[1] ?? trimmed;
}
function isDateLikeValue(value) {
    return /^\d{4}-\d{2}-\d{2}/.test(value.trim());
}
function isDateTarget(target) {
    if (!target)
        return false;
    const blob = [target.selector, target.label, target.name, target.placeholder]
        .filter(Boolean)
        .join(' ');
    return /date|borned|birth|expire|expiry|attended|startDate|endDate/i.test(blob);
}
//# sourceMappingURL=action.executor.js.map