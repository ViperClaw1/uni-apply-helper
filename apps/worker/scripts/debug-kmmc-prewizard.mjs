/**
 * Headed debug for KMMC program_type pre-wizard.
 *
 * Usage (from apps/worker):
 *   pnpm debug:kmmc-prewizard
 *
 * Or with explicit env:
 *   KMMC_SESSION_STATE_B64=... node scripts/debug-kmmc-prewizard.mjs
 *
 * Flow:
 * 1. Opens headed Chrome with saved KMMC session
 * 2. Goes to apply/index.do
 * 3. Prints radio/label DOM probe
 * 4. page.pause() → Playwright Inspector — step manually / run console snippets
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
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadWorkerEnvFile();

const FORM_URL = 'http://study.kmmc.cn/apply/index.do';
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
  console.error(
    'No KMMC session. Run: pnpm capture:kmmc-session\n' +
      'Or set KMMC_SESSION_STATE_B64 / put browser-sessions/kmmc.json',
  );
  process.exit(1);
}

console.log('Launching headed Chromium (slowMo=400)...');
const browser = await chromium.launch({
  headless: false,
  slowMo: 400,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1200 },
  locale: 'en-US',
  timezoneId: 'Asia/Shanghai',
});

const page = await context.newPage();

await page.goto(FORM_URL, {
  waitUntil: 'networkidle',
  timeout: 60_000,
});

console.log('\nURL:', page.url());
console.log(
  'Body preview:',
  (await page.locator('body').innerText().catch(() => '')).slice(0, 200),
);

const probe = await page.evaluate(() => {
  const radios = [
    ...document.querySelectorAll('input[name="projectTypeId"]'),
  ];
  return radios.map((r, i) => ({
    i,
    type: r.type,
    value: r.value,
    checked: r.checked,
    id: r.id || null,
    display: getComputedStyle(r).display,
    closestLabel: r.closest('label')?.textContent?.trim().slice(0, 80) ?? null,
    labelFor: r.id
      ? document
          .querySelector(`label[for="${CSS.escape(r.id)}"]`)
          ?.textContent?.trim()
          .slice(0, 80) ?? null
      : null,
    parent: `${r.parentElement?.tagName ?? '?'} ${(r.parentElement?.textContent ?? '').trim().slice(0, 40)}`,
    hasSaveFn: typeof window.saveProjectType === 'function',
  }));
});

console.log('\n=== projectTypeId probe ===');
console.log(JSON.stringify(probe, null, 2));

console.log(`
=== Playwright Inspector ===
1. Дойди до экрана "please choose your program" (Start/Edit/Agree если нужно).
2. В Console браузера / Inspector выполни:

const radio = document.querySelector('input[name="projectTypeId"]');
radio.closest('label')?.click();
console.log('after label click:', radio.checked);
radio.click();
console.log('after direct click:', radio.checked);
radio.checked = true;
console.log('after .checked=true:', radio.checked);
typeof saveProjectType;

3. Resume в Inspector когда закончишь.
`);

await page.pause();

await browser.close();
