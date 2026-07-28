"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForUiReady = waitForUiReady;
exports.dismissBlockingDialogs = dismissBlockingDialogs;
exports.detectPreWizardScreen = detectPreWizardScreen;
exports.isMainWizard = isMainWizard;
exports.fillPreWizardScreen = fillPreWizardScreen;
exports.advancePreWizardScreen = advancePreWizardScreen;
exports.clearStuckProcessing = clearStuckProcessing;
exports.advanceThroughPreWizard = advanceThroughPreWizard;
exports.describeNavigationState = describeNavigationState;
function normalizeHints(hints) {
    if (!hints) {
        return {};
    }
    if (typeof hints === 'string') {
        const value = hints.trim();
        return value
            ? { programText: value, studyPlanHint: value }
            : {};
    }
    return hints;
}
async function waitForUiReady(page) {
    await dismissBlockingDialogs(page);
    await page
        .waitForFunction(() => {
        const wins = [
            ...document.querySelectorAll('.messager-window, .panel.window, .window-mask, .datagrid-mask, .el-loading-mask'),
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
            return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(win.textContent || '');
        });
        return !visibleProcessing;
    }, { timeout: 12_000 })
        .catch(() => undefined);
    await page.waitForTimeout(150);
}
async function dismissBlockingDialogs(page) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const isProcessing = await page
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
                return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(win.textContent || '');
            });
        })
            .catch(() => false);
        if (isProcessing) {
            break;
        }
        const okButton = page
            .locator([
            'input.okButton',
            'input[value="Ok"]',
            'input[value="OK"]',
            '.messager-button .okButton',
            '.messager-button input[value="Ok"]',
            '.messager-button input[value="OK"]',
            '.messager-button a',
            '.messager-window input.okButton',
            'button:has-text("OK")',
            'button:has-text("Ok")',
            'button:has-text("Continue")',
            'button:has-text("Accept")',
            'button:has-text("确定")',
        ].join(', '))
            .first();
        if ((await okButton.count()) === 0) {
            break;
        }
        if (!(await okButton.isVisible().catch(() => false))) {
            break;
        }
        await okButton.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(300);
    }
    await page
        .evaluate(() => {
        const wins = [
            ...document.querySelectorAll('.window-mask, .datagrid-mask, .messager-window, .panel.window, .window-shadow, .el-loading-mask'),
        ];
        const stuck = wins.some((win) => {
            const style = getComputedStyle(win);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = win.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                return false;
            }
            return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(win.textContent || '');
        });
        if (!stuck) {
            return;
        }
        for (const el of wins) {
            el.style.display = 'none';
        }
    })
        .catch(() => undefined);
}
async function detectPreWizardScreen(page) {
    if ((await page.locator('select[name="collegeId"]').count()) > 0) {
        return 'program_selection';
    }
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/please choose your type\s*:/i.test(bodyText) ||
        /请选择招生类别|请选择.*类别|请选择学生|报考类别/.test(bodyText)) {
        return 'student_type';
    }
    if (/please choose your program/i.test(bodyText) ||
        /请选择.*项目|请选择培养项目|请选择招生项目/.test(bodyText)) {
        return 'program_type';
    }
    const programRadios = page.locator('input[type="radio"][name="projectTypeId"]');
    const programCount = await programRadios.count();
    let visibleProgram = 0;
    for (let i = 0; i < programCount; i += 1) {
        if (await programRadios.nth(i).isVisible().catch(() => false)) {
            visibleProgram += 1;
        }
    }
    if (visibleProgram >= 5) {
        return 'student_type';
    }
    if (visibleProgram > 0) {
        return 'program_type';
    }
    const anyRadios = page.locator('input[type="radio"]');
    const anyCount = await anyRadios.count();
    for (let i = 0; i < anyCount; i += 1) {
        const radio = anyRadios.nth(i);
        if (!(await radio.isVisible().catch(() => false))) {
            continue;
        }
        const name = await radio.getAttribute('name').catch(() => null);
        if (name !== 'projectTypeId') {
            return 'student_type';
        }
    }
    if (/application notes|application instructions|申请须知|申请人保证/i.test(bodyText)) {
        return 'application_notes';
    }
    return null;
}
async function isMainWizard(page) {
    const selectors = [
        'input[name="apply.lastName"]',
        'input[name="apply.givenName"]',
        'input[name="apply.passportNo"]',
    ];
    for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if ((await locator.count()) === 0) {
            continue;
        }
        if (await locator.isVisible().catch(() => false)) {
            return true;
        }
    }
    return false;
}
async function getPreWizardSignature(page, screen) {
    const names = await page.evaluate(() => [...document.querySelectorAll('input[name], select[name], textarea[name]')]
        .filter((el) => {
        const type = el.type?.toLowerCase?.() ?? '';
        return type !== 'hidden' && type !== 'button' && type !== 'submit';
    })
        .map((el) => el.name)
        .filter(Boolean)
        .sort()
        .slice(0, 8)
        .join('|'));
    return `pre:${screen ?? 'unknown'}:${names}`;
}
async function pickProjectTypeRadio(page, programHint) {
    await dismissBlockingDialogs(page);
    const radios = page.locator('input[type="radio"][name="projectTypeId"]');
    const count = await radios.count();
    if (count === 0) {
        return false;
    }
    let index = 0;
    if (programHint) {
        const needle = programHint.toLowerCase();
        for (let i = 0; i < count; i += 1) {
            const radio = radios.nth(i);
            const labelText = await radio.evaluate((el) => {
                const input = el;
                return (input.closest('label')?.textContent ??
                    input.closest('.el-radio')?.textContent ??
                    input.parentElement?.textContent ??
                    '').trim();
            });
            if (labelText.toLowerCase().includes(needle)) {
                index = i;
                break;
            }
        }
    }
    const target = radios.nth(index);
    const value = await target.getAttribute('value');
    await target.check({ force: true }).catch(() => undefined);
    if (await target.isChecked().catch(() => false)) {
        return true;
    }
    if (programHint) {
        const byText = page
            .getByText(new RegExp(programHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
            .first();
        if ((await byText.count()) > 0) {
            await byText.click({ force: true }).catch(() => undefined);
            if (await target.isChecked().catch(() => false)) {
                return true;
            }
        }
    }
    const clicked = await page.evaluate((hint) => {
        const list = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ];
        if (list.length === 0) {
            return false;
        }
        const labelOf = (radio) => (radio.closest('label')?.textContent ??
            radio.closest('.el-radio')?.textContent ??
            radio.parentElement?.textContent ??
            '').trim();
        let targetRadio = hint
            ? list.find((radio) => labelOf(radio).toLowerCase().includes(hint.toLowerCase()))
            : undefined;
        targetRadio ??=
            list.find((radio) => radio.value && radio.value !== '0') ?? list[0];
        if (!targetRadio) {
            return false;
        }
        const elLabel = targetRadio
            .closest('.el-radio')
            ?.querySelector('.el-radio__label');
        elLabel?.click();
        if (targetRadio.checked) {
            return true;
        }
        targetRadio.closest('label')?.click();
        if (targetRadio.checked) {
            return true;
        }
        if (targetRadio.id) {
            document
                .querySelector(`label[for="${CSS.escape(targetRadio.id)}"]`)
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        return targetRadio.checked;
    }, programHint ?? null);
    if (clicked || (await target.isChecked().catch(() => false))) {
        return true;
    }
    await page.evaluate((selectedValue) => {
        for (const radio of document.querySelectorAll('input[name="projectTypeId"]')) {
            radio.checked = radio.value === selectedValue;
        }
    }, value);
    return target.isChecked().catch(() => false);
}
async function checkAgree(page) {
    const agree = page.locator('[name="agree"]');
    if ((await agree.count()) === 0) {
        return;
    }
    const checked = await agree.isChecked().catch(() => false);
    if (!checked) {
        await agree.click({ force: true }).catch(() => undefined);
    }
}
async function setHiddenSelectByName(page, name, optionIndex = 1) {
    return page.evaluate(({ fieldName, index }) => {
        const sel = document.querySelector(`select[name="${fieldName}"]`);
        if (!sel || sel.options.length <= index) {
            return null;
        }
        const option = sel.options[index];
        if (!option || (index > 0 && !option.value)) {
            return null;
        }
        sel.value = option.value;
        const jq = window.jQuery;
        if (typeof jq === 'function') {
            try {
                jq(sel).val(option.value).trigger('chosen:updated');
                jq(sel).val(option.value).trigger('change');
            }
            catch {
            }
        }
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        const stepCollege = window.stepCollegeOnChange;
        if (fieldName === 'collegeId' && typeof stepCollege === 'function' && sel.form) {
            stepCollege(sel.form, sel.form.querySelector('select[name="majorId"]'));
        }
        const onchangeAttr = sel.getAttribute('onchange');
        if (onchangeAttr && fieldName !== 'collegeId') {
            try {
                const run = new Function('event', onchangeAttr);
                run.call(sel, new Event('change', { bubbles: true }));
            }
            catch {
            }
        }
        return option.value;
    }, { fieldName: name, index: optionIndex });
}
async function clearStudyPlanFilters(page) {
    for (const name of ['collegeId', 'majorId', 'teachLanguage']) {
        await setHiddenSelectByName(page, name, 0);
    }
    await page
        .locator('input[name="researchArea"], input[name="research"], input[name*="research" i]')
        .first()
        .fill('')
        .catch(() => undefined);
}
async function clickStudyPlanFind(page) {
    const find = page
        .locator([
        'input[type="button"][value="Find"]',
        'input[type="submit"][value="Find"]',
        'input[value="查询"]',
        'button:has-text("Find")',
        'button:has-text("查询")',
        'a:has-text("Find")',
    ].join(', '))
        .first();
    if ((await find.count()) === 0) {
        return false;
    }
    if (!(await find.isVisible().catch(() => false))) {
        return false;
    }
    await find.click({ force: true });
    await page.waitForTimeout(1200);
    await waitForUiReady(page);
    return true;
}
async function fillProgramSelection(page) {
    const rows = await collectStudyPlanRows(page);
    if (rows.length > 0 && !(await isProgramSelectionEmpty(page))) {
        return;
    }
    await clearStudyPlanFilters(page);
    await clickStudyPlanFind(page);
}
async function isProgramSelectionEmpty(page) {
    return page.evaluate(() => /Total:\s*0/i.test(document.body?.innerText ?? ''));
}
async function expandStudyPlanPageSize(page) {
    const changed = await page.evaluate(() => {
        const selects = [
            ...document.querySelectorAll('select'),
        ];
        const perPage = selects.find((sel) => {
            const opts = [...sel.options].map((o) => o.text.trim());
            const nearLabel = sel.closest('td, div, span, label')?.textContent?.toLowerCase() || '';
            return (/per\s*page|page\s*size|条/i.test(nearLabel) ||
                opts.includes('20') ||
                opts.includes('50') ||
                opts.includes('100'));
        });
        if (!perPage) {
            return false;
        }
        const preferred = ['100', '50', '30', '20'].find((v) => [...perPage.options].some((o) => o.value === v || o.text.trim() === v));
        if (!preferred || perPage.value === preferred) {
            return false;
        }
        perPage.value = preferred;
        perPage.dispatchEvent(new Event('change', { bubbles: true }));
        const jq = window.jQuery;
        if (typeof jq === 'function') {
            try {
                jq(perPage).val(preferred).trigger('change');
            }
            catch {
            }
        }
        return true;
    });
    if (changed) {
        await page.waitForTimeout(1500);
    }
}
async function collectStudyPlanRows(page) {
    return page.evaluate(() => {
        const labelOf = (el) => (el.value || el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
        const isApplyLink = (el) => {
            const onclick = el.getAttribute('onclick') || '';
            const href = el.getAttribute('href') || '';
            return (/saveChoose|StudyPlan|ChooseProject|choose/i.test(onclick) ||
                /^(Apply|申请|选择|Select)$/i.test(labelOf(el)) ||
                /apply/i.test(href));
        };
        const rows = [];
        const trs = [...document.querySelectorAll('tr')];
        for (const tr of trs) {
            const link = [...tr.querySelectorAll('a, input[type="button"]')].find(isApplyLink);
            if (!link) {
                continue;
            }
            const text = (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
            if (!text || /study plan name|department|application deadline/i.test(text)) {
                continue;
            }
            rows.push({ index: rows.length, text });
        }
        return rows;
    });
}
async function clickStudyPlanRowByIndex(page, rowIndex) {
    return page.evaluate((index) => {
        const labelOf = (el) => (el.value || el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
        const isApplyLink = (el) => {
            const onclick = el.getAttribute('onclick') || '';
            const href = el.getAttribute('href') || '';
            return (/saveChoose|StudyPlan|ChooseProject|choose/i.test(onclick) ||
                /^(Apply|申请|选择|Select)$/i.test(labelOf(el)) ||
                /apply/i.test(href));
        };
        const applyRows = [...document.querySelectorAll('tr')].filter((tr) => [...tr.querySelectorAll('a, input[type="button"]')].some(isApplyLink));
        const tr = applyRows[index];
        if (!tr) {
            return null;
        }
        const link = [...tr.querySelectorAll('a, input[type="button"]')].find(isApplyLink);
        if (!link) {
            return null;
        }
        link.scrollIntoView({ block: 'center', inline: 'nearest' });
        link.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
        const onclick = link.getAttribute('onclick') || '';
        return `Apply:row${index}:${onclick.slice(0, 48)}`;
    }, rowIndex);
}
function scoreStudyPlanRow(text, hint) {
    const hay = text.toLowerCase();
    const needles = hint
        .toLowerCase()
        .split(/[\s,/|;]+/)
        .map((n) => n.trim())
        .filter((n) => n.length >= 3);
    let score = 0;
    for (const n of needles) {
        if (hay.includes(n)) {
            score += n.length >= 6 ? 3 : 2;
        }
    }
    if (hay.includes(hint.toLowerCase())) {
        score += 10;
    }
    return score;
}
async function selectStudyPlanRow(page, programHint, gemini) {
    const APPLY_LINK_SELECTOR = [
        'a[onclick*="saveChooseProjectBind"]',
        'a[onclick*="StudyPlan"]',
        'a[onclick*="choose"]',
        'a[onclick*="ChooseProject"]',
        'a[onclick*="saveChoose"]',
        'td a',
    ].join(', ');
    for (let attempt = 0; attempt < 4; attempt += 1) {
        await page
            .waitForSelector(APPLY_LINK_SELECTOR, {
            state: 'attached',
            timeout: 10_000,
        })
            .catch(() => undefined);
        await page.waitForTimeout(attempt === 0 ? 500 : 1200);
        if (attempt === 0) {
            await expandStudyPlanPageSize(page);
        }
        const rows = await collectStudyPlanRows(page);
        if (rows.length === 0) {
            continue;
        }
        let chosenIndex = 0;
        if (programHint?.trim()) {
            let bestScore = 0;
            let bestIndex = -1;
            for (const row of rows) {
                const score = scoreStudyPlanRow(row.text, programHint);
                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = row.index;
                }
            }
            if (bestIndex >= 0 && bestScore > 0) {
                chosenIndex = bestIndex;
            }
            else if (gemini?.isAvailable()) {
                try {
                    const result = await gemini.generateJson({
                        prompt: [
                            'You pick the best matching university study-plan row for a student.',
                            'Return ONLY JSON: {"rowIndex":<number>}. Use -1 if nothing is reasonably close.',
                            `Student desired field / program hint: "${programHint}"`,
                            'Available study plans (index: text):',
                            ...rows.map((r) => `${r.index}: ${r.text}`),
                        ].join('\n'),
                        temperature: 0,
                    });
                    const idx = result.rowIndex;
                    if (typeof idx === 'number' &&
                        Number.isInteger(idx) &&
                        idx >= 0 &&
                        idx < rows.length) {
                        chosenIndex = idx;
                    }
                }
                catch {
                }
            }
        }
        const clicked = await clickStudyPlanRowByIndex(page, chosenIndex);
        if (clicked) {
            return clicked;
        }
        const clickedLegacy = await page.evaluate(() => {
            const labelOf = (el) => (el.value || el.textContent || '')
                .replace(/\s+/g, ' ')
                .trim();
            const fireApplyClick = (link) => {
                link.scrollIntoView({ block: 'center', inline: 'nearest' });
                link.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                }));
                const onclick = link.getAttribute('onclick') || '';
                return `Apply:dispatch:${onclick.slice(0, 48)}`;
            };
            const byText = [
                ...document.querySelectorAll('a, input[type="button"], input[type="submit"]'),
            ].find((el) => /^(Apply|申请|选择|Select)$/i.test(labelOf(el)));
            if (byText) {
                return fireApplyClick(byText);
            }
            const byOnclick = [
                ...document.querySelectorAll([
                    'a[href*="apply"]',
                    'a[onclick*="StudyPlan"]',
                    'a[onclick*="choose"]',
                    'a[onclick*="Choose"]',
                    'a[onclick*="ChooseProject"]',
                    'a[onclick*="saveChoose"]',
                    'a[onclick*="ProjectBind"]',
                    'a[onclick*="saveChooseProjectBind"]',
                ].join(', ')),
            ].find((el) => {
                const style = getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
            if (byOnclick) {
                return fireApplyClick(byOnclick);
            }
            return null;
        });
        if (clickedLegacy) {
            return clickedLegacy;
        }
        const applyLink = page
            .locator('td a, table a, a')
            .filter({ hasText: /^(Apply|申请|选择|Select)$/i })
            .first();
        if ((await applyLink.count()) > 0) {
            await applyLink.scrollIntoViewIfNeeded().catch(() => undefined);
            await applyLink.click({ force: true });
            return 'Apply:playwright';
        }
    }
    return null;
}
const DEFAULT_STUDENT_TYPE_HINTS = [
    'Undergraduate Student',
    '本科生',
    '本科',
    'undergraduate',
    'bachelor',
];
function studentTypeHintList(preferred) {
    const preferredHints = preferred?.trim()
        ? [preferred.trim()]
        : [];
    const seen = new Set();
    const out = [];
    for (const hint of [...preferredHints, ...DEFAULT_STUDENT_TYPE_HINTS]) {
        const key = hint.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(hint);
    }
    return out;
}
async function pickStudentTypeRadio(page, studentType) {
    await dismissBlockingDialogs(page);
    const hints = studentTypeHintList(studentType);
    const hint = hints[0] ?? 'Undergraduate Student';
    const visibleRadios = page.locator('input[type="radio"][name="projectTypeId"]:visible');
    const count = await visibleRadios.count();
    if (count === 0) {
        return false;
    }
    const visibleChecked = () => page
        .locator('input[type="radio"][name="projectTypeId"]:visible:checked')
        .count();
    for (const textHint of hints) {
        const textLoc = page.getByText(textHint, { exact: true }).first();
        if ((await textLoc.count()) === 0) {
            continue;
        }
        if (!(await textLoc.isVisible().catch(() => false))) {
            continue;
        }
        await textLoc.click({ force: true }).catch(() => undefined);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    for (const textHint of hints) {
        const escaped = textHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const label = page
            .locator('label')
            .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, 'i') })
            .first();
        if ((await label.count()) === 0) {
            continue;
        }
        await label.click({ force: true }).catch(() => undefined);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    const index = await page.evaluate((hintList) => {
        const isVisible = (el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const list = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ];
        const visible = list.filter(isVisible);
        const labelOf = (radio) => {
            const wrap = radio.closest('label')?.textContent?.trim();
            if (wrap) {
                return wrap;
            }
            if (radio.id) {
                const forLabel = document.querySelector(`label[for="${radio.id.replace(/"/g, '\\"')}"]`);
                if (forLabel?.textContent?.trim()) {
                    return forLabel.textContent.trim();
                }
            }
            let node = radio.nextSibling;
            while (node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
                    if (text) {
                        return text;
                    }
                }
                else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    if (el.tagName === 'LABEL' || el.tagName === 'SPAN') {
                        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
                        if (text) {
                            return text;
                        }
                    }
                    if (el.tagName === 'BR' || el.tagName === 'INPUT') {
                        break;
                    }
                }
                node = node.nextSibling;
            }
            return '';
        };
        for (let i = 0; i < visible.length; i += 1) {
            const text = labelOf(visible[i]).toLowerCase();
            if (hintList.some((h) => text.includes(String(h).toLowerCase()))) {
                return i;
            }
        }
        for (let i = 0; i < visible.length; i += 1) {
            if (/undergraduate|本科/.test(labelOf(visible[i]).toLowerCase())) {
                return i;
            }
        }
        return Math.min(2, Math.max(0, visible.length - 1));
    }, hints);
    const target = visibleRadios.nth(index);
    const box = await target.boundingBox().catch(() => null);
    if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    await target.click({ force: true }).catch(() => undefined);
    if ((await visibleChecked()) > 0) {
        return true;
    }
    await target.check({ force: true }).catch(() => undefined);
    if ((await visibleChecked()) > 0) {
        return true;
    }
    {
        const near = page.getByText(hint, { exact: false }).first();
        const textBox = await near.boundingBox().catch(() => null);
        if (textBox) {
            await page.mouse.click(textBox.x + Math.min(12, textBox.width / 2), textBox.y + textBox.height / 2);
            if ((await visibleChecked()) > 0) {
                return true;
            }
        }
    }
    const forced = await page.evaluate(({ idx, needle }) => {
        const isVisible = (el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const visible = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ].filter(isVisible);
        const targetRadio = visible[idx] ??
            visible.find((radio) => {
                const text = (radio.closest('label')?.textContent ??
                    radio.nextSibling?.textContent ??
                    '').toLowerCase();
                return text.includes(needle.toLowerCase());
            }) ??
            visible[2] ??
            visible[0];
        if (!targetRadio) {
            return { ok: false, html: '' };
        }
        targetRadio.disabled = false;
        for (const radio of visible) {
            radio.checked = false;
            radio.removeAttribute('checked');
        }
        targetRadio.checked = true;
        targetRadio.setAttribute('checked', 'checked');
        targetRadio.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
        targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
        targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
        const parentHtml = (targetRadio.closest('label') ?? targetRadio.parentElement)?.outerHTML?.slice(0, 300);
        return {
            ok: targetRadio.checked,
            html: parentHtml ?? targetRadio.outerHTML,
        };
    }, { idx: index, needle: hint });
    if (forced.ok && (await visibleChecked()) > 0) {
        return true;
    }
    console.warn(`[pickStudentTypeRadio] failed hint="${hint}" index=${index} force=${JSON.stringify(forced)}`);
    return (await visibleChecked()) > 0;
}
const NEXT_NAME_RE = /^(Next|下一步|Save and Next|保存并下一步)$/i;
async function clickVisibleNext(page) {
    const candidates = [
        page.locator('input[type="button"][value="Next"], input[type="button"][value="下一步"]'),
        page.locator('input[value="Next"], input[value="下一步"]'),
        page.getByRole('button', { name: NEXT_NAME_RE }),
        page.locator('button.el-button--primary').filter({ hasText: NEXT_NAME_RE }),
        page.locator('button').filter({ hasText: NEXT_NAME_RE }),
        page.locator('a.el-button').filter({ hasText: NEXT_NAME_RE }),
    ];
    for (const locator of candidates) {
        const btn = locator.first();
        if ((await btn.count()) === 0) {
            continue;
        }
        if (!(await btn.isVisible().catch(() => false))) {
            continue;
        }
        await btn.click({ force: true });
        return 'Next:button';
    }
    return page.evaluate(() => {
        const normalize = (value) => value.replace(/\s+/g, ' ').trim();
        const nextRe = /^(Next|下一步|Save and Next|保存并下一步)$/i;
        const isShown = (el) => {
            const style = getComputedStyle(el);
            return (style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                el.offsetParent !== null);
        };
        const nodes = [
            ...document.querySelectorAll('button, a.el-button, input[type="button"], input[type="submit"], .el-button'),
        ];
        const byLabel = nodes.find((el) => {
            if (!isShown(el) || el.disabled) {
                return false;
            }
            const label = normalize(el.value ||
                el.getAttribute('aria-label') ||
                el.textContent ||
                '');
            return nextRe.test(label);
        });
        if (byLabel) {
            byLabel.click();
            return `Next:dom:${normalize(byLabel.textContent || byLabel.value || '')}`;
        }
        const primary = nodes.find((el) => {
            if (!el.classList.contains('el-button--primary')) {
                return false;
            }
            if (!isShown(el) || el.disabled) {
                return false;
            }
            const label = normalize(el.textContent || '');
            return label.length > 0 && !/search|login|查询|登录|搜/i.test(label);
        });
        if (primary) {
            primary.click();
            return `Next:primary:${normalize(primary.textContent || '')}`;
        }
        return null;
    });
}
async function fillPreWizardScreen(page, screen, hints) {
    const resolved = normalizeHints(hints);
    switch (screen) {
        case 'application_notes':
            await checkAgree(page);
            await pickProjectTypeRadio(page, resolved.programText);
            break;
        case 'program_type':
            await checkAgree(page);
            await pickProjectTypeRadio(page, resolved.programText);
            break;
        case 'student_type':
            await pickStudentTypeRadio(page, resolved.studentType);
            break;
        case 'program_selection':
            await fillProgramSelection(page);
            break;
        default:
            break;
    }
    return true;
}
async function clickPreWizardNext(page, screen, hints, gemini) {
    const resolved = normalizeHints(hints);
    const studyPlanHint = resolved.studyPlanHint;
    if (screen === 'application_notes') {
        const agreeButton = page
            .getByRole('button', {
            name: /agree and continue|同意并继续|同意/i,
        })
            .first();
        if ((await agreeButton.count()) > 0) {
            await page
                .waitForFunction(() => {
                const buttons = [...document.querySelectorAll('button')];
                const agree = buttons.find((button) => /agree and continue|同意并继续|同意/i.test(button.textContent ?? ''));
                return Boolean(agree && !agree.disabled);
            }, { timeout: 10_000 })
                .catch(() => undefined);
            await agreeButton.click({ force: true });
            return 'Agree and Continue';
        }
        return invokeButton(page, [
            'Agree and Continue',
            'Agree',
            '同意并继续',
            '同意',
        ]);
    }
    if (screen === 'program_type' || screen === 'student_type') {
        if (screen === 'program_type') {
            const checked = page.locator('input[name="projectTypeId"]:checked').first();
            if ((await checked.count()) === 0) {
                return null;
            }
        }
        else {
            const anyChecked = page.locator('input[type="radio"]:checked').first();
            if ((await anyChecked.count()) === 0) {
                return null;
            }
        }
        const nextClicked = await clickVisibleNext(page);
        if (nextClicked) {
            return nextClicked;
        }
        const invoked = await invokeButton(page, [
            'Next',
            '下一步',
            'Save and Next',
            '保存并下一步',
        ]);
        if (invoked) {
            return invoked;
        }
        if (screen !== 'program_type') {
            return null;
        }
        return page.evaluate(() => {
            const selected = document.querySelector('input[name="projectTypeId"]:checked');
            if (!selected) {
                return null;
            }
            const form = selected.form ??
                document.querySelector('form');
            const save = window.saveProjectType;
            if (typeof save === 'function' && form) {
                save(form);
                return `saveProjectType:${selected.value}`;
            }
            return null;
        });
    }
    if (screen === 'program_selection') {
        if (await isProgramSelectionEmpty(page)) {
            return 'empty_list';
        }
        const row = await selectStudyPlanRow(page, studyPlanHint, gemini);
        if (row) {
            return row;
        }
        return ((await clickVisibleNext(page)) ??
            invokeButton(page, ['Next', '下一步', 'Save and Next', '保存并下一步']));
    }
    return ((await clickVisibleNext(page)) ??
        invokeButton(page, ['Next', '下一步']));
}
async function invokeButton(page, labels) {
    return page.evaluate((buttonLabels) => {
        const matches = (el) => {
            if (el.tagName === 'INPUT') {
                const value = el.value?.trim() ?? '';
                return buttonLabels.some((label) => value.toLowerCase() === label.toLowerCase());
            }
            const text = el.textContent?.trim() ?? '';
            return buttonLabels.some((label) => new RegExp(`^${label}$`, 'i').test(text));
        };
        const btn = [
            ...document.querySelectorAll('input[type="button"], input[type="submit"], button, a'),
        ].find(matches);
        if (!btn) {
            return null;
        }
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
            const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
            run(btn);
            return (btn.value ||
                btn.textContent?.trim() ||
                'clicked');
        }
        btn.click();
        return (btn.value || btn.textContent?.trim() || 'clicked');
    }, labels);
}
async function advancePreWizardScreen(page, screen = null, hints, gemini) {
    await waitForUiReady(page);
    await dismissBlockingDialogs(page);
    const current = screen ?? (await detectPreWizardScreen(page));
    if (!current) {
        return false;
    }
    const before = await getPreWizardSignature(page, current);
    await fillPreWizardScreen(page, current, hints);
    await page.waitForTimeout(400);
    if (current === 'program_selection' && (await isProgramSelectionEmpty(page))) {
        return false;
    }
    if (current === 'program_type') {
        const selected = await page
            .locator('input[name="projectTypeId"]:checked')
            .count();
        if (selected === 0) {
            return false;
        }
    }
    if (current === 'student_type') {
        const selected = await page
            .locator('input[type="radio"][name="projectTypeId"]:visible:checked')
            .count();
        if (selected === 0) {
            return false;
        }
    }
    const clicked = await clickPreWizardNext(page, current, hints, gemini);
    if (!clicked || clicked === 'empty_list') {
        return false;
    }
    await page
        .waitForLoadState('domcontentloaded', { timeout: 10_000 })
        .catch(() => undefined);
    await page.waitForTimeout(600);
    for (let attempt = 0; attempt < 4; attempt += 1) {
        await waitForUiReady(page);
        await dismissBlockingDialogs(page);
        if (await isMainWizard(page)) {
            return true;
        }
        const afterScreen = await detectPreWizardScreen(page);
        const after = await getPreWizardSignature(page, afterScreen ?? current);
        if (after !== before) {
            return true;
        }
        await page.waitForTimeout(300);
    }
    return false;
}
async function clearStuckProcessing(page) {
    const stuck = await page.evaluate(() => /请求正在处理中|please wait|processing your request/i.test(document.body?.innerText ?? ''));
    if (!stuck) {
        return false;
    }
    await dismissBlockingDialogs(page);
    await page.waitForTimeout(2_000);
    const stillStuck = await page.evaluate(() => /请求正在处理中|please wait|processing your request/i.test(document.body?.innerText ?? ''));
    if (!stillStuck) {
        return true;
    }
    await page
        .reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
        .catch(() => undefined);
    await waitForUiReady(page);
    return true;
}
async function advanceThroughPreWizard(page, hints, { maxSteps = 10, deadlineMs = 90_000, gemini, } = {}) {
    const MAX_CONSECUTIVE_FAILS = 3;
    const MAX_SAME_SCREEN = 3;
    let consecutiveFails = 0;
    let sameScreenHits = 0;
    let lastScreen = null;
    const deadline = Date.now() + deadlineMs;
    await clearStuckProcessing(page);
    for (let step = 0; step < maxSteps; step += 1) {
        if (Date.now() > deadline) {
            return isMainWizard(page);
        }
        if (await isMainWizard(page)) {
            return true;
        }
        const screen = await detectPreWizardScreen(page);
        if (!screen) {
            consecutiveFails += 1;
            if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
                return false;
            }
            await page.waitForTimeout(800);
            continue;
        }
        if (screen === lastScreen) {
            sameScreenHits += 1;
            if (sameScreenHits >= MAX_SAME_SCREEN) {
                return false;
            }
        }
        else {
            lastScreen = screen;
            sameScreenHits = 0;
        }
        const advanced = await advancePreWizardScreen(page, screen, hints, gemini);
        if (await isMainWizard(page)) {
            return true;
        }
        if (advanced) {
            consecutiveFails = 0;
            const after = await detectPreWizardScreen(page);
            if (after && after !== screen) {
                lastScreen = after;
                sameScreenHits = 0;
            }
            continue;
        }
        consecutiveFails += 1;
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
            return false;
        }
        await page.waitForTimeout(800);
    }
    return isMainWizard(page);
}
async function describeNavigationState(page) {
    return page.evaluate(() => {
        const normalize = (value) => value.replace(/\s+/g, ' ').trim();
        const nextRe = /^(Next|下一步|Save and Next|保存并下一步)$/i;
        const bodyRaw = document.body?.innerText ?? '';
        const body = normalize(bodyRaw).slice(0, 240);
        const screen = (() => {
            if (document.querySelector('select[name="collegeId"]')) {
                return 'program_selection';
            }
            if (/请选择招生类别|please choose your type/i.test(bodyRaw)) {
                return 'student_type';
            }
            if (document.querySelector('input[name="projectTypeId"]')) {
                return 'program_type';
            }
            if (document.querySelector('input[name="apply.lastName"]')) {
                return 'wizard_step1';
            }
            return 'unknown';
        })();
        const inputs = [
            ...document.querySelectorAll('input[type="radio"]'),
        ];
        const checked = inputs.find((input) => input.checked);
        const inputDump = inputs
            .slice(0, 10)
            .map((input) => {
            const parent = (input.closest('label') ?? input.parentElement)?.outerHTML?.replace(/\s+/g, ' ')
                .slice(0, 120);
            return (`name=${input.name};value=${input.value};checked=${input.checked};` +
                `disabled=${input.disabled};display=${getComputedStyle(input).display};` +
                `parent=${parent ?? ''}`);
        })
            .join(' | ');
        const hasSave = typeof window.saveProjectType ===
            'function';
        const nextInput = document.querySelector('input[value="Next"], input[value="下一步"]');
        const buttons = [...document.querySelectorAll('button, a.el-button')].map((button) => normalize(button.textContent ?? ''));
        const nextButton = buttons.find((text) => nextRe.test(text));
        const form = document.querySelector('form');
        const lastName = document.querySelector('input[name="apply.lastName"]');
        return [
            `screen=${screen}`,
            `radios=${inputs.length}`,
            `checked=${checked ? `${checked.name}:${checked.value}` : 'none'}`,
            `inputs=[${inputDump}]`,
            `saveProjectType=${hasSave}`,
            `nextInput=${Boolean(nextInput)}`,
            `nextButton=${Boolean(nextButton)}`,
            `buttons=[${buttons.filter(Boolean).slice(0, 12).join(' | ')}]`,
            `form=${Boolean(form)}`,
            `step1Visible=${Boolean(lastName && lastName.offsetParent !== null)}`,
            `body="${body}"`,
        ].join('; ');
    });
}
//# sourceMappingURL=zzu-pre-wizard.js.map