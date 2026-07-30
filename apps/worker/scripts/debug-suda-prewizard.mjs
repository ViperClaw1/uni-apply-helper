/**
 * Headed step-by-step SUDA (Soochow) pre-wizard debug.
 *
 *   cd apps/worker
 *   pnpm capture:suda-session          # once
 *   node scripts/debug-suda-prewizard.mjs
 *
 * Env:
 *   DEBUG_PAUSE=1   — page.pause() after each step (Playwright inspector)
 *   SLOW_MO=300     — default 200
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const FORM_URL = 'https://suda.17gz.org/apply/index.do';
const MEMBER_URL = 'https://suda.17gz.org/member/index.do';
const universityId = 'suda';
const outDir = resolve(process.cwd(), 'data/captures/suda-debug');
mkdirSync(outDir, { recursive: true });

const pause = process.env.DEBUG_PAUSE === '1';
const slowMo = Number(process.env.SLOW_MO || 200);

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
  console.error('No SUDA session. Run: pnpm --filter worker capture:suda-session');
  process.exit(1);
}

const metaPath = resolve(process.cwd(), 'browser-sessions/suda-meta.json');
const meta = existsSync(metaPath)
  ? JSON.parse(readFileSync(metaPath, 'utf-8'))
  : {};

console.log('=== SUDA pre-wizard DEBUG ===');
console.log('cookies:', storageState.cookies?.length ?? 0);
console.log('slowMo:', slowMo, 'pause:', pause);

const browser = await chromium.launch({
  headless: false,
  slowMo,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1200 },
  locale: 'en-US',
  timezoneId: 'Asia/Shanghai',
  ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
});

const page = await context.newPage();

async function shot(label) {
  const path = resolve(outDir, `${Date.now()}-${label}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  console.log('  screenshot:', path);
}

async function dump(label) {
  const state = await page.evaluate(() => {
    const body = (document.body?.innerText ?? '').replace(/\s+/g, ' ');
    const radios = [...document.querySelectorAll('input[name="projectTypeId"]')];
    const checked = radios.find((r) => r.checked);
    return {
      url: location.href,
      screen: document.querySelector('select[name="collegeId"]')
        ? 'program_selection'
        : /please choose your type/i.test(body)
          ? 'student_type'
          : /please choose your program/i.test(body)
            ? 'program_type'
            : /application notes|agree and continue/i.test(body)
              ? 'application_notes'
              : document.querySelector('input[name="apply.lastName"]')
                ? 'wizard'
                : 'unknown',
      radios: radios.length,
      checked: checked
        ? {
            value: checked.value,
            label: checked.closest('label')?.textContent?.trim(),
          }
        : null,
      collegeId: Boolean(document.querySelector('select[name="collegeId"]')),
      applyLinks: [
        ...document.querySelectorAll(
          'a[onclick*="saveChoose"], a[onclick*="StudyPlan"], td a',
        ),
      ].filter((a) => /apply|申请|选择/i.test(a.textContent || '')).length,
      messager: [...document.querySelectorAll('.messager-window, .messager-body')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 3),
      body: body.slice(0, 200),
    };
  });
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(state, null, 2));
  await shot(label);
  writeFileSync(
    resolve(outDir, `${Date.now()}-${label}.json`),
    JSON.stringify(state, null, 2),
  );
  if (pause) {
    console.log('  DEBUG_PAUSE: Playwright inspector (resume to continue)');
    await page.pause();
  }
  return state;
}

await page.goto(FORM_URL, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
  referer: MEMBER_URL,
});
await page.waitForTimeout(1500);

let state = await dump('00-land');

if (/CSRF|Sign out|Account Sign In/i.test(state.body)) {
  console.error('SESSION DEAD — capture:suda-session again');
  await browser.close();
  process.exit(1);
}

// --- STEP: agreement ---
if (state.screen === 'application_notes') {
  console.log('\n>>> STEP agreement: check + Agree and continue');
  const agree = page.locator('[name="agree"]').first();
  if ((await agree.count()) > 0) {
    await agree.check({ force: true }).catch(() => agree.click({ force: true }));
  }
  await page
    .getByRole('button', { name: /agree and continue|同意/i })
    .first()
    .click({ force: true });
  await page.waitForTimeout(1500);
  state = await dump('01-after-agree');
}

// --- STEP: program type (Self-sponsored) ---
// SUDA has 6 program radios (CSU had fewer) — rely on screen, not radio count.
if (state.screen === 'program_type') {
  console.log('\n>>> STEP program: click Self-sponsored label + Next');
  const label = page
    .locator('label:has(input[name="projectTypeId"])')
    .filter({ hasText: /Self-sponsored|SSP/i })
    .first();
  if ((await label.count()) > 0) {
    await label.click({ force: true });
  } else {
    await page.locator('input[name="projectTypeId"]').first().check({ force: true });
  }
  await dump('02-program-checked');
  await page.locator('input[value="Next"]').first().click({ force: true });
  await page.waitForTimeout(2000);
  state = await dump('03-after-program-next');
}

// --- STEP: student type ---
console.log('\n>>> STEP student_type: Pre-university Student label + Next');
state = await dump('04-before-student');

const studentType = page
  .locator('label:has(input[name="projectTypeId"])')
  .filter({ hasText: /Pre-university Student/i })
  .first();

console.log('  label count:', await studentType.count());
if ((await studentType.count()) > 0) {
  await studentType.click({ force: true });
} else {
  // last radio = Pre-university on SUDA (screenshot order)
  await page.locator('input[name="projectTypeId"]').last().click({ force: true });
}

const checkedAfter = await page.evaluate(() => {
  const c = document.querySelector('input[name="projectTypeId"]:checked');
  return c
    ? { value: c.value, label: c.closest('label')?.textContent?.trim() }
    : null;
});
console.log('  checked after click:', checkedAfter);
await dump('05-student-checked');

console.log('  clicking Next...');
await page.locator('input[value="Next"]').first().click({ force: true });

// Watch processing without killing it
for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(1000);
  const snap = await page.evaluate(() => {
    const body = document.body?.innerText ?? '';
    return {
      processing: /It'?s processing|please wait/i.test(body),
      college: Boolean(document.querySelector('select[name="collegeId"]')),
      studentType: /please choose your type/i.test(body),
      total: (body.match(/Total:\s*(\d+)/i) || [])[1] || null,
    };
  });
  console.log(`  t+${i + 1}s`, snap);
  if (snap.college && !snap.processing) break;
  if (!snap.processing && !snap.studentType) break;
}

state = await dump('06-after-student-next');

// --- STEP: study plan Apply ---
if (state.screen === 'program_selection' || state.collegeId) {
  console.log('\n>>> STEP study plan: prefer Eng foundation Apply');
  const rows = page.locator('table tr').filter({ hasText: /foundation program Eng|MBBS/i });
  let apply = rows.locator('a').filter({ hasText: /^(Apply|申请)$/i }).first();
  if ((await apply.count()) === 0) {
    apply = page.locator('a').filter({ hasText: /^(Apply|申请)$/i }).first();
  }
  console.log('  Apply count:', await apply.count());
  if ((await apply.count()) > 0) {
    await apply.click({ force: true });
    await page.waitForTimeout(3000);
  }
  state = await dump('07-after-apply');
}

console.log('\n=== DONE ===');
console.log('Final screen:', state.screen);
console.log('Artifacts:', outDir);

if (pause || process.env.DEBUG_KEEP === '1') {
  console.log('Inspector open — close browser when done');
  await page.pause();
}

await browser.close();
