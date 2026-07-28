"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForUiReady = waitForUiReady;
exports.dismissBlockingDialogs = dismissBlockingDialogs;
exports.detectPreWizardScreen = detectPreWizardScreen;
exports.isMainWizard = isMainWizard;
exports.getLastStudentTypePickDiag = getLastStudentTypePickDiag;
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
        const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        targetRadio.checked = true;
        const raw = targetRadio.getAttribute('onclick') || '';
        const match = raw.match(/^(projectTypeOnClick\w*)\s*\(/);
        const fnName = match?.[1];
        const fn = fnName
            ? window[fnName]
            : undefined;
        if (typeof fn === 'function') {
            try {
                fn(targetRadio, evt);
            }
            catch {
            }
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
async function clickStudyPlanApplySimple(page, studyPlanHint) {
    await page
        .waitForFunction(() => {
        const links = [...document.querySelectorAll('a')].filter((a) => /^(Apply|申请)$/i.test((a.textContent || '').replace(/\s+/g, ' ').trim()));
        return links.length > 0;
    }, { timeout: 20_000 })
        .catch(() => undefined);
    const applyLinks = page.locator('a').filter({ hasText: /^(Apply|申请)$/i });
    const total = await applyLinks.count();
    if (total === 0) {
        return { ok: false, via: 'no-apply-links', total: 0 };
    }
    let index = 0;
    const needle = studyPlanHint?.trim().toLowerCase();
    if (needle) {
        for (let i = 0; i < total; i += 1) {
            const rowText = ((await applyLinks
                .nth(i)
                .evaluate((el) => (el.closest('tr')?.innerText || el.textContent || '')
                .replace(/\s+/g, ' ')
                .trim())
                .catch(() => '')) || '').toLowerCase();
            if (rowText.includes(needle) || needle.split(/\s+/).some((p) => p.length > 3 && rowText.includes(p))) {
                index = i;
                break;
            }
        }
    }
    await applyLinks.nth(index).scrollIntoViewIfNeeded().catch(() => undefined);
    await applyLinks.nth(index).click({ force: true });
    return { ok: true, via: 'Apply:debug-parity', index, total };
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
let lastStudentTypePickDiag = null;
function getLastStudentTypePickDiag() {
    return lastStudentTypePickDiag;
}
async function waitForProjectTypeChecked(page, timeoutMs = 5_000) {
    await page
        .waitForFunction(() => Boolean(document.querySelector('input[type="radio"][name="projectTypeId"]:checked')), { timeout: timeoutMs })
        .catch(() => undefined);
    return page.evaluate(() => Boolean(document.querySelector('input[type="radio"][name="projectTypeId"]:checked')));
}
async function pickStudentTypeRadio(page, studentType) {
    await dismissBlockingDialogs(page);
    const hints = studentTypeHintList(studentType);
    const hint = hints[0] ?? 'Undergraduate Student';
    lastStudentTypePickDiag = { build: 'atomic-v1', hint };
    for (const textHint of hints) {
        const escaped = textHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const label = page
            .locator('label:has(input[type="radio"][name="projectTypeId"])')
            .filter({ hasText: new RegExp(escaped, 'i') })
            .first();
        if ((await label.count()) === 0) {
            continue;
        }
        await label.scrollIntoViewIfNeeded().catch(() => undefined);
        await label.click({ force: true });
        const ok = await page.evaluate(() => Boolean(document.querySelector('input[type="radio"][name="projectTypeId"]:checked')));
        lastStudentTypePickDiag = {
            ...lastStudentTypePickDiag,
            playwrightLabel: textHint,
            ok,
        };
        if (ok) {
            return true;
        }
    }
    const forced = await page.evaluate((needle) => {
        const radios = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ];
        const labelOf = (radio) => (radio.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const target = radios.find((radio) => labelOf(radio).toLowerCase().includes(String(needle).toLowerCase())) ??
            radios.find((radio) => /undergraduate|本科/i.test(labelOf(radio))) ??
            radios[2] ??
            radios[0];
        if (!target) {
            return {
                ok: false,
                reason: 'no-radio',
                n: radios.length,
                hasFn: typeof window
                    .projectTypeOnClick22,
            };
        }
        const label = target.closest('label');
        label?.click();
        const afterLabelClick = target.checked;
        const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        target.checked = true;
        target.setAttribute('checked', 'checked');
        target.setAttribute('confirmflag', 'true');
        const win = window;
        let fnError = null;
        if (typeof win.projectTypeOnClick22 === 'function') {
            try {
                win.projectTypeOnClick22(target, evt);
            }
            catch (error) {
                fnError = error instanceof Error ? error.message : String(error);
            }
        }
        else {
            const raw = target.getAttribute('onclick') || '';
            const match = raw.match(/^(projectTypeOnClick\w*)\s*\(/);
            const fnName = match?.[1];
            const fn = fnName
                ? window[fnName]
                : undefined;
            if (typeof fn === 'function') {
                try {
                    fn(target, evt);
                }
                catch (error) {
                    fnError = error instanceof Error ? error.message : String(error);
                }
            }
        }
        const checkedNow = Boolean(document.querySelector('input[type="radio"][name="projectTypeId"]:checked'));
        return {
            ok: checkedNow || target.checked,
            afterLabelClick,
            targetChecked: target.checked,
            checkedNow,
            value: target.value,
            label: labelOf(target).slice(0, 60),
            hasFn: typeof win.projectTypeOnClick22,
            fnError,
            onclick: (target.getAttribute('onclick') || '').slice(0, 80),
        };
    }, hint);
    lastStudentTypePickDiag = { ...lastStudentTypePickDiag, forced };
    console.warn('[pickStudentTypeRadio]', forced);
    return Boolean(forced.ok);
}
async function advanceStudentTypeAtomic(page, studentType) {
    const picked = await pickStudentTypeRadio(page, studentType);
    if (!picked) {
        return false;
    }
    const stillChecked = await page.evaluate(() => {
        const selected = document.querySelector('input[name="projectTypeId"]:checked');
        return selected
            ? { ok: true, value: selected.value }
            : { ok: false, value: null };
    });
    lastStudentTypePickDiag = {
        ...lastStudentTypePickDiag,
        beforeNext: stillChecked,
    };
    if (!stillChecked.ok) {
        return false;
    }
    const nextBtn = page
        .locator('input[type="button"][value="Next"], input[value="Next"], input[value="下一步"]')
        .first();
    let via = 'none';
    if ((await nextBtn.count()) > 0) {
        await nextBtn.click({ force: true });
        via = 'playwright:Next';
    }
    else {
        const fallback = await page.evaluate(() => {
            const selected = document.querySelector('input[name="projectTypeId"]:checked');
            if (!selected) {
                return { ok: false, via: 'lost-checked' };
            }
            const next = document.querySelector('input[type="button"][value="Next"], input[value="Next"]');
            if (!next) {
                return { ok: false, via: 'no-next' };
            }
            const onclick = next.getAttribute('onclick') || '';
            if (onclick) {
                try {
                    const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
                    run(next);
                    return { ok: true, via: `onclick:${onclick.slice(0, 40)}` };
                }
                catch {
                }
            }
            next.click();
            return { ok: true, via: 'next.click' };
        });
        via = fallback.via;
        if (!fallback.ok) {
            lastStudentTypePickDiag = { ...lastStudentTypePickDiag, next: fallback };
            return false;
        }
    }
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
        const body = document.body?.innerText ?? '';
        const messager = [
            ...document.querySelectorAll('.messager-body, .messager-window .panel-body, .messager-window'),
        ]
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0 && t.length < 200)
            .slice(0, 3);
        const checked = document.querySelector('input[name="projectTypeId"]:checked')?.value;
        const hasCollege = Boolean(document.querySelector('select[name="collegeId"]'));
        const screen = hasCollege
            ? 'program_selection'
            : /please choose your type/i.test(body)
                ? 'student_type'
                : document.querySelector('input[name="apply.lastName"]')
                    ? 'wizard'
                    : 'other';
        return {
            screen,
            checked: checked ?? null,
            messager,
            hasCollege,
            bodySnippet: body.slice(0, 120),
        };
    });
    lastStudentTypePickDiag = {
        ...lastStudentTypePickDiag,
        next: { ok: true, via },
        afterNext: after,
        build: 'atomic-v4-debug-parity',
    };
    if (after.screen === 'program_selection' || after.hasCollege) {
        return true;
    }
    if (after.screen === 'wizard') {
        return true;
    }
    return false;
}
async function waitForProcessingQuiet(page, timeoutMs = 45_000) {
    await page
        .waitForFunction(() => {
        const wins = [
            ...document.querySelectorAll('.messager-window, .panel.window, .window-mask, .datagrid-mask'),
        ];
        const busy = wins.some((win) => {
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
        return !busy;
    }, { timeout: timeoutMs })
        .catch(() => undefined);
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
        if (!(await waitForProjectTypeChecked(page, 5_000))) {
            return null;
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
            const next = document.querySelector('input[type="button"][value="Next"], input[value="Next"], input[value="下一步"]');
            if (next) {
                next.click();
                return `Next:dom:${next.value}`;
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
    if (current === 'student_type') {
        const resolved = normalizeHints(hints);
        const ok = await advanceStudentTypeAtomic(page, resolved.studentType);
        if (!ok) {
            return false;
        }
        await waitForProcessingQuiet(page, 45_000);
        if (await isMainWizard(page)) {
            return true;
        }
        const afterScreen = await detectPreWizardScreen(page);
        lastStudentTypePickDiag = {
            ...lastStudentTypePickDiag,
            afterProcessingScreen: afterScreen,
            build: 'atomic-v4-debug-parity',
        };
        const onStudyPlan = afterScreen === 'program_selection' ||
            (await page.locator('select[name="collegeId"]').count()) > 0;
        if (!onStudyPlan) {
            return false;
        }
        const applied = await clickStudyPlanApplySimple(page, resolved.studyPlanHint);
        lastStudentTypePickDiag = {
            ...lastStudentTypePickDiag,
            studyPlan: applied,
        };
        if (!applied.ok) {
            return false;
        }
        await waitForProcessingQuiet(page, 45_000);
        if (await isMainWizard(page)) {
            return true;
        }
        const finalScreen = await detectPreWizardScreen(page);
        lastStudentTypePickDiag = {
            ...lastStudentTypePickDiag,
            afterApplyScreen: finalScreen,
        };
        return finalScreen !== 'program_selection' && finalScreen !== 'student_type';
    }
    if (current === 'program_selection') {
        const resolved = normalizeHints(hints);
        await waitForProcessingQuiet(page, 20_000);
        const applied = await clickStudyPlanApplySimple(page, resolved.studyPlanHint);
        lastStudentTypePickDiag = {
            ...lastStudentTypePickDiag,
            studyPlanSolo: applied,
            build: 'atomic-v4-debug-parity',
        };
        if (!applied.ok) {
            return false;
        }
        await waitForProcessingQuiet(page, 45_000);
        if (await isMainWizard(page)) {
            return true;
        }
        const finalScreen = await detectPreWizardScreen(page);
        return finalScreen !== 'program_selection' && finalScreen !== 'student_type';
    }
    if (current === 'program_type') {
        if (!(await waitForProjectTypeChecked(page, 5_000))) {
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
    const midPreWizard = await page.evaluate(() => {
        if (document.querySelector('select[name="collegeId"]')) {
            return true;
        }
        if (document.querySelector('input[name="projectTypeId"]')) {
            return true;
        }
        if (document.querySelector('input[name="apply.lastName"]') &&
            document.querySelector('input[name="apply.lastName"]')?.offsetParent !== null) {
            return true;
        }
        return false;
    });
    if (midPreWizard) {
        await waitForProcessingQuiet(page, 30_000);
        return false;
    }
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