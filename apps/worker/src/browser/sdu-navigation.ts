import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
import { resolveProgramHint } from './program-hint.js';
import { LOGIN_URL, MEMBER_URL } from './sdu-constants.js';

const START_APPLICATION = [
  'a:has-text("Apply")',
  'button:has-text("Apply")',
  'a:has-text("New Application")',
  'button:has-text("New Application")',
  'a:has-text("Create Application")',
  'a[href*="/apply/create"]',
].join(', ');

const EDIT_APPLICATION = [
  'a:has-text("Edit")',
  'button:has-text("Edit")',
  'a:has-text("Continue")',
  'button:has-text("Continue")',
].join(', ');

const AGREE_SELECTORS = [
  'button:has-text("Agree")',
  'button:has-text("Accept")',
  'button:has-text("I Agree")',
  'input[value="Agree"]',
  'input[value="Accept"]',
].join(', ');

export function isSduFormUrl(formUrl: string): boolean {
  return /apply\.sdu\.edu\.cn/i.test(formUrl);
}

async function waitForUiReady(page: Page): Promise<void> {
  await page
    .locator('.modal-backdrop, .loading, .el-loading-mask')
    .first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

async function clickIfVisible(
  page: Page,
  selector: string,
  { force = false } = {},
): Promise<boolean> {
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

async function isLoginPage(page: Page): Promise<boolean> {
  if (/\/login|\/register/i.test(page.url())) {
    return true;
  }

  const bodyText = await page.locator('body').innerText();
  return /sign in|log in|student login/i.test(bodyText);
}

async function isApplicationForm(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText();

  if (/personal information|basic information|education background/i.test(bodyText)) {
    return true;
  }

  if (/save and next|next step|submit application/i.test(bodyText)) {
    return true;
  }

  const formFields = await page
    .locator('input[name], select[name], textarea[name]')
    .count();

  return formFields >= 3 && /\/apply\//i.test(page.url());
}

async function acceptAgreement(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText();
  if (!/agreement|terms|declaration|i have read/i.test(bodyText)) {
    return false;
  }

  const checkbox = page.locator('input[type="checkbox"]').first();
  if ((await checkbox.count()) > 0) {
    await checkbox.check({ force: true }).catch(() => undefined);
  }

  return clickIfVisible(page, AGREE_SELECTORS, { force: true });
}

async function selectProgram(page: Page, programHint?: string): Promise<boolean> {
  const bodyText = await page.locator('body').innerText();
  if (!/choose|select.*program|major|degree/i.test(bodyText)) {
    return false;
  }

  if (programHint) {
    const match = page.getByText(programHint, { exact: false }).first();
    if ((await match.count()) > 0) {
      await match.click({ force: true });
    }
  }

  const selected = page.locator('input[type="radio"]:checked, .active');
  if ((await selected.count()) === 0) {
    const option = page.locator('input[type="radio"], .radio, label').first();
    if ((await option.count()) > 0) {
      await option.click({ force: true });
    }
  }

  await page.waitForTimeout(400);
  return clickIfVisible(page, 'button:has-text("Next"), input[value="Next"]', {
    force: true,
  });
}

async function advanceIntermediateSteps(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  for (let step = 0; step < 8; step += 1) {
    if (await isApplicationForm(page)) {
      return true;
    }

    if (await isLoginPage(page)) {
      return false;
    }

    const bodyText = await page.locator('body').innerText();

    if (/application list|my application|application status/i.test(bodyText)) {
      await clickIfVisible(page, EDIT_APPLICATION, { force: true });
      continue;
    }

    if (/choose|select.*program|major/i.test(bodyText)) {
      await selectProgram(page, programHint);
      continue;
    }

    if (/agreement|terms|declaration/i.test(bodyText)) {
      await acceptAgreement(page);
      continue;
    }

    break;
  }

  return isApplicationForm(page);
}

export async function navigateToSduApplication(
  page: Page,
  formUrl: string,
  profile?: StudentProfile,
  universityId = 'shandong-university',
): Promise<void> {
  const programHint = profile
    ? resolveProgramHint(profile, universityId)
    : undefined;

  await page.goto(formUrl, {
    waitUntil: 'networkidle',
    timeout: 60_000,
    referer: MEMBER_URL,
  });

  if (await isApplicationForm(page)) {
    return;
  }

  if (await isLoginPage(page)) {
    await page.goto(LOGIN_URL, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    return;
  }

  if (!page.url().includes('/apply/')) {
    await clickIfVisible(page, START_APPLICATION);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await advanceIntermediateSteps(page, programHint)) {
      return;
    }

    await clickIfVisible(page, EDIT_APPLICATION, { force: true });
    if (await advanceIntermediateSteps(page, programHint)) {
      return;
    }
  }
}
