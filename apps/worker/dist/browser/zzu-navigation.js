"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigateToZzuApplication = navigateToZzuApplication;
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
    'button:has-text("Agree and Continue")',
    'input[value="Agree and Continue"]',
    'a:has-text("Agree and Continue")',
    'button:has-text("Agree")',
].join(', ');
async function clickIfVisible(page, selector) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
        return false;
    }
    await locator.click();
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
        .locator('input[name="surname"], input[name="givenName"], input[name="passportNo"], select[name="sex"]')
        .count();
    return formFields > 0;
}
async function navigateToZzuApplication(page, formUrl) {
    await page.goto(MEMBER_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    if (await isWizardStep(page)) {
        return;
    }
    await clickIfVisible(page, NAV_APPLICATION);
    await clickIfVisible(page, START_APPLICATION);
    await clickIfVisible(page, EDIT_APPLICATION);
    await clickIfVisible(page, AGREE_SELECTORS);
    if (!(await isWizardStep(page)) && !page.url().includes('/apply/')) {
        const formLink = page
            .locator(`a[href="${formUrl}"], a[href*="apply/index.do"]`)
            .first();
        if ((await formLink.count()) > 0) {
            await formLink.click();
            await page
                .waitForLoadState('networkidle', { timeout: 60_000 })
                .catch(() => undefined);
        }
    }
    if (!(await isWizardStep(page))) {
        await clickIfVisible(page, EDIT_APPLICATION);
        await clickIfVisible(page, AGREE_SELECTORS);
    }
    if (!(await isWizardStep(page)) && !page.url().includes('/apply/')) {
        await page.goto(formUrl, {
            waitUntil: 'networkidle',
            timeout: 60_000,
            referer: MEMBER_URL,
        });
        await clickIfVisible(page, EDIT_APPLICATION);
        await clickIfVisible(page, AGREE_SELECTORS);
    }
}
//# sourceMappingURL=zzu-navigation.js.map