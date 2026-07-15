import { FORM_URL, MEMBER_URL, isCsrfBlocked, isLoginPage } from './zzu-session-utils.mjs';
import {
  advancePreWizardScreen,
  advanceThroughPreWizard,
  detectPreWizardScreen,
  fillPreWizardScreen,
  isMainWizard,
} from './zzu-pre-wizard.mjs';

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

const AGREE_CHECKBOX = [
  'label:has-text("I have carefully read") input[type="checkbox"]',
  'label:has-text("application instructions") input[type="checkbox"]',
  'input[type="checkbox"]',
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
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
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
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
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
  } else {
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
      const agree = buttons.find((button) =>
        /agree and continue/i.test(button.textContent ?? ''),
      );
      return Boolean(agree && !agree.disabled);
    }, { timeout: 10_000 })
    .catch(() => undefined);

  await agreeButton.click({ force: true });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  return true;
}

async function isWizardStep(page) {
  if (await isMainWizard(page)) {
    return true;
  }

  if (await detectPreWizardScreen(page)) {
    return false;
  }

  const formFields = await page
    .locator(
      'input[name="apply.lastName"], input[name="apply.givenName"], input[name="passportNo"], select[name="apply.sex"]',
    )
    .count();

  return formFields > 0;
}

async function selectNextOption(page) {
  const screen = await detectPreWizardScreen(page);
  if (screen === 'program_type') {
    await fillPreWizardScreen(page, screen);
    return advancePreWizardScreen(page, screen);
  }

  const bodyText = await page.locator('body').innerText();
  if (!/please choose your (program|type)/i.test(bodyText)) {
    return false;
  }

  await fillPreWizardScreen(page, 'program_type');
  return advancePreWizardScreen(page, 'program_type');
}

async function advanceIntermediateSteps(page) {
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
      await selectNextOption(page);
      continue;
    }

    if (/application notes|application instructions/i.test(bodyText)) {
      await fillPreWizardScreen(page, 'application_notes');
      await acceptApplicationNotes(page);
      continue;
    }

    if (await detectPreWizardScreen(page)) {
      await advancePreWizardScreen(page);
      continue;
    }

    break;
  }

  return isWizardStep(page);
}

async function advanceToWizard(page, formUrl) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await advanceIntermediateSteps(page)) {
      return;
    }

    await clickEditApplication(page);
    if (await advanceIntermediateSteps(page)) {
      return;
    }
  }

  if (!(await isWizardStep(page)) && !page.url().includes('/apply/')) {
    const formLink = page.locator(`a[href="${formUrl}"], a[href*="apply/index.do"]`).first();
    if ((await formLink.count()) > 0) {
      await formLink.click();
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
      await advanceIntermediateSteps(page);
    }
  }
}

export async function navigateToZzuWizard(
  page,
  formUrl = FORM_URL,
  { fromCurrentPage = false, replayMode = false, advancePreWizard = true } = {},
) {
  if (!fromCurrentPage) {
    if (replayMode) {
      await page.goto(formUrl, {
        waitUntil: 'networkidle',
        timeout: 60_000,
        referer: MEMBER_URL,
      });
    } else {
      await page.goto(MEMBER_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    }
  }

  await assertAuthenticated(page);

  if (await isWizardStep(page)) {
    return page.url();
  }

  const onApplySection = page.url().includes('/apply/');
  if (!onApplySection) {
    await clickIfVisible(page, NAV_APPLICATION);
    await clickIfVisible(page, START_APPLICATION);
  }

  await advanceToWizard(page, formUrl);
  if (advancePreWizard) {
    await advanceThroughPreWizard(page);
  }

  await assertAuthenticated(page);
  return page.url();
}

async function assertAuthenticated(page) {
  if (await isLoginPage(page)) {
    throw new Error('LOGIN_PAGE');
  }

  if (await isCsrfBlocked(page)) {
    throw new Error('CSRF_BLOCKED');
  }
}

export { isWizardStep };
