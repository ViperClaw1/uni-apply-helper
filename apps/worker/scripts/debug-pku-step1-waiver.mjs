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
  <table>
    <tr>
      <td>*Marital Status</td>
      <td>
        <input type="radio" name="apply.marryStatus" value="1" /> Unmarried
        <input type="radio" name="apply.marryStatus" value="2" /> Married
      </td>
    </tr>
    <tr>
      <td>*Institution of Highest Diploma</td>
      <td>
        <input name="applyEx.lastSchool" value="currently not studying" />
      </td>
    </tr>
    <tr>
      <td>*Occupation</td>
      <td>
        <select name="apply.careerId">
          <option value="1">Student</option>
        </select>
      </td>
    </tr>
    <tr>
      <td>*Current Employer or Educational Institution</td>
      <td>
        <input name="apply.workplace" value="" />
      </td>
    </tr>
    <tr>
      <td>*Are you Ethnic Chinese?</td>
      <td>
        <input type="radio" name="apply.isOversea" value="1" /> Yes
        <input type="radio" name="apply.isOversea" value="0" /> No
      </td>
    </tr>
    <tr>
      <td>*Whether in Chinese mainland now?</td>
      <td>
        <input type="radio" name="applyEx.inChinaOnApply" value="1" /> Yes
        <input type="radio" name="applyEx.inChinaOnApply" value="0" /> No
      </td>
    </tr>
    <tr>
      <td>*Passport Type</td>
      <td>
        <select name="apply.someUnknownPassportType">
          <option value="">-Choose-</option>
          <option value="1">Ordinary Passport</option>
          <option value="2">Diplomatic Passport</option>
          <option value="3">Service Passport</option>
        </select>
      </td>
    </tr>
  </table>
