import type { Page } from 'playwright';
import type { StudentProfile } from '@uni-apply/shared';
import { resolveProgramHint } from './program-hint.js';
import {
  isLnpuFormUrl,
  LOGIN_URL,
  MEMBER_URL,
  MY_APPLICATION_URL,
  originFromFormUrl,
} from './cucas-constants.js';

const APPLY_NOW = [
  'a[href*="/student/apply/index"]',
  'a:has-text("APPLY NOW")',
  'span.shenqingbtn a:has-text("APPLY NOW")',
].join(', ');

/** Unfinished draft — CUCAS uses lowercase "continue" + class b_continue. */
const CONTINUE_FORM = [
  'a.b_continue[href*="apply_forms"]',
  'a[href*="apply_forms"][href*="apply_id"]',
  'a.b_continue:has-text("continue")',
  'a:has-text("Edit")',
  'a:has-text("Continue")',
  'a:has-text("Modify")',
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

  if (!(await locator.isVisible().catch(() => false)) && !force) {
    return false;
  }

  await waitForUiReady(page);
  await locator.click({ force: true });
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

function isApplyFormsUrl(url: string): boolean {
  return /\/student\/apply_forms(\/|\?|$)/i.test(url);
}

function isHomeNoticeUrl(url: string): boolean {
  return /\/student\/index\/home_notice/i.test(url);
}

/** True when Application Form fields are on screen. */
async function isApplicationForm(page: Page): Promise<boolean> {
  const n = await page
    .locator(
      'input[name="student[last_name]"], input[name="passport[number]"]',
    )
    .count();

  if (n > 0) {
    return true;
  }

  // URL alone is not enough — wait briefly if we just landed on apply_forms
  if (isApplyFormsUrl(page.url())) {
    await page
      .locator('input[name="student[last_name]"]')
      .first()
      .waitFor({ state: 'attached', timeout: 8_000 })
      .catch(() => undefined);
    return (
      (await page
        .locator(
          'input[name="student[last_name]"], input[name="passport[number]"]',
        )
        .count()) > 0
    );
  }

  return false;
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

async function waitForApplicationList(page: Page): Promise<void> {
  // DataTables loads unfinished rows via AJAX — wait until processing hides.
  await page
    .locator('#example_processing')
    .first()
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => undefined);

  await page
    .waitForFunction(
      () =>
        document.querySelector(
          'a.b_continue, a[href*="apply_forms"], a[href*="/student/apply/index"], td.dataTables_empty',
        ) !== null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

async function hasUnfinishedContinue(page: Page): Promise<boolean> {
  return (
    (await page.locator('a.b_continue[href*="apply_forms"], a[href*="apply_forms"][href*="apply_id"]').count()) >
    0
  );
}

/**
 * Once-per-semester gate: APPLY NOW redirects here when a draft already exists.
 * Return → My Application and resume via continue.
 */
async function dismissHomeNotice(page: Page, myAppUrl: string): Promise<boolean> {
  if (!isHomeNoticeUrl(page.url())) {
    return false;
  }

  const returned = await clickIfVisible(
    page,
    'a[href*="/student/index/all"], span.shenqingbtn a, a:has-text("Return"), a:has-text("RETURN")',
    { force: true },
  );

  if (!returned || isHomeNoticeUrl(page.url())) {
    await page.goto(myAppUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  await waitForApplicationList(page);
  return true;
}

/**
 * Last-resort: discover apply_id from CUCAS check endpoint / page scripts
 * when DataTables list is empty but a draft still blocks APPLY NOW.
 */
async function resumeByDiscoveredApplyId(
  page: Page,
  origin: string,
): Promise<boolean> {
  const applyId = await page.evaluate(async () => {
    const html = document.documentElement.outerHTML;
    const fromHtml = html.match(/apply_id=([A-Za-z0-9]+)/i)?.[1];
    if (fromHtml && fromHtml !== 'test') {
      return fromHtml;
    }

    try {
      const res = await fetch('/en/student/index/ajax_data?test=test&fun=all', {
        credentials: 'same-origin',
      });
      const json = (await res.json()) as {
        data?: Array<{ apply_id?: string | number; id?: string | number }>;
      };
      const row = Array.isArray(json.data) ? json.data[0] : undefined;
      if (row?.apply_id != null) {
        return String(row.apply_id);
      }
      if (row?.id != null) {
        return String(row.id);
      }
    } catch {
      // ignore
    }

    return null;
  });

  if (!applyId) {
    return false;
  }

  // CUCAS sometimes uses base64 apply_id in URLs (OTg4NDg), sometimes numeric.
  const candidates = [
    `${origin}/en/student/apply_forms?apply_id=${applyId}&is_show=2`,
    `${origin}/en/student/apply_forms/index?apply_id=${applyId}`,
  ];

  for (const url of candidates) {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    if (await isApplicationForm(page)) {
      return true;
    }
  }

  return false;
}

/**
 * Program list: prefer row matching programHint, else first apply_now(id).
 */
async function clickApplyNowOnProgram(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  if (isHomeNoticeUrl(page.url())) {
    return false;
  }

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

async function resumeUnfinishedApplication(page: Page): Promise<boolean> {
  await waitForApplicationList(page);

  if (!(await hasUnfinishedContinue(page))) {
    return false;
  }

  const href = await page
    .locator(
      'a.b_continue[href*="apply_forms"], a[href*="apply_forms"][href*="apply_id"]',
    )
    .first()
    .getAttribute('href');

  if (href) {
    const target = href.startsWith('http')
      ? href
      : new URL(href, page.url()).href;
    await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  } else if (!(await clickIfVisible(page, CONTINUE_FORM, { force: true }))) {
    return false;
  }

  await dismissDialogs(page);
  return isApplicationForm(page);
}

async function openExistingOrNewApplication(
  page: Page,
  origin: string,
  myAppUrl: string,
  programHint?: string,
): Promise<void> {
  await waitForApplicationList(page);

  // Prefer unfinished draft — LNPU allows only one application per semester.
  if (await resumeUnfinishedApplication(page)) {
    return;
  }

  if (await advanceFromStartScreen(page)) {
    return;
  }

  // No draft → APPLY NOW → program list (may bounce to home_notice)
  if (!/\/student\/apply\/index/i.test(page.url())) {
    await clickIfVisible(page, APPLY_NOW, { force: true });
  }

  if (await dismissHomeNotice(page, myAppUrl)) {
    if (await resumeUnfinishedApplication(page)) {
      return;
    }
    if (await resumeByDiscoveredApplyId(page, origin)) {
      return;
    }
  }

  if (!/\/student\/apply\/index/i.test(page.url())) {
    await page.goto(`${origin}/en/student/apply/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  if (await dismissHomeNotice(page, myAppUrl)) {
    if (await resumeUnfinishedApplication(page)) {
      return;
    }
    await resumeByDiscoveredApplyId(page, origin);
    return;
  }

  await clickApplyNowOnProgram(page, programHint);
  await dismissDialogs(page);

  if (await dismissHomeNotice(page, myAppUrl)) {
    if (await resumeUnfinishedApplication(page)) {
      return;
    }
    await resumeByDiscoveredApplyId(page, origin);
    return;
  }

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

  // Start from My Application when a draft may already exist.
  // Going straight to apply/index hits once-per-semester home_notice.
  await page.goto(myAppUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
    referer: memberUrl,
  });

  if (await isLoginPage(page)) {
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    return;
  }

  if (await isApplicationForm(page)) {
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
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

    if (await dismissHomeNotice(page, myAppUrl)) {
      if (await resumeUnfinishedApplication(page)) {
        return;
      }
      if (await resumeByDiscoveredApplyId(page, origin)) {
        return;
      }
      continue;
    }

    if (await advanceFromStartScreen(page)) {
      return;
    }

    if (isApplyFormsUrl(page.url())) {
      if (await isApplicationForm(page)) {
        return;
      }
    }

    const url = page.url();
    if (
      /\/student\/index\/(all|unfinished)|\/student\/index\/?$/i.test(url)
    ) {
      await openExistingOrNewApplication(
        page,
        origin,
        myAppUrl,
        programHint,
      );
      continue;
    }

    if (/\/student\/apply\/index/i.test(url)) {
      // If notice-redirected mid-loop
      if (await dismissHomeNotice(page, myAppUrl)) {
        await resumeUnfinishedApplication(page);
        continue;
      }

      // Prefer resume over creating a second application
      await page.goto(myAppUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      if (await resumeUnfinishedApplication(page)) {
        return;
      }

      await page.goto(`${origin}/en/student/apply/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      if (await dismissHomeNotice(page, myAppUrl)) {
        await resumeUnfinishedApplication(page);
        continue;
      }

      await clickApplyNowOnProgram(page, programHint);
      await dismissDialogs(page);
      if (/\/student\/apply\/start/i.test(page.url())) {
        await clickNext(page);
      }
      continue;
    }

    // Unknown page — My Application
    await page.goto(myAppUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await openExistingOrNewApplication(page, origin, myAppUrl, programHint);
  }

  if (!(await isApplicationForm(page))) {
    throw new Error(
      `CUCAS Application Form not reached. URL: ${page.url()}. ` +
        'Expected /en/student/apply_forms with student[last_name]. ' +
        'If home_notice appeared, resume unfinished via a.b_continue (one application per semester).',
    );
  }
}
