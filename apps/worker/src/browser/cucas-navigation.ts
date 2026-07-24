import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
import { resolveProgramHint } from './program-hint.js';
import {
  isLnpuFormUrl,
  LOGIN_URL,
  MEMBER_URL,
  MY_APPLICATION_URL,
  originFromFormUrl,
  PROGRAM_LIST_URL,
} from './cucas-constants.js';

const APPLY_NOW = [
  'a[href*="/student/apply/index"]',
  'a:has-text("APPLY NOW")',
  'span.shenqingbtn a',
].join(', ');

const EDIT_APPLICATION = [
  'a:has-text("Edit")',
  'a:has-text("Continue")',
  'a:has-text("Modify")',
  'button:has-text("Edit")',
  'a:has-text("完善")',
  'a:has-text("编辑")',
].join(', ');

export function isCucasChiwestUrl(formUrl: string): boolean {
  return /chiwest\.cn/i.test(formUrl);
}

async function waitForUiReady(page: Page): Promise<void> {
  await page
    .locator('.modal-backdrop, .loading, .el-loading-mask, #cucas_dialog')
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

  if (!(await locator.isVisible().catch(() => false))) {
    return false;
  }

  await waitForUiReady(page);
  await locator.click({ force });
  await page
    .waitForLoadState('domcontentloaded', { timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  return true;
}

async function isLoginPage(page: Page): Promise<boolean> {
  if (/\/login|\/register/i.test(page.url())) {
    return true;
  }

  const bodyText = await page.locator('body').innerText();
  return /don't have an account\?\s*sign up|forgot password/i.test(bodyText);
}

/** True when Application Form fields are on screen. */
async function isApplicationForm(page: Page): Promise<boolean> {
  if (/\/apply_forms\//i.test(page.url())) {
    const n = await page
      .locator('input[name="student[last_name]"], input[name="passport[number]"]')
      .count();
    return n > 0;
  }

  const n = await page
    .locator('input[name="student[last_name]"], input[name="passport[number]"]')
    .count();
  return n > 0;
}

async function dismissDialogs(page: Page): Promise<void> {
  for (const sel of [
    '.layui-layer-btn0',
    'button:has-text("OK")',
    'button:has-text("Confirm")',
    'button:has-text("Agree")',
    'input[value="OK"]',
    'input[value="Agree"]',
  ]) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }
}

async function clickNext(page: Page): Promise<boolean> {
  await dismissDialogs(page);
  return clickIfVisible(page, 'input[value="Next"], button:has-text("Next")', {
    force: true,
  });
}

/**
 * Program list: prefer row matching programHint, else first apply_now(id).
 */
async function clickApplyNowOnProgram(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  const applied = await page.evaluate((hint) => {
    const links = [
      ...document.querySelectorAll('a[onclick*="apply_now"]'),
    ] as HTMLAnchorElement[];

    if (!links.length) {
      return false;
    }

    if (hint) {
      const needle = hint.toLowerCase();
      for (const row of document.querySelectorAll('table tbody tr')) {
        const text = (row.textContent || '').toLowerCase();
        if (!text.includes(needle)) {
          continue;
        }
        const a = row.querySelector(
          'a[onclick*="apply_now"]',
        ) as HTMLAnchorElement | null;
        if (a) {
          a.click();
          return true;
        }
      }
    }

    links[0].click();
    return true;
  }, programHint);

  if (!applied) {
    return false;
  }

  await page
    .waitForLoadState('domcontentloaded', { timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1500);
  await dismissDialogs(page);
  return true;
}

async function advanceFromStartScreen(page: Page): Promise<boolean> {
  if (!/\/student\/apply\/start/i.test(page.url())) {
    return false;
  }

  await clickNext(page);
  return isApplicationForm(page);
}

async function openExistingOrNewApplication(
  page: Page,
  origin: string,
  programHint?: string,
): Promise<void> {
  // Prefer unfinished application Edit/Continue
  if (await clickIfVisible(page, EDIT_APPLICATION, { force: true })) {
    await dismissDialogs(page);
    if (await isApplicationForm(page)) {
      return;
    }
    if (await advanceFromStartScreen(page)) {
      return;
    }
  }

  // APPLY NOW → program list
  if (!/\/student\/apply\/index/i.test(page.url())) {
    await clickIfVisible(page, APPLY_NOW, { force: true });
  }

  if (!/\/student\/apply\/index/i.test(page.url())) {
    await page.goto(`${origin}/en/student/apply/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  await clickApplyNowOnProgram(page, programHint);
  await dismissDialogs(page);

  // apply/start confirmation
  if (/\/student\/apply\/start/i.test(page.url())) {
    await clickNext(page);
  }
}

export async function navigateToCucasApplication(
  page: Page,
  formUrl: string,
  profile?: StudentProfile,
  universityId = 'lnpu',
): Promise<void> {
  const origin = originFromFormUrl(formUrl);
  const programHint = profile
    ? resolveProgramHint(profile, universityId)
    : undefined;

  const memberUrl = isLnpuFormUrl(formUrl)
    ? MEMBER_URL
    : `${origin}/en/student/index`;
  const myAppUrl = isLnpuFormUrl(formUrl)
    ? MY_APPLICATION_URL
    : `${origin}/en/student/index/all`;
  const loginUrl = isLnpuFormUrl(formUrl)
    ? LOGIN_URL
    : `${origin}/en/student/login`;
  const programListUrl = isLnpuFormUrl(formUrl)
    ? PROGRAM_LIST_URL
    : `${origin}/en/student/apply/index`;

  // Direct form URL with apply_id already present
  await page.goto(formUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
    referer: memberUrl,
  });

  if (await isApplicationForm(page)) {
    return;
  }

  if (await isLoginPage(page)) {
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    return;
  }

  // Landing on dashboard / my application / program list
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await isApplicationForm(page)) {
      return;
    }

    if (await isLoginPage(page)) {
      await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      return;
    }

    if (await advanceFromStartScreen(page)) {
      return;
    }

    const url = page.url();
    if (/\/student\/index\/all|\/student\/index\/?$/i.test(url)) {
      await openExistingOrNewApplication(page, origin, programHint);
      continue;
    }

    if (/\/student\/apply\/index/i.test(url)) {
      await clickApplyNowOnProgram(page, programHint);
      await dismissDialogs(page);
      if (/\/student\/apply\/start/i.test(page.url())) {
        await clickNext(page);
      }
      continue;
    }

    // Unknown page — go My Application
    await page.goto(myAppUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await openExistingOrNewApplication(page, origin, programHint);
  }

  if (!(await isApplicationForm(page))) {
    // Last resort: program list
    await page.goto(programListUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await clickApplyNowOnProgram(page, programHint);
    await dismissDialogs(page);
    if (/\/student\/apply\/start/i.test(page.url())) {
      await clickNext(page);
    }
  }

  if (!(await isApplicationForm(page))) {
    throw new Error(
      `CUCAS Application Form not reached. URL: ${page.url()}. ` +
        'Expected /en/student/apply_forms/index with student[last_name].',
    );
  }
}
