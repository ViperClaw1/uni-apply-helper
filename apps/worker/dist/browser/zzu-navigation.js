"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigateToZzuApplication = navigateToZzuApplication;
const program_hint_js_1 = require("./program-hint.js");
const MEMBER_URL = 'https://zzu.17gz.org/member/index.do';
const NAV_APPLICATION = [
    'a:has-text("Application"):not(:has-text("Status"))',
    'a[href*="apply"]:has-text("Application")',
].join(', ');
const START_APPLICATION = [
    'a:has-text("Start Application")',
    'button:has-text("Start Application")',
    'a:has-text("Online Application")',
    'a:has-text("New Application")',
].join(', ');
const EDIT_APPLICATION = [
    'table a:has-text("Edit")',
    '.operation a:has-text("Edit")',
    'a:has-text("Edit")',
    'button:has-text("Edit")',
    'input[value="Edit"]',
].join(', ');
const AGREE_SELECTORS = [
    'button:has-text("Agree and continue")',
    'button:has-text("Agree and Continue")',
    'input[value="Agree and Continue"]',
    'a:has-text("Agree and Continue")',
    'button:has-text("Agree")',
].join(', ');
async function waitForUiReady(page) {
    await page
        .locator('.window-mask, .el-loading-mask')
        .first()
        .waitFor({ state: 'hidden', timeout: 15_000 })
        .catch(() => undefined);
    await page.waitForTimeout(300);
}
async function clickIfVisible(page, selector, { force = false } = {}) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
        return false;
    }
    await waitForUiReady(page);
    await locator.click({ force });
    await page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
}
async function clickEditApplication(page) {
    await waitForUiReady(page);
    const editButton = page
        .locator('input[value="Edit"][onclick*="editApply"], button:has-text("Edit")')
        .first();
    if ((await editButton.count()) > 0) {
        await editButton.click({ force: true });
        await page
            .waitForLoadState('networkidle', { timeout: 30_000 })
            .catch(() => undefined);
        await page.waitForTimeout(800);
        return true;
    }
    return clickIfVisible(page, EDIT_APPLICATION, { force: true });
}
async function acceptApplicationNotes(page) {
    const bodyText = await page.locator('body').innerText();
    if (!/application notes|application instructions/i.test(bodyText)) {
        return false;
    }
    const label = page.getByText(/I have carefully read/i).first();
    if ((await label.count()) > 0) {
        await label.click({ force: true });
    }
    else {
        const checkbox = page.locator('.el-checkbox, input[type="checkbox"]').first();
        if ((await checkbox.count()) > 0) {
            await checkbox.click({ force: true });
        }
    }
    await page.waitForTimeout(500);
    const agreeButton = page.getByRole('button', { name: /agree and continue/i }).first();
    if ((await agreeButton.count()) === 0) {
        return clickIfVisible(page, AGREE_SELECTORS, { force: true });
    }
    await page
        .waitForFunction(() => {
        const buttons = [...document.querySelectorAll('button')];
        const agree = buttons.find((button) => /agree and continue/i.test(button.textContent ?? ''));
        return Boolean(agree && !agree.disabled);
    }, { timeout: 10_000 })
        .catch(() => undefined);
    await agreeButton.click({ force: true });
    await page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
}
async function isWizardStep(page) {
    const bodyText = await page.locator('body').innerText();
    if (/basic info(rmation)?/i.test(bodyText)) {
        return true;
    }
    if (/save and next/i.test(bodyText)) {
        return true;
    }
    const formFields = await page
        .locator([
        'input[name="apply.lastName"]',
        'input[name="apply.givenName"]',
        'input[name="apply.passportNo"]',
        'select[name*="sex"]',
        'input[name="surname"]',
        'input[name="givenName"]',
    ].join(', '))
        .count();
    return formFields > 0;
}
async function selectNextOption(page, programHint) {
    const bodyText = await page.locator('body').innerText();
    if (!/please choose your (program|type)/i.test(bodyText)) {
        return false;
    }
    if (programHint) {
        const labeledOption = page
            .locator('.el-radio, .el-radio__label, label')
            .filter({ hasText: programHint })
            .first();
        if ((await labeledOption.count()) > 0) {
            await labeledOption.click({ force: true });
        }
        else {
            const textMatch = page.getByText(programHint, { exact: false }).first();
            if ((await textMatch.count()) > 0) {
                await textMatch.click({ force: true });
            }
        }
    }
    const selectedRadio = page.locator('.el-radio.is-checked, input[type="radio"]:checked');
    if ((await selectedRadio.count()) === 0) {
        const fallback = page
            .locator('.el-radio, .el-radio__label, input[type="radio"]')
            .first();
        if ((await fallback.count()) > 0) {
            await fallback.click({ force: true });
        }
    }
    await page.waitForTimeout(500);
    const nextButton = page.getByRole('button', { name: /^Next$/i }).first();
    if ((await nextButton.count()) > 0) {
        await nextButton.click({ force: true });
        await page
            .waitForLoadState('networkidle', { timeout: 30_000 })
            .catch(() => undefined);
        await page.waitForTimeout(800);
        return true;
    }
    return clickIfVisible(page, 'button:has-text("Next"), input[value="Next"]', {
        force: true,
    });
}
async function advanceIntermediateSteps(page, programHint) {
    for (let step = 0; step < 8; step += 1) {
        if (await isWizardStep(page)) {
            return true;
        }
        const bodyText = await page.locator('body').innerText();
        if (/application status|application list/i.test(bodyText)) {
            await clickEditApplication(page);
            continue;
        }
        if (/please choose your (program|type)/i.test(bodyText)) {
            await selectNextOption(page, programHint);
            continue;
        }
        if (/application notes|application instructions/i.test(bodyText)) {
            await acceptApplicationNotes(page);
            continue;
        }
        break;
    }
    return isWizardStep(page);
}
async function advanceToWizard(page, formUrl, programHint) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await advanceIntermediateSteps(page, programHint)) {
            return;
        }
        await clickEditApplication(page);
        if (await advanceIntermediateSteps(page, programHint)) {
            return;
        }
    }
    if (!(await isWizardStep(page)) && !page.url().includes('/apply/')) {
        const formLink = page
            .locator(`a[href="${formUrl}"], a[href*="apply/index.do"]`)
            .first();
        if ((await formLink.count()) > 0) {
            await formLink.click();
            await page
                .waitForLoadState('networkidle', { timeout: 60_000 })
                .catch(() => undefined);
            await advanceIntermediateSteps(page, programHint);
        }
    }
}
async function navigateToZzuApplication(page, formUrl, profile, universityId = 'zhengzhou-university') {
    const programHint = profile
        ? (0, program_hint_js_1.resolveProgramHint)(profile, universityId)
        : undefined;
    await page.goto(formUrl, {
        waitUntil: 'networkidle',
        timeout: 60_000,
        referer: MEMBER_URL,
    });
    if (await isWizardStep(page)) {
        return;
    }
    const onApplySection = page.url().includes('/apply/');
    if (!onApplySection) {
        await clickIfVisible(page, NAV_APPLICATION);
        await clickIfVisible(page, START_APPLICATION);
    }
    await advanceToWizard(page, formUrl, programHint);
}
//# sourceMappingURL=zzu-navigation.js.map