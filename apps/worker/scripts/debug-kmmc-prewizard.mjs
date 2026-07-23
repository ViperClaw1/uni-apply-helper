/**
 * Auto-debug KMMC student_type radio selection.
 *
 *   pnpm debug:kmmc-prewizard
 *
 * Flow:
 * 1. Open apply with session
 * 2. Auto-advance program_type (Self-supporting → Next)
 * 3. On 请选择招生类别 dump DOM + try every check method
 * 4. page.pause() for manual inspection
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';
import {
  getSessionPaths,
  loadUniversitySession,
} from './browser-session.mjs';

function loadWorkerEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadWorkerEnvFile();

const FORM_URL = 'http://study.kmmc.cn/apply/index.do';
const MEMBER_URL = 'http://study.kmmc.cn/member/index.do';
const universityId = 'kmmc';

let storageState = loadUniversitySession(universityId);
if (!storageState) {
  const { b64File, sessionFile } = getSessionPaths(universityId);
  if (existsSync(sessionFile)) {
    storageState = JSON.parse(readFileSync(sessionFile, 'utf-8'));
  } else if (existsSync(b64File)) {
    storageState = JSON.parse(
      Buffer.from(readFileSync(b64File, 'utf-8').trim(), 'base64').toString(
        'utf-8',
      ),
    );
  }
}

if (!storageState) {
  console.error('No KMMC session. Run: pnpm capture:kmmc-session');
  process.exit(1);
}

const metaPath = resolve(process.cwd(), 'browser-sessions/kmmc-meta.json');
const meta = existsSync(metaPath)
  ? JSON.parse(readFileSync(metaPath, 'utf-8'))
  : {};

console.log('Launching headed Chromium...');
console.log('cookies:', storageState.cookies?.length ?? 0);
console.log('capturedAt:', meta.capturedAt ?? '?');

const browser = await chromium.launch({
  headless: false,
  slowMo: 150,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1200 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
});

const page = await context.newPage();

// 17gz CSRF: cold goto apply/index.do without member Referer → fake "session dead"
await page.goto(FORM_URL, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
  referer: MEMBER_URL,
});
await page.waitForTimeout(1500);

let body = await page.locator('body').innerText();
console.log('URL:', page.url());
console.log('Body:', body.replace(/\s+/g, ' ').slice(0, 220));

if (/CSRF|操作被拒绝|Sign out/i.test(body)) {
  console.error('SESSION DEAD — pnpm capture:kmmc-session');
  if (process.env.DEBUG_PAUSE === '1') await page.pause();
  await browser.close();
  process.exit(1);
}

async function detectScreen() {
  return page.evaluate(() => {
    const body = (document.body?.innerText ?? '').replace(/\s+/g, ' ');
    const isShown = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      return el.getClientRects().length > 0;
    };

    const radios = [...document.querySelectorAll('input[type="radio"]')].filter(
      isShown,
    );
    const labels = radios.map(
      (r) =>
        (
          r.closest('label')?.textContent ||
          r.nextSibling?.textContent ||
          r.parentElement?.textContent ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40),
    );

    const agreeVisible = [...document.querySelectorAll('[name="agree"]')].some(
      isShown,
    );
    const agreeBtn = [...document.querySelectorAll('button, input[type="button"]')].find(
      (el) =>
        isShown(el) &&
        /agree and continue|同意并继续/i.test(el.value || el.textContent || ''),
    );

    // Notes/agree wins when its controls are actually on screen
    if (agreeVisible || agreeBtn) {
      return {
        screen: 'application_notes',
        radios: radios.length,
        labels,
        note: 'agree control visible',
      };
    }

    if (
      /please choose your type|请选择招生类别/i.test(body) ||
      labels.some((l) => /本科生|博士研究生|Undergraduate|Doctoral/i.test(l)) ||
      radios.length >= 5
    ) {
      return { screen: 'student_type', radios: radios.length, labels };
    }

    if (
      (/please choose your program|请选择.*项目/i.test(body) && radios.length > 0) ||
      labels.some((l) => /self-supporting|Scholarship|自费|奖学金/i.test(l))
    ) {
      return { screen: 'program_type', radios: radios.length, labels };
    }

    // Body has affirm text but no visible agree — ignore leftover copy
    if (radios.length > 0) {
      return { screen: 'unknown_radios', radios: radios.length, labels };
    }

    return { screen: 'unknown', radios: 0, labels };
  });
}

async function pickProgramSelfSupporting() {
  // Only click if Playwright considers it visible — hidden leftover labels crash even with force on some builds
  const byText = page.getByText(/self-supporting\s*Program/i).first();
  try {
    if ((await byText.count()) > 0 && (await byText.isVisible().catch(() => false))) {
      await byText.click({ force: true });
      const checked = await page
        .locator('input[name="projectTypeId"]:checked')
        .count();
      if (checked > 0) {
        return { ok: true, method: 'playwright_text' };
      }
    }
  } catch (error) {
    console.log(
      'playwright_text click failed:',
      error instanceof Error ? error.message : error,
    );
  }

  return page.evaluate(() => {
    const isShown = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return el.getClientRects().length > 0;
    };

    const radios = [
      ...document.querySelectorAll('input[name="projectTypeId"]'),
    ].filter(isShown);

    const labelOf = (r) =>
      (
        r.closest('label')?.textContent ||
        r.nextSibling?.textContent ||
        ''
      ).trim();

    const target =
      radios.find((r) => /self-supporting|自费/i.test(labelOf(r))) || radios[0];
    if (!target) return { ok: false, reason: 'no visible radios' };

    const label = target.closest('label');
    if (label && isShown(label)) {
      label.click();
      if (target.checked) return { ok: true, method: 'label', value: target.value };
    }

    target.click();
    if (target.checked) return { ok: true, method: 'click', value: target.value };

    for (const r of document.querySelectorAll('input[name="projectTypeId"]')) {
      r.checked = false;
    }
    target.checked = true;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      ok: target.checked,
      method: 'force',
      value: target.value,
    };
  });
}

async function clickNext() {
  const btn = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
  if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
    await btn.click({ force: true });
    console.log('clickNext → button');
    await page.waitForTimeout(2000);
    return 'button';
  }

  const input = page
    .locator('input[value="Next"], input[value="下一步"]')
    .first();
  if ((await input.count()) > 0) {
    await input.click({ force: true });
    console.log('clickNext → input');
    await page.waitForTimeout(2000);
    return 'input';
  }

  console.log('clickNext → NOT FOUND');
  return null;
}

// DOM-driven advance loop → student_type
for (let step = 0; step < 8; step += 1) {
  const detected = await detectScreen();
  console.log(`\n--- step ${step}: ${detected.screen} (radios=${detected.radios}) ---`);
  console.log('labels:', detected.labels);

  if (detected.screen === 'student_type') {
    break;
  }

  if (detected.screen === 'program_type' || detected.screen === 'unknown_radios') {
    const picked = await pickProgramSelfSupporting();
    console.log('pick program:', picked);
    const checked = await page.evaluate(
      () =>
        [...document.querySelectorAll('input[name="projectTypeId"]')].map((r) => ({
          v: r.value,
          c: r.checked,
          t: (r.closest('label')?.textContent || r.nextSibling?.textContent || '')
            .trim()
            .slice(0, 40),
        })),
    );
    console.log('radios after pick:', checked);

    if (!checked.some((r) => r.c)) {
      console.error('PROGRAM RADIO STILL UNCHECKED — stopping for Inspector');
      await page.pause();
      break;
    }

    await clickNext();
    continue;
  }

  if (detected.screen === 'application_notes') {
    console.log('agree / continue');
    await page.evaluate(() => {
      const agree = document.querySelector('[name="agree"]');
      if (agree && !agree.checked) agree.click();
    });
    const agreeBtn = page
      .getByRole('button', { name: /agree and continue|同意/i })
      .first();
    if ((await agreeBtn.count()) > 0) {
      await agreeBtn.click({ force: true });
    } else {
      await clickNext();
    }
    await page.waitForTimeout(1500);
    continue;
  }

  // unknown — try Start/Edit then Next
  console.log('unknown screen, trying Start/Edit/Next');
  await page.evaluate(() => {
    const btn = [
      ...document.querySelectorAll('a, button, input[type="button"]'),
    ].find((el) =>
      /start application|edit|开始|编辑/i.test(el.value || el.textContent || ''),
    );
    btn?.click();
  });
  await page.waitForTimeout(1500);
  await clickNext();
}

body = await page.locator('body').innerText();
const onStudent =
  /请选择招生类别|choose your type/i.test(body) ||
  (await page.locator('input[type="radio"]').count()) >= 5;

if (!onStudent) {
  console.log('\nNot on student_type yet. Dumping radios:');
  console.log(
    await page.evaluate(() =>
      [...document.querySelectorAll('input[type="radio"]')].map((r) => ({
        name: r.name,
        value: r.value,
        checked: r.checked,
        label: (r.closest('label') || r.parentElement)?.textContent
          ?.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 50),
      })),
    ),
  );
  console.log('Manual: get to 请选择招生类别 then resume.');
  await page.pause();
}

body = await page.locator('body').innerText();
console.log('\n========== STUDENT_TYPE: pick + Next ==========');
console.log('Body:', body.replace(/\s+/g, ' ').slice(0, 260));

// Proven path from probe: label click on Undergraduate Student
const undergrad = page.getByText('Undergraduate Student', { exact: false }).first();
if ((await undergrad.count()) > 0 && (await undergrad.isVisible().catch(() => false))) {
  await undergrad.click({ force: true });
  console.log('clicked: Undergraduate Student (playwright text)');
} else {
  const zh = page.getByText('本科生', { exact: false }).first();
  if ((await zh.count()) > 0) {
    await zh.click({ force: true });
    console.log('clicked: 本科生');
  } else {
    await page.evaluate(() => {
      const radios = [...document.querySelectorAll('input[name="projectTypeId"]')];
      const target =
        radios.find((r) =>
          /Undergraduate|本科生/i.test(r.closest('label')?.textContent || ''),
        ) || radios[0];
      target?.closest('label')?.click();
    });
    console.log('clicked: label via evaluate');
  }
}

const checkedAfter = await page.evaluate(() =>
  [...document.querySelectorAll('input[name="projectTypeId"]')]
    .filter((r) => r.checked)
    .map((r) => ({
      value: r.value,
      label: (r.closest('label')?.textContent || '').trim(),
    })),
);
console.log('checked after pick:', checkedAfter);

const nextInfo = await page.evaluate(() => {
  const next = document.querySelector(
    'input[value="Next"], input[value="下一步"]',
  );
  return next
    ? {
        tag: next.tagName,
        type: next.type,
        value: next.value,
        onclick: next.getAttribute('onclick'),
        disabled: next.disabled,
      }
    : null;
});
console.log('Next button:', nextInfo);

// Student-type Next is input onclick=saveProjectType(this.form)
const nextInput = page.locator('input[value="Next"], input[value="下一步"]').first();
if ((await nextInput.count()) > 0) {
  await nextInput.click({ force: true });
  console.log('clickNext → input saveProjectType');
} else {
  await clickNext();
}
await page.waitForTimeout(2500);

const afterBody = (await page.locator('body').innerText())
  .replace(/\s+/g, ' ')
  .slice(0, 300);
console.log('\n========== AFTER student_type Next ==========');
console.log('URL:', page.url());
console.log('Body:', afterBody);
console.log(
  'step1 fields:',
  await page.evaluate(() => ({
    lastName: Boolean(document.querySelector('input[name="apply.lastName"]')),
    college: Boolean(document.querySelector('select[name="collegeId"]')),
    radios: document.querySelectorAll('input[type="radio"]').length,
  })),
);

if (process.env.DEBUG_PAUSE === '1') {
  console.log('\nInspector open — inspect / resume to quit.');
  await page.pause();
} else {
  console.log('\nDone (set DEBUG_PAUSE=1 for Inspector).');
  await page.waitForTimeout(1500);
}

await browser.close();
