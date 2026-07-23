/**
 * Headed debug for KMMC pre-wizard (program → student type).
 *
 *   pnpm debug:kmmc-prewizard
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

console.log('Launching headed Chromium (slowMo=250)...');
const browser = await chromium.launch({
  headless: false,
  slowMo: 250,
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
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

const bodyPreview = (await page.locator('body').innerText().catch(() => '')).slice(
  0,
  240,
);
console.log('\nURL:', page.url());
console.log('Body preview:', bodyPreview);

if (/CSRF|操作被拒绝|Sign out/i.test(bodyPreview)) {
  console.error('\nSession dead (CSRF). Recapture: pnpm capture:kmmc-session');
  await page.pause();
  await browser.close();
  process.exit(1);
}

async function dumpRadios(label) {
  const probe = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    return {
      heading: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160),
      nextInput: Boolean(
        document.querySelector('input[value="Next"], input[value="下一步"]'),
      ),
      nextButtonTexts: [...document.querySelectorAll('button, input[type="button"]')]
        .map((el) =>
          (el.value || el.textContent || '').replace(/\s+/g, ' ').trim(),
        )
        .filter(Boolean)
        .slice(0, 15),
      radios: radios.map((r, i) => ({
        i,
        name: r.name,
        value: r.value,
        checked: r.checked,
        display: getComputedStyle(r).display,
        visibility: getComputedStyle(r).visibility,
        label:
          r.closest('label')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ??
          r.parentElement?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ??
          null,
      })),
    };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(probe, null, 2));
  return probe;
}

await dumpRadios('initial');

console.log(`
=== Screen 3 probe (run in page console when on 请选择招生类别) ===

const radios = [...document.querySelectorAll('input[type="radio"]')];
console.table(radios.map(r => ({
  name: r.name, value: r.value, checked: r.checked,
  display: getComputedStyle(r).display,
  label: (r.closest('label')||r.parentElement)?.textContent?.trim().slice(0,40)
})));

const radio = radios[0];
radio.closest('label')?.click();
console.log('label click:', radio.checked);
radio.click();
console.log('direct click:', radio.checked);
radio.checked = true;
radio.dispatchEvent(new Event('change', { bubbles: true }));
console.log('force checked:', radio.checked);

document.querySelector('input[value="Next"], input[value="下一步"]')?.click();
`);

await page.pause();
await browser.close();
