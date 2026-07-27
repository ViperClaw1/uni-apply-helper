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
exports.FormFiller = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const agent_config_js_1 = require("../agent/agent.config.js");
const form_agent_js_1 = require("../agent/form.agent.js");
const semantic_field_mapper_js_1 = require("../agent/dom/semantic-field.mapper.js");
const field_locator_js_1 = require("./field.locator.js");
const field_mapper_js_1 = require("./field.mapper.js");
const file_attacher_js_1 = require("./file.attacher.js");
const ocr_passport_uploader_js_1 = require("./ocr-passport.uploader.js");
const wizard_field_groups_js_1 = require("./wizard-field-groups.js");
const wizard_navigator_js_1 = require("./wizard.navigator.js");
let FormFiller = class FormFiller {
    configService;
    fieldMapper;
    fileAttacher;
    ocrPassportUploader;
    wizardNavigator;
    wizardFieldGroups;
    semanticFieldMapper;
    formAgent;
    constructor(configService, fieldMapper, fileAttacher, ocrPassportUploader, wizardNavigator, wizardFieldGroups, semanticFieldMapper, formAgent) {
        this.configService = configService;
        this.fieldMapper = fieldMapper;
        this.fileAttacher = fileAttacher;
        this.ocrPassportUploader = ocrPassportUploader;
        this.wizardNavigator = wizardNavigator;
        this.wizardFieldGroups = wizardFieldGroups;
        this.semanticFieldMapper = semanticFieldMapper;
        this.formAgent = formAgent;
    }
    async fillFields(page, profile, fields, motivationLetterContent, university) {
        const fillMode = university
            ? (0, agent_config_js_1.resolveFillMode)(this.configService, university)
            : 'schema';
        await this.fillFieldBatch(page, profile, fields, motivationLetterContent, fillMode);
    }
    async attachFiles(page, profile, fields) {
        await this.fileAttacher.attachFiles(page, profile, fields);
    }
    async submit(page) {
        const submit = page
            .locator([
            "button[type='submit']",
            "input[type='submit']",
            'button:has-text("Submit")',
            'button:has-text("Отправить")',
        ].join(', '))
            .first();
        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
            submit.click(),
        ]);
    }
    async processWizard(page, profile, university, motivationLetterContent, applicationId) {
        const fillMode = (0, agent_config_js_1.resolveFillMode)(this.configService, university);
        if (fillMode === 'agent') {
            const result = await this.formAgent.runWizard(page, profile, university, motivationLetterContent);
            if (!result.completed) {
                throw new Error(result.finalAction?.reason ??
                    'Agent failed to complete the wizard form.');
            }
            return;
        }
        const wizard = university.wizard;
        if (!wizard) {
            throw new Error(`University "${university.id}" has no wizard config`);
        }
        await this.waitForStepOneFields(page, university);
        await this.wizardNavigator.forEachStep(page, wizard, async (step) => {
            if (step === 1 &&
                this.isPkuLike(university)) {
                await this.ocrPassportUploader.upload(page, profile);
            }
            const fields = this.wizardFieldGroups.fieldsForStep(university, step);
            await this.dismissFormOverlays(page);
            await this.fillFieldBatch(page, profile, fields.filter((field) => field.type !== 'file'), motivationLetterContent, fillMode);
            if (step === 1) {
                await this.ensureChineseNameWaiver(page, profile);
                if (this.isPkuLike(university)) {
                    await this.ensurePkuStep1RequiredGaps(page);
                }
            }
            if (step === 2 && this.isPkuLike(university)) {
                await this.ensurePkuStep2RequiredGaps(page, profile);
                await this.assertPkuStep2CriticalFilled(page, profile);
            }
            await this.dismissFormOverlays(page);
            const fileFields = fields.filter((field) => {
                if (field.type !== 'file') {
                    return false;
                }
                if (step === 1 &&
                    university.navigationHints?.ocrPassportUpload &&
                    field.documentType === 'photo') {
                    return false;
                }
                return true;
            });
            if (fileFields.length > 0) {
                await this.fileAttacher.attachFiles(page, profile, fileFields);
            }
        }, {
            applicationId,
            markerForStep: (step) => {
                const fields = this.wizardFieldGroups.fieldsForStep(university, step);
                return (fields.find((field) => field.selector && field.type !== 'file')
                    ?.selector ??
                    fields.find((field) => field.selector)?.selector);
            },
        });
        await this.wizardNavigator.clickSubmit(page, wizard.submitButtonSelector);
    }
    async waitForStepOneFields(page, university) {
        const stepOneSelectors = this.wizardFieldGroups
            .fieldsForStep(university, 1)
            .filter((field) => field.selector && field.type !== 'file')
            .slice(0, 3)
            .map((field) => field.selector);
        if (stepOneSelectors.length === 0) {
            return;
        }
        const selector = stepOneSelectors.join(', ');
        try {
            await page.waitForSelector(selector, {
                state: 'attached',
                timeout: 15_000,
            });
        }
        catch {
            throw new Error(`Step 1 form fields not found after navigation (${selector}). URL: ${page.url()}`);
        }
    }
    async fillFieldBatch(page, profile, fields, motivationLetterContent, fillMode) {
        for (const field of fields) {
            await this.dismissFormOverlays(page);
            const value = this.fieldMapper.getValue(profile, field, motivationLetterContent);
            if (value === undefined || value === null || value === '') {
                if (field.required && field.mapsTo) {
                    throw new Error(`Missing required profile value: ${field.mapsTo}`);
                }
                if (field.required && !field.mapsTo) {
                    throw new Error(`Missing required static value for ${field.selector}` +
                        `${field.labelHint ? ` ("${field.labelHint}")` : ''}` +
                        ' — set field.options[0] or mapsTo in university schema.');
                }
                continue;
            }
            if (this.isCareerNameField(field)) {
                const ok = await this.fillTextNearLabel(page, /Current Employer/i, String(value));
                if (!ok && field.required) {
                    throw new Error(`Field not found near label "Current Employer" (${field.selector})`);
                }
                continue;
            }
            let locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
            if (!locator && fillMode === 'hybrid') {
                locator = await this.semanticFieldMapper.resolveLocator(page, field, profile, motivationLetterContent);
            }
            if (!locator && field.required && field.selector) {
                await page
                    .waitForSelector(field.selector, {
                    state: 'attached',
                    timeout: 10_000,
                })
                    .catch(() => undefined);
                locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
            }
            if (!locator) {
                if (field.required) {
                    const present = await page
                        .evaluate(() => [...document.querySelectorAll('input[name], select[name], textarea[name]')]
                        .map((el) => el.name)
                        .filter((name) => name.startsWith('apply') || name.startsWith('applyEx'))
                        .slice(0, 40)
                        .join(', '))
                        .catch(() => '');
                    throw new Error(`Field not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
                        ` (URL: ${page.url()}; apply* fields: [${present}])`);
                }
                continue;
            }
            await this.fillField(page, field, locator, value);
            if (this.isDateField(field)) {
                await this.closeDatePickers(page);
            }
        }
    }
    isDateField(field) {
        const key = `${field.selector || ''} ${field.labelHint || ''}`;
        return /date|borned|birth|expire|expiry|passportExpire/i.test(key);
    }
    isCareerNameField(field) {
        return (Boolean(field.selector?.includes('workplace')) ||
            Boolean(field.selector?.includes('careerName')) ||
            /current employer/i.test(field.labelHint || ''));
    }
    async fillTextNearLabel(page, labelRe, value) {
        return page.evaluate(({ labelSource, nextValue }) => {
            const labelReLocal = new RegExp(labelSource, 'i');
            const nodes = [
                ...document.querySelectorAll('td, th, label, div, span, li'),
            ];
            const labelEl = nodes.find((el) => {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                return (labelReLocal.test(t) &&
                    !/Highest Diploma/i.test(t) &&
                    t.length < 100);
            });
            if (!labelEl) {
                return false;
            }
            const row = labelEl.closest('tr') ||
                labelEl.closest('.form-group') ||
                labelEl.parentElement;
            const input = row?.querySelector('input[type="text"], input:not([type]), textarea');
            if (!input) {
                return false;
            }
            input.value = nextValue;
            input.setAttribute('value', nextValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            const jq = window.jQuery;
            if (typeof jq === 'function') {
                try {
                    jq(input).val(nextValue).trigger('input');
                    jq(input).val(nextValue).trigger('change');
                }
                catch {
                }
            }
            return input.value === nextValue;
        }, { labelSource: labelRe.source, nextValue: value });
    }
    async dismissFormOverlays(page) {
        await page.evaluate(() => {
            const isVisible = (el) => {
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return false;
                }
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            };
            for (const win of document.querySelectorAll('.messager-window, .panel.window')) {
                if (!isVisible(win)) {
                    continue;
                }
                const text = (win.textContent || '').replace(/\s+/g, ' ');
                if (/It'?s processing|请求正在处理中|processing your request/i.test(text)) {
                    continue;
                }
                const ok = [
                    ...win.querySelectorAll('input.okButton, input[value="Ok"], input[value="OK"], button, a.l-btn'),
                ].find((el) => /^(Ok|OK|确定)$/i.test((el.value || el.textContent || '').trim()));
                ok?.click();
            }
        });
        await this.closeDatePickers(page);
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
    async fillField(page, field, locator, value) {
        const normalizedValue = String(value);
        const valueForControl = field.type === 'text' || field.type === 'number'
            ? this.normalizeTextValue(field, normalizedValue)
            : normalizedValue;
        switch (field.type) {
            case 'select':
                await this.fillSelectControl(page, field, locator, this.applyValueMap(field, normalizedValue));
                break;
            case 'radio':
                await this.fillRadioControl(page, field, locator, normalizedValue);
                break;
            case 'checkbox':
                if (this.toBoolean(value)) {
                    await locator
                        .check({ force: true })
                        .catch(async () => locator.click({ force: true }));
                }
                break;
            case 'textarea':
            case 'essay':
            case 'number':
            case 'text':
                await this.fillTextControl(page, field, locator, valueForControl);
                break;
            case 'file':
                break;
        }
    }
    async fillRadioControl(page, field, locator, normalizedValue) {
        const selector = field.selector;
        if (selector) {
            const byValue = page
                .locator(`${selector}[value="${normalizedValue}"]`)
                .first();
            if ((await byValue.count()) > 0) {
                await byValue.check({ force: true });
                return;
            }
        }
        {
            const byRole = page
                .getByRole('radio', { name: normalizedValue, exact: false })
                .first();
            if ((await byRole.count()) > 0) {
                await byRole.check({ force: true }).catch(() => undefined);
                if (await byRole.isChecked().catch(() => false)) {
                    return;
                }
            }
        }
        if (selector) {
            const matched = await page.evaluate(({ sel, want }) => {
                const radios = [
                    ...document.querySelectorAll(sel),
                ];
                if (radios.length === 0) {
                    return false;
                }
                const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
                const wantN = norm(want);
                const labelOf = (radio) => {
                    if (radio.id) {
                        const forLab = document.querySelector(`label[for="${radio.id}"]`);
                        if (forLab?.textContent) {
                            return forLab.textContent;
                        }
                    }
                    const wrap = radio.closest('label');
                    if (wrap?.textContent) {
                        return wrap.textContent;
                    }
                    const parent = radio.parentElement;
                    if (parent) {
                        return parent.textContent || '';
                    }
                    let sib = radio.nextSibling;
                    let acc = '';
                    while (sib && acc.length < 40) {
                        if (sib.nodeType === Node.TEXT_NODE) {
                            acc += sib.textContent || '';
                        }
                        else if (sib.nodeType === Node.ELEMENT_NODE) {
                            const el = sib;
                            if (el.tagName === 'INPUT') {
                                break;
                            }
                            acc += el.textContent || '';
                        }
                        sib = sib.nextSibling;
                    }
                    return acc;
                };
                const match = radios.find((radio) => {
                    const lab = norm(labelOf(radio));
                    return (lab === wantN ||
                        lab.startsWith(wantN) ||
                        new RegExp(`\\b${wantN}\\b`, 'i').test(lab));
                });
                const aliases = {
                    no: ['0', 'n', 'no', 'false', '2'],
                    yes: ['1', 'y', 'yes', 'true'],
                    unmarried: ['1', 'unmarried', 'single'],
                    married: ['2', 'married'],
                    female: ['2', 'f', 'female'],
                    male: ['1', 'm', 'male'],
                };
                const byAlias = match ||
                    radios.find((radio) => (aliases[wantN] || []).includes(norm(radio.value)));
                const target = byAlias ||
                    (wantN === 'no' ? radios[radios.length - 1] : undefined);
                if (!target) {
                    return false;
                }
                target.checked = true;
                target.click();
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return target.checked;
            }, { sel: selector, want: normalizedValue });
            if (matched) {
                return;
            }
        }
        await locator
            .check({ force: true })
            .catch(async () => locator.click({ force: true }));
    }
    async fillSelectControl(page, field, locator, value) {
        const candidates = this.expandSelectCandidates(field, value);
        for (const candidate of candidates) {
            try {
                await locator.selectOption({ label: candidate }, { timeout: 2_000 });
                return;
            }
            catch {
                try {
                    await locator.selectOption(candidate, { timeout: 2_000 });
                    return;
                }
                catch {
                }
            }
        }
        if (!field.selector) {
            throw new Error(`Cannot fill hidden select without selector: ${value}`);
        }
        const ok = await page.evaluate(({ selector, values }) => {
            const sel = document.querySelector(selector);
            if (!sel) {
                return false;
            }
            const needle = values
                .map((v) => v.trim().toLowerCase())
                .filter(Boolean);
            const isPlaceholder = (text) => !text ||
                /please\s*(choose|select)/i.test(text) ||
                /^-+$/.test(text) ||
                /^\.\.\./.test(text);
            const scoreOption = (option) => {
                const text = option.text.replace(/\s+/g, ' ').trim().toLowerCase();
                const val = option.value.trim().toLowerCase();
                if (!val || isPlaceholder(text)) {
                    return 0;
                }
                let best = 0;
                for (const n of needle) {
                    if (text === n || val === n) {
                        best = Math.max(best, 3);
                    }
                    else if (text.startsWith(n) || n.startsWith(text)) {
                        best = Math.max(best, 2);
                    }
                    else if (text.includes(n) || (n.length >= 4 && text.length >= 4 && n.includes(text))) {
                        best = Math.max(best, 1);
                    }
                }
                return best;
            };
            let bestOpt = null;
            let bestScore = 0;
            for (const option of sel.options) {
                const score = scoreOption(option);
                if (score > bestScore) {
                    bestScore = score;
                    bestOpt = option;
                }
            }
            if (!bestOpt || !bestOpt.value || bestScore === 0) {
                return false;
            }
            sel.value = bestOpt.value;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            const jq = window.jQuery;
            if (typeof jq === 'function') {
                try {
                    jq(sel).val(bestOpt.value).trigger('chosen:updated');
                    jq(sel).val(bestOpt.value).trigger('change');
                    jq(sel).val(bestOpt.value).trigger('liszt:updated');
                }
                catch {
                }
            }
            return sel.value === bestOpt.value;
        }, { selector: field.selector, values: candidates });
        if (!ok) {
            throw new Error(`Failed to select "${value}"` +
                (value !== candidates[0] ? ` (tried: ${candidates.slice(0, 5).join(' | ')})` : '') +
                ` for ${field.selector}` +
                `${field.labelHint ? ` ("${field.labelHint}")` : ''}`);
        }
    }
    applyValueMap(field, value) {
        const trimmed = value.trim();
        if (!field.valueMap) {
            return trimmed;
        }
        if (field.valueMap[trimmed]) {
            return field.valueMap[trimmed];
        }
        const lower = trimmed.toLowerCase();
        for (const [from, to] of Object.entries(field.valueMap)) {
            if (from.trim().toLowerCase() === lower) {
                return to;
            }
        }
        return trimmed;
    }
    expandSelectCandidates(field, value) {
        const mapped = this.applyValueMap(field, value);
        const hint = [
            field.labelHint,
            field.selector,
            Array.isArray(field.mapsTo) ? field.mapsTo.join(' ') : field.mapsTo,
        ]
            .filter(Boolean)
            .join(' ');
        if (/gender|sex/i.test(hint)) {
            return [...new Set([this.normalizeSexLabel(mapped), mapped, value])];
        }
        if (/country|nationalit|nation|born|birth|region/i.test(hint)) {
            return this.expandCountryLabels(mapped);
        }
        if (/yydjzs|english.*certificate|certificate of english|language certificate/i.test(hint)) {
            const v = mapped.trim().toLowerCase();
            if (/native\s*(speaker|language|tongue)/i.test(v) || v === 'native') {
                return [...new Set(['Native Language', 'Native Speaker', mapped, value])];
            }
        }
        if (/native\s*speaker/i.test(mapped)) {
            return [...new Set(['Native Language', mapped, value])];
        }
        if (/educationId|education level|highest level of education/i.test(hint)) {
            return [
                ...new Set([
                    mapped,
                    value.trim(),
                    ...this.expandEducationLabels(mapped),
                    ...this.expandEducationLabels(value),
                ]),
            ];
        }
        return [...new Set([mapped, value.trim()].filter(Boolean))];
    }
    expandEducationLabels(value) {
        const v = value.trim().toLowerCase();
        if (/high\s*school|senior\s*high|secondary|диплом.*средн|средн(ее|яя).*образован/i.test(v)) {
            return ['Senior high', 'Senior High', 'High school'];
        }
        if (/bachelor|бакалавр|undergraduate/i.test(v)) {
            return ['Bachelor', "Bachelor's degree", 'Currently an Undergraduate'];
        }
        if (/master|магистр/i.test(v)) {
            return ['Master', "Master's degree", "Currently a Master's"];
        }
        if (/ph\.?\s*d|doctor|доктор|dr\.?/i.test(v)) {
            return ['Dr.', 'PhD', 'Doctorate'];
        }
        if (/vocational|колледж|техникум/i.test(v)) {
            return ['Vocational College', 'Technical secondary'];
        }
        return [];
    }
    expandCountryLabels(value) {
        const v = value.trim().toLowerCase();
        const groups = [
            {
                keys: [
                    'russian federation',
                    'russia',
                    'russian',
                    'rf',
                    'россия',
                    'российская федерация',
                    'русский',
                ],
                labels: [
                    'Russian Federation',
                    'Russia',
                    'Russian',
                    'RF',
                    'Россия',
                    'Российская Федерация',
                ],
            },
            {
                keys: ['united states of america', 'united states', 'usa', 'us', 'america'],
                labels: ['United States of America', 'United States', 'USA', 'US', 'America'],
            },
            {
                keys: ['united kingdom', 'uk', 'great britain', 'britain', 'england'],
                labels: ['United Kingdom', 'UK', 'Great Britain', 'Britain', 'England'],
            },
            {
                keys: ['china', "people's republic of china", 'prc', '中国', '中华人民共和国'],
                labels: ['China', "People's Republic of China", 'PRC', '中国', '中华人民共和国'],
            },
            {
                keys: ['korea, republic of', 'south korea', 'republic of korea', 'korea'],
                labels: ['Korea, Republic of', 'South Korea', 'Republic of Korea', 'Korea'],
            },
            {
                keys: [
                    "korea, democratic people's republic of",
                    'north korea',
                    'dprk',
                ],
                labels: [
                    "Korea, Democratic People's Republic of",
                    'North Korea',
                    'DPRK',
                ],
            },
        ];
        const matched = groups.find((group) => group.keys.some((key) => {
            if (key === v) {
                return true;
            }
            if (v.length >= 3 && key.startsWith(v)) {
                return true;
            }
            if (key.length >= 4 && v.startsWith(key)) {
                return true;
            }
            return false;
        }));
        return [...new Set([...(matched?.labels ?? []), value].filter(Boolean))];
    }
    normalizeSexLabel(value) {
        const v = value.trim().toLowerCase();
        if (['f', 'female', 'woman', 'ж', 'жен', 'женский', 'female'].includes(v)) {
            return 'Female';
        }
        if (['m', 'male', 'man', 'м', 'муж', 'мужской'].includes(v)) {
            return 'Male';
        }
        return value;
    }
    async fillTextControl(page, field, locator, value) {
        await locator.scrollIntoViewIfNeeded().catch(() => undefined);
        if (this.isDateField(field) && field.selector) {
            const ok = await this.setInputValueJs(page, field.selector, value);
            await this.closeDatePickers(page);
            if (ok) {
                return;
            }
        }
        const visible = await locator.isVisible().catch(() => false);
        if (visible) {
            try {
                await locator.fill(value, { timeout: 5_000 });
                if (this.isDateField(field)) {
                    await this.closeDatePickers(page);
                }
                return;
            }
            catch {
            }
        }
        try {
            await locator.fill(value, { force: true, timeout: 5_000 });
            if (this.isDateField(field)) {
                await this.closeDatePickers(page);
            }
            return;
        }
        catch {
        }
        if (!field.selector) {
            throw new Error(`Cannot fill hidden field without selector: ${value}`);
        }
        const ok = await this.setInputValueJs(page, field.selector, value);
        await this.closeDatePickers(page);
        if (!ok) {
            throw new Error(`Failed to fill ${field.selector}${field.labelHint ? ` ("${field.labelHint}")` : ''} via JS fallback`);
        }
    }
    async setInputValueJs(page, selector, value) {
        return page.evaluate(({ sel, nextValue }) => {
            const el = document.querySelector(sel);
            if (!el) {
                return false;
            }
            el.value = nextValue;
            el.setAttribute('value', nextValue);
            const jq = window.jQuery;
            if (typeof jq === 'function') {
                try {
                    jq(el).val(nextValue).trigger('input');
                    jq(el).val(nextValue).trigger('change');
                    jq(el).val(nextValue).trigger('blur');
                }
                catch {
                }
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            el.blur();
            return true;
        }, { sel: selector, nextValue: value });
    }
    normalizeTextValue(field, value) {
        const key = `${field.selector || ''} ${field.labelHint || ''}`.toLowerCase();
        if (/phone|mobile|tel/.test(key)) {
            return this.normalizePhone(value);
        }
        if (/email/.test(key) && !value.includes('@')) {
            return 'applicant@example.com';
        }
        if (/date|borned|birth|expire|expiry|passportExpire/i.test(key) ||
            /Date|Expire|Birth/.test(field.labelHint || '')) {
            return this.normalizeDateValue(value);
        }
        return value;
    }
    normalizeDateValue(value) {
        const trimmed = value.trim();
        const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
        if (iso) {
            return iso[1];
        }
        const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (dmy) {
            const [, d, m, y] = dmy;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return trimmed;
    }
    async ensureChineseNameWaiver(page, profile) {
        const hasChinese = Boolean(profile.personal.chineseName?.trim());
        if (hasChinese) {
            return;
        }
        await page.evaluate(() => {
            const input = document.querySelector('input[name="apply.name"]');
            if (!input) {
                return;
            }
            input.value = '';
            input.setAttribute('value', '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
        });
        const checkbox = page
            .locator('input[type="checkbox"][name="noName"]')
            .first();
        if ((await checkbox.count()) > 0) {
            const checked = await checkbox.isChecked().catch(() => false);
            if (!checked) {
                await checkbox.check({ force: true }).catch(async () => {
                    await checkbox.click({ force: true });
                });
            }
            return;
        }
        const label = page.getByText(/not have a Chinese name yet/i).first();
        if ((await label.count()) > 0) {
            await label.click({ force: true }).catch(() => undefined);
        }
    }
    async ensurePkuStep1RequiredGaps(page) {
        await this.dismissFormOverlays(page);
        await this.checkRadioNearLabel(page, /Marital Status/i, 'Unmarried');
        await page
            .locator('input[type="radio"][name="apply.marryStatus"]')
            .evaluateAll((nodes) => {
            const radios = nodes;
            const unmarried = radios.find((r) => /unmarried|single/i.test((r.closest('label')?.textContent ||
                r.parentElement?.textContent ||
                '') +
                ' ' +
                (r.nextSibling?.textContent || ''))) ||
                radios.find((r) => r.value === '1') ||
                radios[0];
            if (!unmarried) {
                return;
            }
            unmarried.checked = true;
            unmarried.click();
            unmarried.dispatchEvent(new Event('change', { bubbles: true }));
        })
            .catch(() => undefined);
        await this.checkRadioGroupNo(page, 'apply.isOversea');
        await this.checkRadioGroupNo(page, 'applyEx.inChinaOnApply');
        await page.evaluate(() => {
            const EMPLOYER = 'High school graduate, no employer';
            const lastSchool = document.querySelector('input[name="applyEx.lastSchool"]');
            if (lastSchool?.value && /high school graduate/i.test(lastSchool.value)) {
                lastSchool.value = lastSchool.value
                    .replace(/\s*High school graduate, no employer\s*/gi, '')
                    .trim();
                if (!lastSchool.value) {
                    lastSchool.value = 'currently not studying';
                }
                lastSchool.setAttribute('value', lastSchool.value);
                lastSchool.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const setInput = (input, value) => {
                input.value = value;
                input.setAttribute('value', value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                const jq = window.jQuery;
                if (typeof jq === 'function') {
                    try {
                        jq(input).val(value).trigger('input');
                        jq(input).val(value).trigger('change');
                    }
                    catch {
                    }
                }
            };
            const nameCandidates = [
                'apply.workplace',
                'apply.careerName',
                'applyEx.careerName',
                'apply.company',
                'apply.companyName',
                'apply.workUnit',
                'apply.employer',
                'applyEx.employer',
            ];
            for (const name of nameCandidates) {
                const input = document.querySelector(`input[name="${name}"]`);
                if (input && !input.value?.trim()) {
                    setInput(input, EMPLOYER);
                    return;
                }
                if (input?.value?.trim()) {
                    return;
                }
            }
            const nodes = [
                ...document.querySelectorAll('td, th, label, div, span, li'),
            ];
            const labelEl = nodes.find((el) => {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                return (/Current Employer/i.test(t) &&
                    !/Highest Diploma/i.test(t) &&
                    t.length < 80);
            });
            if (!labelEl) {
                return;
            }
            const row = labelEl.closest('tr') ||
                labelEl.closest('.form-group') ||
                labelEl.parentElement;
            const input = row?.querySelector('input[type="text"], input:not([type]), input[type="search"]');
            if (input && !input.value?.trim()) {
                setInput(input, EMPLOYER);
            }
        });
        await this.checkRadioNearLabel(page, /Ethnic Chinese/i, 'No');
        await this.checkRadioNearLabel(page, /Whether in Chinese mainland|in Chinese mainland now/i, 'No');
        const passportCandidates = [
            'Ordinary Passport',
            'Ordinary',
            'Private Passport',
            'Private',
        ];
        let passportTypeOk = await this.selectNearLabel(page, /Passport Type/i, passportCandidates);
        if (!passportTypeOk) {
            const byLabel = page.getByLabel(/Passport Type/i).first();
            if ((await byLabel.count()) > 0) {
                for (const cand of passportCandidates) {
                    try {
                        await byLabel.selectOption({ label: cand });
                        passportTypeOk = true;
                        break;
                    }
                    catch {
                    }
                }
            }
        }
        if (!passportTypeOk) {
            passportTypeOk = await page.evaluate((needles) => {
                const setSelect = (select, value) => {
                    select.value = value;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    const jq = window.jQuery;
                    if (typeof jq === 'function') {
                        try {
                            jq(select).val(value).trigger('chosen:updated');
                            jq(select).val(value).trigger('change');
                            jq(select).val(value).trigger('liszt:updated');
                        }
                        catch {
                        }
                    }
                };
                for (const sel of document.querySelectorAll('select')) {
                    const select = sel;
                    const texts = [...select.options].map((o) => (o.textContent || '').trim().toLowerCase());
                    const looksLikePassportType = texts.some((t) => /ordinary passport|diplomatic passport|service passport|private passport|公务护照|普通护照|外交护照/.test(t));
                    if (!looksLikePassportType) {
                        continue;
                    }
                    const match = [...select.options].find((opt) => {
                        const t = (opt.textContent || '').trim().toLowerCase();
                        return needles.some((n) => t === n || t.includes(n) || n.includes(t));
                    });
                    if (!match?.value) {
                        continue;
                    }
                    setSelect(select, match.value);
                    return select.value === match.value;
                }
                return false;
            }, passportCandidates.map((c) => c.toLowerCase()));
        }
        await this.dismissFormOverlays(page);
    }
    isPkuLike(university) {
        return (university.id === 'pku' ||
            Boolean(university.navigationHints?.ocrPassportUpload) ||
            /pku\.17gz\.org/i.test(university.formUrl || ''));
    }
    async ensurePkuStep2RequiredGaps(page, profile) {
        await this.dismissFormOverlays(page);
        await this.closeDatePickers(page);
        const area = profile.applicationTargets?.[0]?.major?.trim() ||
            profile.education?.[0]?.major?.trim() ||
            'Molecular Medicine';
        const rec1Name = profile.guarantor?.name?.trim() ||
            [profile.personal.surname, profile.personal.givenName]
                .filter(Boolean)
                .join(' ')
                .trim() ||
            'Recommender';
        const rec1Phone = profile.guarantor?.phone?.trim() ||
            profile.personal.phone ||
            '13800000000';
        const rec1Email = profile.guarantor?.email?.trim() ||
            profile.personal.email ||
            'recommender@example.com';
        const rec2Name = profile.emergencyContact?.name?.trim() || rec1Name;
        const rec2Phone = profile.emergencyContact?.phone?.trim() || rec1Phone;
        const rec2Email = profile.emergencyContact?.email?.trim() || rec1Email;
        const rec2Relation = profile.emergencyContact?.relationship?.trim() ||
            profile.guarantor?.relationship?.trim() ||
            'Father';
        const rec2Work = profile.emergencyContact?.company?.trim() ||
            profile.guarantor?.company?.trim() ||
            'N/A';
        const fills = [
            ['apply.fieldEnglish', area],
            ['apply.fieldName', area],
            ['apply.studyStartDate', '2026-09-01'],
            ['apply.studyEndDate', '2027-06-30'],
            ['apply.advisorEn', 'To be assigned'],
            ['apply.advisor', '待定'],
            ['apply.advisorConnect', 'N/A'],
            ['apply.yydjzsScore', 'N/A'],
            ['apply.yydjzsIssueDate', '2020-01-01'],
            [
                'apply.guarRelation',
                profile.guarantor?.relationship?.trim() || 'Mother',
            ],
            ['apply.guarWorkplace', profile.guarantor?.company?.trim() || 'N/A'],
            ['apply.guarantorEnname', rec1Name],
            ['apply.guarPhone', rec1Phone],
            ['apply.guarMobile', rec1Phone],
            ['apply.guarEmail', rec1Email],
            ['apply.guarSecEnname', rec2Name],
            ['apply.guarSecRelative', rec2Relation],
            ['apply.guarSecWork', rec2Work],
            ['apply.guarMobile2', rec2Phone],
            ['apply.guarSecPhone', rec2Phone],
            ['apply.guarSecEmail', rec2Email],
            [
                'apply.guarAddress2',
                profile.emergencyContact?.homeAddress?.trim() ||
                    profile.guarantor?.homeAddress?.trim() ||
                    profile.personal.permanentAddress ||
                    'N/A',
            ],
        ];
        const writeResult = await page.evaluate((rows) => {
            const report = {};
            const jq = window.jQuery;
            for (const [name, value] of rows) {
                const el = document.querySelector(`input[name="${name}"]`);
                if (!el) {
                    report[name] = 'MISSING';
                    continue;
                }
                el.focus();
                el.value = value;
                el.setAttribute('value', value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                if (typeof jq === 'function') {
                    try {
                        jq(el).val(value).trigger('input');
                        jq(el).val(value).trigger('change');
                        jq(el).val(value).trigger('blur');
                    }
                    catch {
                    }
                }
                report[name] = el.value?.trim() ? 'OK' : 'EMPTY_AFTER_SET';
            }
            return report;
        }, fills);
        for (const [name, value] of fills) {
            if (writeResult[name] === 'OK') {
                continue;
            }
            const loc = page.locator(`input[name="${name}"]`).first();
            if ((await loc.count()) === 0) {
                continue;
            }
            await loc.scrollIntoViewIfNeeded().catch(() => undefined);
            await loc
                .fill(value, { force: true, timeout: 5_000 })
                .catch(async () => {
                await this.setInputValueJs(page, `input[name="${name}"]`, value);
            });
        }
        const nationality = profile.guarantor?.nationality ||
            profile.personal.nationality ||
            'Russian Federation';
        const nationality2 = profile.emergencyContact?.nationality || nationality;
        for (const [sel, nat] of [
            ['select[name="apply.guarCountryId"]', nationality],
            ['select[name="apply.guarCountryId2"]', nationality2],
        ]) {
            await this.fillSelectControl(page, {
                selector: sel,
                type: 'select',
                required: false,
                mapsTo: null,
                labelHint: 'Nationality',
            }, page.locator(sel).first(), nat).catch(() => undefined);
        }
        await this.closeDatePickers(page);
        await this.dismissFormOverlays(page);
    }
    async assertPkuStep2CriticalFilled(page, profile) {
        const critical = [
            'apply.yydjzsScore',
            'apply.yydjzsIssueDate',
            'apply.guarSecEnname',
            'apply.guarSecRelative',
            'apply.guarSecWork',
            'apply.guarSecPhone',
            'apply.guarSecEmail',
        ];
        const empty = await page.evaluate((names) => {
            return names.filter((name) => {
                const el = document.querySelector(`input[name="${name}"]`);
                return !el || !el.value?.trim();
            });
        }, critical);
        if (empty.length === 0) {
            return;
        }
        await this.ensurePkuStep2RequiredGaps(page, profile);
        const stillEmpty = await page.evaluate((names) => {
            const present = [
                ...document.querySelectorAll('input[name^="apply.guar"]'),
            ].map((el) => el.name);
            return {
                empty: names.filter((name) => {
                    const el = document.querySelector(`input[name="${name}"]`);
                    return !el || !el.value?.trim();
                }),
                presentGuar: present.slice(0, 40),
            };
        }, critical);
        if (stillEmpty.empty.length > 0) {
            throw new Error(`PKU Step2 critical fields still empty after force-fill: [${stillEmpty.empty.join(', ')}]. ` +
                `Present apply.guar* names: [${stillEmpty.presentGuar.join(', ')}]`);
        }
    }
    async checkRadioGroupNo(page, name) {
        const group = page.locator(`input[type="radio"][name="${name}"]`);
        if ((await group.count()) === 0) {
            return;
        }
        const byLabel = page
            .locator(`label:has(input[type="radio"][name="${name}"])`)
            .filter({ hasText: /^No$/i })
            .first();
        if ((await byLabel.count()) > 0) {
            await byLabel.click({ force: true }).catch(() => undefined);
            return;
        }
        const noRadio = page
            .locator(`input[type="radio"][name="${name}"][value="0"], input[type="radio"][name="${name}"][value="N"], input[type="radio"][name="${name}"][value="No"]`)
            .first();
        if ((await noRadio.count()) > 0) {
            await noRadio.check({ force: true }).catch(() => undefined);
            return;
        }
        const second = group.nth(1);
        if ((await second.count()) > 0) {
            await second.check({ force: true }).catch(() => undefined);
        }
    }
    async checkRadioNearLabel(page, labelRe, choice) {
        const done = await page.evaluate(({ labelSource, choiceText }) => {
            const labelReLocal = new RegExp(labelSource, 'i');
            const nodes = [
                ...document.querySelectorAll('td, th, label, div, span, li'),
            ];
            const labelEl = nodes.find((el) => {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                return labelReLocal.test(t) && t.length < 80;
            });
            if (!labelEl) {
                return false;
            }
            const row = labelEl.closest('tr') ||
                labelEl.closest('.form-group') ||
                labelEl.parentElement;
            if (!row) {
                return false;
            }
            const radios = [
                ...row.querySelectorAll('input[type="radio"]'),
            ];
            if (radios.length === 0) {
                return false;
            }
            const norm = (s) => s.replace(/\s+/g, ' ').trim();
            const want = norm(choiceText).toLowerCase();
            const labelOf = (radio) => {
                if (radio.id) {
                    const forLab = document.querySelector(`label[for="${radio.id}"]`);
                    if (forLab?.textContent) {
                        return forLab.textContent;
                    }
                }
                const wrap = radio.closest('label');
                if (wrap) {
                    return wrap.textContent || '';
                }
                let sib = radio.nextSibling;
                let acc = '';
                while (sib && acc.length < 48) {
                    if (sib.nodeType === Node.TEXT_NODE) {
                        acc += sib.textContent || '';
                    }
                    else if (sib.nodeType === Node.ELEMENT_NODE) {
                        const el = sib;
                        if (el.tagName === 'INPUT') {
                            break;
                        }
                        acc += el.textContent || '';
                    }
                    sib = sib.nextSibling;
                }
                return acc || radio.parentElement?.textContent || radio.value || '';
            };
            const match = radios.find((radio) => {
                const lab = norm(labelOf(radio)).toLowerCase();
                return (lab === want ||
                    lab.startsWith(want) ||
                    new RegExp(`\\b${want}\\b`, 'i').test(lab));
            });
            const target = match ||
                (want === 'no'
                    ? radios.find((r) => r.value === '0') || radios[radios.length - 1]
                    : want === 'yes'
                        ? radios.find((r) => r.value === '1') || radios[0]
                        : want === 'unmarried'
                            ? radios.find((r) => r.value === '1') || radios[0]
                            : radios[0]);
            if (!target) {
                return false;
            }
            target.checked = true;
            target.click();
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }, { labelSource: labelRe.source, choiceText: choice });
        void done;
    }
    async selectNearLabel(page, labelRe, candidates) {
        return page.evaluate(({ labelSource, values }) => {
            const labelReLocal = new RegExp(labelSource, 'i');
            const nodes = [
                ...document.querySelectorAll('td, th, label, div, span, li'),
            ];
            const labelEl = nodes.find((el) => {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                return labelReLocal.test(t) && t.length < 80;
            });
            if (!labelEl) {
                return false;
            }
            const row = labelEl.closest('tr') ||
                labelEl.closest('.form-group') ||
                labelEl.parentElement;
            const select = row?.querySelector('select') ||
                labelEl.parentElement?.querySelector('select');
            if (!select) {
                return false;
            }
            const needles = values.map((v) => v.toLowerCase());
            const opt = [...select.options].find((option) => {
                const text = (option.textContent || '').trim().toLowerCase();
                return needles.some((n) => text === n || text.includes(n) || n.includes(text));
            });
            if (!opt?.value) {
                return false;
            }
            select.value = opt.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const jq = window.jQuery;
            if (typeof jq === 'function') {
                try {
                    jq(select).val(opt.value).trigger('chosen:updated');
                    jq(select).val(opt.value).trigger('change');
                    jq(select).val(opt.value).trigger('liszt:updated');
                }
                catch {
                }
            }
            return select.value === opt.value;
        }, { labelSource: labelRe.source, values: candidates });
    }
    normalizePhone(value) {
        const digits = value.replace(/\D/g, '');
        if (/^1\d{10}$/.test(digits)) {
            return digits;
        }
        if (digits.length >= 11) {
            const last11 = digits.slice(-11);
            if (/^1\d{10}$/.test(last11)) {
                return last11;
            }
        }
        return '13800138000';
    }
    toBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
    }
};
exports.FormFiller = FormFiller;
exports.FormFiller = FormFiller = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        field_mapper_js_1.FieldMapper,
        file_attacher_js_1.FileAttacher,
        ocr_passport_uploader_js_1.OcrPassportUploader,
        wizard_navigator_js_1.WizardNavigator,
        wizard_field_groups_js_1.WizardFieldGroups,
        semantic_field_mapper_js_1.SemanticFieldMapper,
        form_agent_js_1.FormAgent])
], FormFiller);
//# sourceMappingURL=form.filler.js.map