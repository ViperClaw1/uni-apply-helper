import type { Page } from 'playwright';
import type { NavigationHints, StudentProfile } from '@uni-apply/shared';
import { SessionExpiredError } from '../errors/session-expired.error.js';
import { resolveProgramHint } from './program-hint.js';
import { isCsrfBlocked, isLoginPage, isLoginRedirect } from './zzu-session.loader.js';
import {
  advanceThroughPreWizard,
  clearStuckProcessing,
  describeNavigationState,
  detectPreWizardScreen,
  getLastStudentTypePickDiag,
  isMainWizard,
  type PreWizardHints,
  type StudyPlanMatcher,
} from './zzu-pre-wizard.js';

export function applyUrlFromForm(formUrl: string): string {
  return `${new URL(formUrl).origin}/apply/index.do`;
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

async function waitForUiReady(page: Page): Promise<void> {
  await page
    .locator('.window-mask, .el-loading-mask')
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
    .waitForLoadState('domcontentloaded', { timeout: 12_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
  return true;
}

async function clickEditApplication(page: Page): Promise<boolean> {
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

async function isWizardStep(page: Page): Promise<boolean> {
  return isMainWizard(page);
}

async function advanceIntermediateSteps(
  page: Page,
  hints?: PreWizardHints,
  gemini?: StudyPlanMatcher,
): Promise<boolean> {
  for (let step = 0; step < 4; step += 1) {
    if (await isWizardStep(page)) {
      return true;
    }

    // Prefer DOM detection over body-text heuristics (KMMC / 17gz).
    if (await detectPreWizardScreen(page)) {
      const advanced = await advanceThroughPreWizard(page, hints, {
        gemini,
        deadlineMs: 90_000,
      });
      if (advanced || (await isWizardStep(page))) {
        return true;
      }
      // Pre-wizard exhausted — don't nest another 90s loop on the same screens.
      return false;
    }

    const bodyText = await page.locator('body').innerText();

    if (
      /application status|application list|my application|start application/i.test(
        bodyText,
      )
    ) {
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

async function advanceToWizard(
  page: Page,
  formUrl: string,
  hints?: PreWizardHints,
  gemini?: StudyPlanMatcher,
): Promise<void> {
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

export async function navigateToZzuApplication(
  page: Page,
  formUrl: string,
  profile?: StudentProfile,
  universityId = 'zhengzhou-university',
  defaultProgram?: string,
  navigationHints?: NavigationHints,
  gemini?: StudyPlanMatcher,
): Promise<void> {
  const studyPlanHint =
    (profile ? resolveProgramHint(profile, universityId) : undefined) ??
    defaultProgram;

  const hints: PreWizardHints = {
    programText: navigationHints?.programText ?? defaultProgram,
    studentType: navigationHints?.studentType,
    studyPlanHint,
  };

  await page.goto(formUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
    // /member/index.do is a signin gateway, not the authenticated dashboard — sending it as
    // the referer looks like an unauthenticated hop and trips the platform's Referer-based
    // CSRF guard on its own. /apply/index.do is the wizard itself, the legitimate in-app referer.
    referer: applyUrlFromForm(formUrl),
  });

  // Fail fast — don't burn 10m clicking around a login wall
  if (isLoginRedirect(page.url())) {
    throw new SessionExpiredError(
      `Session expired for ${universityId}`,
      universityId,
    );
  }
  if (await isLoginPage(page)) {
    throw new SessionExpiredError(
      `Login form detected — session expired for ${universityId}`,
      universityId,
    );
  }
  if (await isCsrfBlocked(page)) {
    throw new SessionExpiredError(
      `CSRF protection triggered — re-login required for ${universityId}`,
      universityId,
    );
  }

  await clearStuckProcessing(page);

  if (await isWizardStep(page)) {
    return;
  }

  // Always try start/edit even when already on /apply/ — list and wizard share path.
  await clickIfVisible(page, NAV_APPLICATION);
  await clickIfVisible(page, START_APPLICATION, { force: true });
  await clickEditApplication(page);

  await advanceToWizard(page, formUrl, hints, gemini);

  // One more sweep only if still mid pre-wizard — never restart from scratch.
  if (!(await isWizardStep(page))) {
    const screen = await detectPreWizardScreen(page);
    if (screen) {
      await advanceThroughPreWizard(page, hints, { gemini, maxSteps: 6 });
    }
  }

  if (!(await isWizardStep(page))) {
    const shotPath = `nav-stuck-${universityId}-${Date.now()}.png`;
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => undefined);
    const diagnostics = await describeNavigationState(page).catch(
      () => 'diagnostics unavailable',
    );

    throw new Error(
      '17gz wizard not reached after navigation (expected any wizard step). ' +
        `URL: ${page.url()}. Screenshot: ${shotPath}. ${diagnostics}` +
        (getLastStudentTypePickDiag()
          ? ` pickDiag=${JSON.stringify(getLastStudentTypePickDiag())}`
          : ''),
    );
  }
}
