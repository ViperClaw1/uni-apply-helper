"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigateToZzuApplication = navigateToZzuApplication;
const session_expired_error_js_1 = require("../errors/session-expired.error.js");
const program_hint_js_1 = require("./program-hint.js");
const zzu_session_loader_js_1 = require("./zzu-session.loader.js");
const zzu_pre_wizard_js_1 = require("./zzu-pre-wizard.js");
function memberUrlFromForm(formUrl) {
    return `${new URL(formUrl).origin}/member/index.do`;
}
const NAV_APPLICATION = [
    'a:has-text("Application"):not(:has-text("Status"))',
    'a[href*="apply"]:has-text("Application")',
    'a:has-text("报名申请")',
    'a[href*="apply"]:has-text("报名")',
].join(', ');
const START_APPLICATION = [
    'a:has-text("Start Application")',
    'button:has-text("Start Application")',
    'input[value="Start Application"]',
    'a:has-text("Online Application")',
    'a:has-text("New Application")',
    'a:has-text("开始申请")',
    'a:has-text("在线申请")',
    'input[value="开始申请"]',
].join(', ');
const EDIT_APPLICATION = [
    'table a:has-text("Edit")',
    '.operation a:has-text("Edit")',
    'a:has-text("Edit")',
    'button:has-text("Edit")',
    'input[value="Edit"]',
    'a:has-text("编辑")',
    'input[value="编辑"]',
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
        .waitForLoadState('domcontentloaded', { timeout: 12_000 })
        .catch(() => undefined);
    await page.waitForTimeout(500);
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
            .waitForLoadState('domcontentloaded', { timeout: 12_000 })
            .catch(() => undefined);
        await page.waitForTimeout(500);
        return true;
    }
    return clickIfVisible(page, EDIT_APPLICATION, { force: true });
}
async function isWizardStep(page) {
    return (0, zzu_pre_wizard_js_1.isMainWizard)(page);
}
async function advanceIntermediateSteps(page, hints, gemini) {
    for (let step = 0; step < 4; step += 1) {
        if (await isWizardStep(page)) {
            return true;
        }
        if (await (0, zzu_pre_wizard_js_1.detectPreWizardScreen)(page)) {
            const advanced = await (0, zzu_pre_wizard_js_1.advanceThroughPreWizard)(page, hints, {
                gemini,
                deadlineMs: 90_000,
            });
            if (advanced || (await isWizardStep(page))) {
                return true;
            }
            return false;
        }
        const bodyText = await page.locator('body').innerText();
        if (/application status|application list|my application|start application/i.test(bodyText)) {
            const started = await clickIfVisible(page, START_APPLICATION, {
                force: true,
            });
            const edited = await clickEditApplication(page);
            if (!started && !edited) {
                return false;
            }
            continue;
        }
        break;
    }
    return isWizardStep(page);
}
async function advanceToWizard(page, formUrl, hints, gemini) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        if (await advanceIntermediateSteps(page, hints, gemini)) {
            return;
        }
        await clickIfVisible(page, START_APPLICATION, { force: true });
        await clickEditApplication(page);
        if (await advanceIntermediateSteps(page, hints, gemini)) {
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
                .waitForLoadState('domcontentloaded', { timeout: 30_000 })
                .catch(() => undefined);
            await advanceIntermediateSteps(page, hints, gemini);
        }
    }
}
async function navigateToZzuApplication(page, formUrl, profile, universityId = 'zhengzhou-university', defaultProgram, navigationHints, gemini) {
    const studyPlanHint = (profile ? (0, program_hint_js_1.resolveProgramHint)(profile, universityId) : undefined) ??
        defaultProgram;
    const hints = {
        programText: navigationHints?.programText ?? defaultProgram,
        studentType: navigationHints?.studentType,
        studyPlanHint,
    };
    await page.goto(formUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
        referer: memberUrlFromForm(formUrl),
    });
    if ((0, zzu_session_loader_js_1.isLoginRedirect)(page.url())) {
        throw new session_expired_error_js_1.SessionExpiredError(`Session expired for ${universityId}`, universityId);
    }
    if (await (0, zzu_session_loader_js_1.isLoginPage)(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`Login form detected — session expired for ${universityId}`, universityId);
    }
    if (await (0, zzu_session_loader_js_1.isCsrfBlocked)(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`CSRF protection triggered — re-login required for ${universityId}`, universityId);
    }
    await (0, zzu_pre_wizard_js_1.clearStuckProcessing)(page);
    if (await isWizardStep(page)) {
        return;
    }
    await clickIfVisible(page, NAV_APPLICATION);
    await clickIfVisible(page, START_APPLICATION, { force: true });
    await clickEditApplication(page);
    await advanceToWizard(page, formUrl, hints, gemini);
    if (!(await isWizardStep(page))) {
        const screen = await (0, zzu_pre_wizard_js_1.detectPreWizardScreen)(page);
        if (screen) {
            await (0, zzu_pre_wizard_js_1.advanceThroughPreWizard)(page, hints, { gemini, maxSteps: 6 });
        }
    }
    if (!(await isWizardStep(page))) {
        const shotPath = `nav-stuck-${universityId}-${Date.now()}.png`;
        await page.screenshot({ path: shotPath, fullPage: true }).catch(() => undefined);
        const diagnostics = await (0, zzu_pre_wizard_js_1.describeNavigationState)(page).catch(() => 'diagnostics unavailable');
        throw new Error('17gz wizard not reached after navigation (expected any wizard step). ' +
            `URL: ${page.url()}. Screenshot: ${shotPath}. ${diagnostics}` +
            ((0, zzu_pre_wizard_js_1.getLastStudentTypePickDiag)()
                ? ` pickDiag=${JSON.stringify((0, zzu_pre_wizard_js_1.getLastStudentTypePickDiag)())}`
                : ''));
    }
}
//# sourceMappingURL=zzu-navigation.js.map