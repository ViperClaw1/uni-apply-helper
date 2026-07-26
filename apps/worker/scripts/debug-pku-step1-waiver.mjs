/**
 * Debug harness for PKU Step 1 Chinese Name waiver + date/marital normalization.
 * Run: node apps/worker/scripts/debug-pku-step1-waiver.mjs
 *
 * Does NOT need a live PKU session — uses Playwright against a local HTML fixture
 * that mirrors the real Chinese Name + noName checkbox markup.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// field.mapper is TS — replicate the critical pure logic here for a fast assert,
// then exercise the DOM checkbox path via Playwright.

function normalizeDateValue(value) {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (iso) return iso[1];
  const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}

function normalizeMaritalStatus(value) {
  const v = value.trim().toLowerCase();
  if (
    ['unmarried', 'single', 'холост', 'не замужем', 'незамужем'].includes(v) ||
    v.includes('unmar') ||
    v.includes('single')
  ) {
    return 'Unmarried';
  }
  if (['married', 'женат', 'замужем'].includes(v) || v.includes('marri')) {
    return 'Married';
  }
  return value;
}

function shouldCheckNoChineseName(chineseName) {
  return !Boolean(chineseName?.trim());
}

const FIXTURE = `<!DOCTYPE html><html><body>
  <label>Chinese Name *</label>
  <input name="apply.name" value="" />
  <label>
    <input type="checkbox" name="noName" />
    not have a Chinese name yet
  </label>
  <input name="apply.passportExpire" value="2029-07-10T00:00:00.0" />
  <input type="radio" name="apply.marryStatus" value="1" /> Unmarried
  <input type="radio" name="apply.marryStatus" value="2" /> Married
</body></html>`;

async function ensureChineseNameWaiver(page, profile) {
  const hasChinese = Boolean(profile.personal?.chineseName?.trim());
  if (hasChinese) return { skipped: true };

  await page.evaluate(() => {
    const input = document.querySelector('input[name="apply.name"]');
    if (input) {
      input.value = '';
      input.setAttribute('value', '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const checkbox = page.locator('input[type="checkbox"][name="noName"]').first();
  if ((await checkbox.count()) === 0) {
    throw new Error('noName checkbox not found');
  }
  if (!(await checkbox.isChecked())) {
    await checkbox.check({ force: true });
  }
  return { skipped: false, checked: await checkbox.isChecked() };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`OK:   ${msg}`);
  }
}

console.log('=== pure helpers ===');
assert(shouldCheckNoChineseName(undefined) === true, 'empty chineseName → check waiver');
assert(shouldCheckNoChineseName('') === true, 'blank chineseName → check waiver');
assert(shouldCheckNoChineseName('  ') === true, 'whitespace chineseName → check waiver');
assert(shouldCheckNoChineseName('张三') === false, 'has chineseName → skip waiver');
assert(
  normalizeDateValue('2029-07-10T00:00:00.0') === '2029-07-10',
  'strip ISO time from passport expiry',
);
assert(normalizeDateValue('2005-10-16') === '2005-10-16', 'keep plain date');
assert(normalizeMaritalStatus('single') === 'Unmarried', 'single → Unmarried');
assert(normalizeMaritalStatus('Married') === 'Married', 'Married stays');

console.log('\n=== schema coverage (pku.json step 1) ===');
const schemaPath = resolve(__dirname, '../../../data/university-schemas/pku.json');
const schema = require(schemaPath);
const step1 = schema.fields.filter((f) => f.wizardStep === 1);
const selectors = step1.map((f) => f.selector).join('\n');
const requiredHints = [
  'Chinese Name',
  'marryStatus',
  'languageId',
  'educationId',
  'lastSchool',
  'careerId',
  'religionId',
  'passportExpire',
];
for (const hint of requiredHints) {
  assert(
    selectors.includes(hint) ||
      step1.some(
        (f) =>
          (f.selector || '').includes(hint) ||
          (f.labelHint || '').includes(hint) ||
          (f.mapsTo || '').includes(hint),
      ),
    `pku.json step1 covers ${hint}`,
  );
}
assert(
  step1.some((f) => f.selector?.includes('apply.name')),
  'apply.name (Chinese Name) present',
);

console.log('\n=== playwright DOM waiver ===');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(FIXTURE);

const resultEmpty = await ensureChineseNameWaiver(page, {
  personal: { chineseName: undefined },
});
assert(resultEmpty.checked === true, 'DOM: noName checked when chineseName empty');
assert(
  (await page.locator('input[name="apply.name"]').inputValue()) === '',
  'DOM: apply.name cleared',
);

// Reset and verify skip when chinese name present
await page.setContent(FIXTURE);
await page.fill('input[name="apply.name"]', '张三');
const resultHas = await ensureChineseNameWaiver(page, {
  personal: { chineseName: '张三' },
});
assert(resultHas.skipped === true, 'DOM: skip waiver when chineseName set');
assert(
  (await page.locator('input[name="noName"]').isChecked()) === false,
  'DOM: noName stays unchecked when chineseName set',
);

await browser.close();

console.log('\n=== done ===');
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('All debug assertions passed.');
