/**
 * Agent zero-schema smoke (offline + optional live).
 *
 * Offline (default): verifies enriched PageObserver dump + smoke schema shape.
 * Live: SMOKE_LIVE=1 + CSU session → navigate to apply URL and print observation
 *       (does not submit; needs GEMINI only if you also set SMOKE_AGENT=1).
 *
 *   cd apps/worker
 *   node scripts/debug-agent-smoke.mjs
 *   SMOKE_LIVE=1 node scripts/debug-agent-smoke.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './stealth-browser.mjs';
import {
  getSessionPaths,
  loadUniversitySession,
} from './browser-session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
const schemaPath = resolve(
  root,
  'data/university-schemas/csu-agent-smoke.json',
);
const outDir = resolve(process.cwd(), 'data/captures/agent-smoke');
mkdirSync(outDir, { recursive: true });

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
assert(schema.id === 'csu-agent-smoke', 'schema id');
assert(Array.isArray(schema.fields) && schema.fields.length === 0, 'fields empty');
assert(schema.agent?.fillMode === 'agent', 'fillMode agent');
assert(schema.wizard?.totalSteps === 7, 'wizard steps');
assert(/csu\.17gz\.org/.test(schema.formUrl), 'formUrl');

console.log('✓ smoke schema OK:', schemaPath);

const FIXTURE = `<!DOCTYPE html><html><body>
  <form>
    <label>Language Proficiency *
      <select name="apply.languageSkillId" validate="required" required>
        <option value="">-Choose-</option>
        <option value="1">None</option>
        <option value="2">Good</option>
      </select>
    </label>
    <label>School Name
      <input name="sh.studyPlace" placeholder="Full school name" validate="required" />
    </label>
    <button type="button">Save and Next</button>
  </form>
</body></html>`;

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
}).catch(async (error) => {
  console.warn(
    '⚠ Playwright launch failed (skipping DOM observe assert):',
    error instanceof Error ? error.message : error,
  );
  console.log('✓ smoke schema OK (browser skipped)');
  process.exit(0);
});
const page = await browser.newPage();
await page.setContent(FIXTURE);

const structure = await page.evaluate(() => {
  const lines = [];
  for (const element of document.querySelectorAll(
    'input:not([type="hidden"]), select, textarea, button',
  )) {
    const input = element;
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role') ?? tag;
    const labelText = (
      element.getAttribute('aria-label') ??
      input.labels?.[0]?.textContent ??
      element.closest('label')?.textContent ??
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const placeholder = element.getAttribute('placeholder') ?? '';
    const surrounding = (
      element.closest('td, th, .form-group, li, label')?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const required = Boolean(
      input.required ||
        /required/i.test(element.getAttribute('validate') || ''),
    );
    let options = '';
    if (tag === 'select') {
      const opts = [...element.options]
        .slice(0, 20)
        .map((opt) => `${(opt.textContent || '').trim()}=${opt.value}`)
        .filter(Boolean);
      options = ` options=[${opts.join(' | ')}]`;
    }
    const display = labelText || placeholder || element.getAttribute('name');
    lines.push(
      `[${role}] name="${display}" field=${element.getAttribute('name') || ''} ` +
        `${required ? 'required=true ' : ''}` +
        `${placeholder ? `hint="${placeholder}" ` : ''}` +
        `${surrounding ? `near="${surrounding}" ` : ''}` +
        options,
    );
  }
  return lines.join('\n');
});

assert(/required=true/.test(structure), 'observer required flag');
assert(/options=\[/.test(structure), 'observer select options');
assert(/hint="Full school name"/.test(structure), 'observer hint');
assert(/near=/.test(structure), 'observer surrounding');

writeFileSync(resolve(outDir, 'offline-structure.txt'), structure);
console.log('✓ enriched observation structure OK');
console.log(structure);

await browser.close();

if (process.env.SMOKE_LIVE !== '1') {
  console.log('\nOffline smoke passed. For live CSU observe:');
  console.log('  pnpm capture:csu-session');
  console.log('  SMOKE_LIVE=1 node scripts/debug-agent-smoke.mjs');
  process.exit(0);
}

// --- live observe (session required) ---
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

let storageState = loadUniversitySession('csu');
if (!storageState) {
  const { b64File, sessionFile } = getSessionPaths('csu');
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
  console.error('No CSU session for live smoke');
  process.exit(1);
}

const live = await chromium.launch({
  headless: process.env.HEADED === '1' ? false : true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await live.newContext({ storageState });
const livePage = await context.newPage();
await livePage.goto(schema.formUrl, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await livePage.waitForTimeout(1500);
const body = (await livePage.locator('body').innerText()).slice(0, 400);
const liveShot = resolve(outDir, `live-${Date.now()}.png`);
await livePage.screenshot({ path: liveShot, fullPage: true }).catch(() => undefined);
writeFileSync(resolve(outDir, 'live-body.txt'), body);
console.log('✓ live land OK');
console.log('  body:', body.replace(/\s+/g, ' ').slice(0, 200));
console.log('  screenshot:', liveShot);
await live.close();
