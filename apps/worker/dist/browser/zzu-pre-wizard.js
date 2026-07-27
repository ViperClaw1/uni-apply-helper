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
async function waitForUiReady(page) {
    await dismissBlockingDialogs(page);
    await page
        .locator('.window-mask, .el-loading-mask, .datagrid-mask')
        .first()
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => undefined);
    await page
        .waitForFunction(() => {
        const text = document.body?.innerText ?? '';
        return !/请求正在处理中|please wait|processing/i.test(text);
    }, { timeout: 8_000 })
        .catch(() => undefined);
    await page.waitForTimeout(200);
}
async function dismissBlockingDialogs(page) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
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
        await page.waitForTimeout(400);
    }
    await page
        .evaluate(() => {
        const text = document.body?.innerText ?? '';
        if (!/请求正在处理中|processing/i.test(text)) {
            return;
        }
        for (const el of document.querySelectorAll('.window-mask, .datagrid-mask, .messager-window, .panel.window, .window-shadow')) {
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
        if (!option?.value) {
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
async function fillProgramSelection(page) {
    const hasNativeOptions = await page.evaluate(() => {
        const college = document.querySelector('select[name="collegeId"]');
        return Boolean(college && college.options.length > 1);
    });
    if (!hasNativeOptions) {
        return;
    }
    await setHiddenSelectByName(page, 'collegeId', 1);
    const hasMajor = await page.evaluate(() => Boolean(document.querySelector('select[name="majorId"]')));
    if (hasMajor) {
        await page.waitForTimeout(1500);
        await page
            .waitForFunction(() => {
            const major = document.querySelector('select[name="majorId"]');
            return Boolean(major && major.options.length > 1);
        }, { timeout: 15_000 })
            .catch(() => undefined);
        await setHiddenSelectByName(page, 'majorId', 1);
    }
    await setHiddenSelectByName(page, 'teachLanguage', 1);
    await page.waitForTimeout(500);
}
async function isProgramSelectionEmpty(page) {
    return page.evaluate(() => /Total:\s*0/i.test(document.body?.innerText ?? ''));
}
async function selectStudyPlanRow(page) {
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
        const clicked = await page.evaluate(() => {
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
        if (clicked) {
            return clicked;
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
const STUDENT_TYPE_HINTS = [
    'Undergraduate Student',
    '本科生',
    '本科',
    'undergraduate',
    'bachelor',
];
async function pickStudentTypeRadio(page) {
    for (const hint of STUDENT_TYPE_HINTS) {
        const byText = page.getByText(hint, { exact: false }).first();
        try {
            if ((await byText.count()) > 0 &&
                (await byText.isVisible().catch(() => false))) {
                await byText.click({ force: true });
                const checked = await page.locator('input[type="radio"]:checked').count();
                if (checked > 0) {
                    return true;
                }
            }
        }
        catch {
        }
    }
    const labels = page.locator('label:has(input[type="radio"][name="projectTypeId"])');
    const labelCount = await labels.count();
    for (const prefer of [true, false]) {
        for (let i = 0; i < labelCount; i += 1) {
            const label = labels.nth(i);
            if (!(await label.isVisible().catch(() => false))) {
                continue;
            }
            const text = ((await label.innerText().catch(() => '')) || '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            const isPreferred = STUDENT_TYPE_HINTS.some((hint) => text.includes(hint.toLowerCase()));
            if (prefer && !isPreferred) {
                continue;
            }
            if (!prefer && isPreferred) {
                continue;
            }
            await label.click({ force: true });
            if ((await page.locator('input[type="radio"]:checked').count()) > 0) {
                return true;
            }
        }
    }
    return page.evaluate((hints) => {
        const normalize = (value) => value.replace(/\s+/g, ' ').trim();
        const radios = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ];
        const labelOf = (radio) => normalize(radio.closest('label')?.textContent ?? '');
        const target = radios.find((radio) => {
            const label = labelOf(radio).toLowerCase();
            return hints.some((hint) => label.includes(String(hint).toLowerCase()));
        }) ?? radios[0];
        if (!target) {
            return false;
        }
        target.closest('label')?.click();
        if (target.checked) {
            return true;
        }
        target.click();
        if (target.checked) {
            return true;
        }
        for (const radio of radios) {
            radio.checked = radio === target;
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
        const onclick = target.getAttribute('onclick');
        if (onclick) {
            try {
                const run = new Function('event', onclick);
                run.call(target, new Event('click'));
            }
            catch {
            }
        }
        return target.checked;
    }, STUDENT_TYPE_HINTS);
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
async function fillPreWizardScreen(page, screen, programHint) {
    switch (screen) {
        case 'application_notes':
            await checkAgree(page);
            await pickProjectTypeRadio(page, programHint);
            break;
        case 'program_type':
            await checkAgree(page);
            await pickProjectTypeRadio(page, programHint);
            break;
        case 'student_type':
            await pickStudentTypeRadio(page);
            break;
        case 'program_selection':
            await fillProgramSelection(page);
            break;
        default:
            break;
    }
    return true;
}
async function clickPreWizardNext(page, screen, _programHint) {
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
        const row = await selectStudyPlanRow(page);
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
async function advancePreWizardScreen(page, screen = null, programHint) {
    await waitForUiReady(page);
    await dismissBlockingDialogs(page);
    const current = screen ?? (await detectPreWizardScreen(page));
    if (!current) {
        return false;
    }
    if (current === 'program_selection' && (await isProgramSelectionEmpty(page))) {
        return false;
    }
    const before = await getPreWizardSignature(page, current);
    await fillPreWizardScreen(page, current, programHint);
    await page.waitForTimeout(400);
    if (current === 'program_type') {
        const selected = await page
            .locator('input[name="projectTypeId"]:checked')
            .count();
        if (selected === 0) {
            return false;
        }
    }
    if (current === 'student_type') {
        const selected = await page.locator('input[type="radio"]:checked').count();
        if (selected === 0) {
            return false;
        }
    }
    const clicked = await clickPreWizardNext(page, current, programHint);
    if (!clicked || clicked === 'empty_list') {
        return false;
    }
    await page
        .waitForLoadState('domcontentloaded', { timeout: 10_000 })
        .catch(() => undefined);
    await page.waitForTimeout(600);
    for (let attempt = 0; attempt < 6; attempt += 1) {
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
        await page.waitForTimeout(350);
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
    await page.reload({ waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined);
    await waitForUiReady(page);
    return true;
}
async function advanceThroughPreWizard(page, programHint, { maxSteps = 20 } = {}) {
    const MAX_CONSECUTIVE_FAILS = 4;
    let consecutiveFails = 0;
    await clearStuckProcessing(page);
    for (let step = 0; step < maxSteps; step += 1) {
        if (await isMainWizard(page)) {
            return true;
        }
        const screen = await detectPreWizardScreen(page);
        if (!screen) {
            consecutiveFails += 1;
            if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
                return false;
            }
            await page.waitForTimeout(1200);
            continue;
        }
        const advanced = await advancePreWizardScreen(page, screen, programHint);
        if (advanced || (await isMainWizard(page))) {
            consecutiveFails = 0;
            continue;
        }
        consecutiveFails += 1;
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
            return false;
        }
        await page.waitForTimeout(1200);
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
            .map((input) => `name=${input.name};value=${input.value};checked=${input.checked};display=${getComputedStyle(input).display}`)
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