</body></html>`;

async function fillTextNearLabel(page, labelSource, nextValue) {
  return page.evaluate(({ labelSource, nextValue }) => {
    const labelReLocal = new RegExp(labelSource, 'i');
    const nodes = [...document.querySelectorAll('td, th, label, div, span, li')];
    const labelEl = nodes.find((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return (
        labelReLocal.test(t) &&
        !/Highest Diploma/i.test(t) &&
        t.length < 100
      );
    });
    if (!labelEl) return false;
    const row = labelEl.closest('tr') || labelEl.parentElement;
    const input = row?.querySelector('input[type="text"], input:not([type])');
    if (!input) return false;
    input.value = nextValue;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value === nextValue;
  }, { labelSource, nextValue });
}

async function fillRadioByLabelText(page, sel, want) {
  return page.evaluate(({ sel, want }) => {
    const radios = [...document.querySelectorAll(sel)];
    const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const wantN = norm(want);
    const labelOf = (radio) => {
      let sib = radio.nextSibling;
      let acc = '';
      while (sib && acc.length < 40) {
        if (sib.nodeType === Node.TEXT_NODE) acc += sib.textContent || '';
        else if (sib.nodeType === Node.ELEMENT_NODE) {
          if (sib.tagName === 'INPUT') break;
          acc += sib.textContent || '';
        }
        sib = sib.nextSibling;
      }
      return acc;
    };
    const match = radios.find((r) => {
      const lab = norm(labelOf(r));
      return lab === wantN || lab.startsWith(wantN);
    });
    const aliases = {
      no: ['0', 'n', 'no'],
      yes: ['1', 'y', 'yes'],
      unmarried: ['1', 'unmarried'],
    };
    const target =
      match ||
      radios.find((r) => (aliases[wantN] || []).includes(norm(r.value))) ||
      (wantN === 'no' ? radios[radios.length - 1] : null);
    if (!target) return false;
    target.checked = true;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return target.checked;
  }, { sel, want });
}

async function selectNearLabel(page, labelSource, values) {
  return page.evaluate(({ labelSource, values }) => {
    const labelReLocal = new RegExp(labelSource, 'i');
    const nodes = [...document.querySelectorAll('td, th, label, div, span, li')];
    const labelEl = nodes.find((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return labelReLocal.test(t) && t.length < 80;
    });
    if (!labelEl) return false;
    const row = labelEl.closest('tr') || labelEl.parentElement;
    const select = row?.querySelector('select');
    if (!select) return false;
    const needles = values.map((v) => v.toLowerCase());
    const opt = [...select.options].find((option) => {
      const text = (option.textContent || '').trim().toLowerCase();
      return needles.some((n) => text === n || text.includes(n));
    });
    if (!opt?.value) return false;
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value === opt.value;
  }, { labelSource, values });
}

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
  'workplace',
  'religionId',
  'passportExpire',
  'isOversea',
  'inChinaOnApply',
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
const passportTypeField = step1.find((f) =>
  /Passport Type/i.test(f.labelHint || ''),
);
assert(Boolean(passportTypeField), 'pku.json has Passport Type field');
assert(
  passportTypeField.required === false,
  'Passport Type must be required:false (name unknown; filled by label scan)',
);
const careerNameField = step1.find((f) =>
  /workplace|careerName|Current Employer/i.test(
    `${f.selector || ''} ${f.labelHint || ''}`,
  ),
);
assert(Boolean(careerNameField), 'pku.json has apply.workplace / Current Employer');
assert(
  (careerNameField.selector || '').includes('apply.workplace'),
  'Current Employer selector must be apply.workplace',
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

console.log('\n=== radio + passport type gaps ===');
await page.setContent(FIXTURE);
assert(
  await fillRadioByLabelText(page, 'input[name="apply.marryStatus"]', 'Unmarried'),
  'radio: Unmarried by sibling text',
);
assert(
  await page.locator('input[name="apply.marryStatus"][value="1"]').isChecked(),
  'radio: marryStatus value=1 checked',
);
assert(
  await fillRadioByLabelText(page, 'input[name="apply.isOversea"]', 'No'),
  'radio: Ethnic Chinese No (not .first=Yes)',
);
assert(
  await page.locator('input[name="apply.isOversea"][value="0"]').isChecked(),
  'radio: isOversea value=0 checked',
);
assert(
  await fillRadioByLabelText(page, 'input[name="applyEx.inChinaOnApply"]', 'No'),
  'radio: inChina No',
);
assert(
  await selectNearLabel(page, 'Passport Type', ['Ordinary Passport', 'Ordinary']),
  'select: Passport Type by label → Ordinary',
);
assert(
  (await page.locator('select[name="apply.someUnknownPassportType"]').inputValue()) ===
    '1',
  'select: unknown name still filled',
);

// Simulate polluted lastSchool from previous bad semantic map
await page.fill(
  'input[name="applyEx.lastSchool"]',
  'currently not studyingHigh school graduate, no employer',
);
assert(
  await fillTextNearLabel(
    page,
    'Current Employer',
    'High school graduate, no employer',
  ),
  'employer: fill by Current Employer label (unknown name)',
);
assert(
  (await page.locator('input[name="apply.workplace"]').inputValue()) ===
    'High school graduate, no employer',
  'employer: apply.workplace filled',
);
assert(
  (await page.locator('input[name="applyEx.lastSchool"]').inputValue()).includes(
    'High school graduate',
  ),
  'setup: lastSchool still polluted before repair',
);
await page.evaluate(() => {
  const lastSchool = document.querySelector(
    'input[name="applyEx.lastSchool"]',
  );
  if (lastSchool?.value && /high school graduate/i.test(lastSchool.value)) {
    lastSchool.value = lastSchool.value
      .replace(/\s*High school graduate, no employer\s*/gi, '')
      .trim();
    if (!lastSchool.value) lastSchool.value = 'currently not studying';
  }
});
assert(
  (await page.locator('input[name="applyEx.lastSchool"]').inputValue()) ===
    'currently not studying',
  'repair: lastSchool de-polluted',
);

await browser.close();

console.log('\n=== done ===');
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('All debug assertions passed.');
