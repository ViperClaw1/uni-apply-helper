import { resolve } from 'node:path';
import { isWizardStep, navigateToZzuWizard } from './zzu-navigation.mjs';
import { isCsrfBlocked, isLoginPage } from './zzu-session-utils.mjs';

export async function verifyZzuWizard(page, { fromCurrentPage = false, replayMode = false } = {}) {
  try {
    await navigateToZzuWizard(page, undefined, { fromCurrentPage, replayMode });
  } catch (error) {
    if (error instanceof Error && error.message === 'LOGIN_PAGE') {
      return { ok: false, reason: 'login' };
    }

    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return { ok: false, reason: 'csrf' };
    }

    throw error;
  }

  if (await isLoginPage(page)) {
    return { ok: false, reason: 'login' };
  }

  if (await isCsrfBlocked(page)) {
    return { ok: false, reason: 'csrf' };
  }

  const bodyText = await page.locator('body').innerText();
  const onWizard = await isWizardStep(page);
  const hasBasicInfo =
    /basic info(rmation)?/i.test(bodyText) ||
    (await page.getByText(/basic info(rmation)?/i).count()) > 0;
  const hasStep1 =
    /step\s*1/i.test(bodyText) || (await page.getByText(/step\s*1/i).count()) > 0;
  const hasSaveAndNext =
    /save and next/i.test(bodyText) ||
    (await page.getByText(/save and next/i).count()) > 0;

  const screenshotPath = resolve(process.cwd(), 'dry-run-open-form.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    ok: onWizard,
    reason: onWizard ? 'wizard' : 'dashboard',
    url: page.url(),
    title: await page.title(),
    hasBasicInfo,
    hasStep1,
    hasSaveAndNext,
    screenshotPath,
  };
}

export function printVerifyResult(result) {
  if (result.url) console.log(`Final URL: ${result.url}`);
  if (result.title) console.log(`Page title: ${result.title}`);
  if (result.hasBasicInfo !== undefined) {
    console.log(`Basic Info visible: ${result.hasBasicInfo}`);
  }
  if (result.hasStep1 !== undefined) {
    console.log(`Step 1 visible: ${result.hasStep1}`);
  }
  if (result.hasSaveAndNext !== undefined) {
    console.log(`Save and Next visible: ${result.hasSaveAndNext}`);
  }
  if (result.screenshotPath) console.log(`Screenshot: ${result.screenshotPath}`);

  if (result.ok) {
    console.log('OK: wizard Step 1 loaded');
    return;
  }

  if (result.reason === 'csrf') {
    console.error('FAIL: CSRF protection triggered');
    return;
  }

  if (result.reason === 'login') {
    console.error('FAIL: login page detected');
    return;
  }

  console.warn('WARN: landed on dashboard, not wizard — check screenshot (may need Edit click)');
}
