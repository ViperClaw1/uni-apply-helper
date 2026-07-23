import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
import { resolveProgramHint } from './program-hint.js';
import {
  advanceThroughPreWizard,
  clearStuckProcessing,
  describeNavigationState,
  detectPreWizardScreen,
  isMainWizard,
} from './zzu-pre-wizard.js';

function memberUrlFromForm(formUrl: string): string {
  return `${new URL(formUrl).origin}/member/index.do`;
}

const NAV_APPLICATION = [
  'a:has-text("Application"):not(:has-text("Status"))',
  'a[href*="apply"]:has-text("Application")',
].join(', ');

const START_APPLICATION = [
  'a:has-text("Start Application")',
  'button:has-text("Start Application")',
  'input[value="Start Application"]',
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
    .waitForLoadState('networkidle', { timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
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
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
  }

  return clickIfVisible(page, EDIT_APPLICATION, { force: true });
}

async function isWizardStep(page: Page): Promise<boolean> {
  return isMainWizard(page);
}

async function advanceIntermediateSteps(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  for (let step = 0; step < 10; step += 1) {
    if (await isWizardStep(page)) {
      return true;
    }

    // Prefer DOM detection over body-text heuristics (KMMC / 17gz).
    if (await detectPreWizardScreen(page)) {
      const advanced = await advanceThroughPreWizard(page, programHint);
      if (advanced || (await isWizardStep(page))) {
        return true;
      }
      // Still on a pre-wizard screen that didn't advance — stop spinning.
      if (await detectPreWizardScreen(page)) {
        return false;
      }
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
  programHint?: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await advanceIntermediateSteps(page, programHint)) {
      return;
    }

    await clickIfVisible(page, START_APPLICATION, { force: true });
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

export async function navigateToZzuApplication(
  page: Page,
  formUrl: string,
  profile?: StudentProfile,
  universityId = 'zhengzhou-university',
  defaultProgram?: string,
): Promise<void> {
  const programHint =
    (profile ? resolveProgramHint(profile, universityId) : undefined) ??
    defaultProgram;

  await page.goto(formUrl, {
    waitUntil: 'networkidle',
    timeout: 60_000,
    referer: memberUrlFromForm(formUrl),
  });

  await clearStuckProcessing(page);

  if (await isWizardStep(page)) {
    return;
  }

  // Always try start/edit even when already on /apply/ — list and wizard share path.
  await clickIfVisible(page, NAV_APPLICATION);
  await clickIfVisible(page, START_APPLICATION, { force: true });
  await clickEditApplication(page);

  await advanceToWizard(page, formUrl, programHint);

  // Final sweep through any remaining pre-wizard screens.
  if (!(await isWizardStep(page))) {
    await advanceThroughPreWizard(page, programHint);
  }

  if (!(await isWizardStep(page))) {
    const shotPath = `nav-stuck-${universityId}-${Date.now()}.png`;
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => undefined);
    const diagnostics = await describeNavigationState(page).catch(
      () => 'diagnostics unavailable',
    );

    throw new Error(
      '17gz wizard Step 1 (Basic Info) not reached after navigation. ' +
        `URL: ${page.url()}. Screenshot: ${shotPath}. ${diagnostics}`,
    );
  }
}
