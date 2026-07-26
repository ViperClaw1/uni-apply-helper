/**
 * Offline debug for PKU wizard steps 2–7.
 * Run: node apps/worker/scripts/debug-pku-steps-2-7.mjs
 *
 * Covers:
 *  - schema inventory per step
 *  - FieldMapper-equivalent value resolution for a mock Research Scholar profile
 *  - required-field readiness (no Missing required…)
 *  - step 6 document mapping
 *  - Playwright fixtures for criminal/work/China radios + emergency + overlays
 *
 * Live PKU recon needs: pnpm --filter worker capture:pku-session
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const schema = require(
  resolve(__dirname, '../../../data/university-schemas/pku.json'),
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`OK:   ${msg}`);
  }
}

const STEP_TITLES = {
  2: 'Study Plan / Language / Guarantor',
  3: 'Education & Employment',
  4: 'Additional Info (family / criminal / emergency)',
  5: 'Contact Info',
  6: 'Upload Documents',
  7: 'Preview and Submit',
};

/** Minimal Alina-like profile for Research Scholar */
const profile = {
  personal: {
    surname: 'KVOCHKINA',
    givenName: 'ALINA',
    sex: 'Female',
    nationality: 'Russian Federation',
    cityOfBirth: 'KAZAKHSTAN',
    dateOfBirth: '2005-10-16',
    chineseName: undefined,
    religion: 'None',
    passportNo: '670983122',
    passportExpiry: '2029-07-10T00:00:00.0',
    maritalStatus: 'single',
    email: 'alina@example.com',
    phone: '+79001234567',
    permanentAddress: 'Moscow, Russia',
    postCode: '101000',
    currentInstitution: 'Test University',
    beenToChina: false,
    studiedInChina: false,
  },
  education: [
    {
      degree: 'Bachelor',
      institution: 'Test University',
      major: 'International Relations',
      periodStart: '2020-09-01',
      periodEnd: '2024-06-30',
    },
  ],
  workExperience: [],
  languages: [{ language: 'english', score: 'Good' }],
  familyMembers: [],
  guarantor: {
    name: 'Ivan Petrov',
    phone: '+79007654321',
    email: 'ivan@example.com',
  },
  emergencyContact: {
    name: 'Ivan Petrov',
    phone: '+79007654321',
    email: 'ivan@example.com',
  },
  documents: {
    photo: 'https://example.com/photo.jpg',
    passport: 'https://example.com/passport.jpg',
    transcript: 'https://example.com/transcript.pdf',
    medical: 'https://example.com/medical.pdf',
    diploma: 'https://example.com/diploma.pdf',
  },
};

function getByPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

function firstRealOption(options) {
  if (!options?.length) return undefined;
  return options.find(
    (o) =>
      o.trim() &&
      !/^please select/i.test(o) &&
      !/^-*choose-*$/i.test(o) &&
      !/^\.\.\./.test(o),
  );
}

function normalizeYesNo(value, fallback = 'No') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'да'].includes(v)) return 'Yes';
  if (['0', 'false', 'no', 'n', 'нет'].includes(v)) return 'No';
  return fallback;
}

function normalizeDate(value) {
  const trimmed = String(value).trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  return iso ? iso[1] : trimmed;
}

/** Mirror of FieldMapper.getValue for PKU-critical paths */
function resolveValue(field) {
  if (field.type === 'file') {
    return field.documentType
      ? profile.documents[field.documentType]
      : undefined;
  }

  if (!field.mapsTo) {
    if (field.type === 'checkbox') return true;
    return firstRealOption(field.options);
  }

  if (field.mapsTo === 'personal.maritalStatus') {
    return 'Unmarried';
  }
  if (
    field.mapsTo === 'personal.studiedInChina' ||
    field.mapsTo === 'personal.beenToChina'
  ) {
    return normalizeYesNo(getByPath(profile, field.mapsTo), 'No');
  }

  if (field.mapsTo === 'emergencyContact.name' && field.required) {
    return (
      getByPath(profile, field.mapsTo) ||
      `${profile.personal.surname} ${profile.personal.givenName}`
    );
  }
  if (
    (field.mapsTo === 'emergencyContact.phone' ||
      field.selector?.includes('emergencyMobile')) &&
    field.required
  ) {
    return (
      getByPath(profile, 'emergencyContact.phone') ||
      profile.personal.phone ||
      '13800000000'
    );
  }

  if (
    field.selector?.includes('lastSchool') ||
    /institution of highest/i.test(field.labelHint || '')
  ) {
    return (
      profile.personal.currentInstitution ||
      profile.education[0]?.institution ||
      'Higher Education Institution'
    );
  }

  let mapped = getByPath(profile, field.mapsTo);
  if (
    mapped &&
    /date|borned|birth|expire|expiry|passportExpire|periodStart|periodEnd/i.test(
      `${field.selector} ${field.labelHint} ${field.mapsTo}`,
    )
  ) {
    mapped = normalizeDate(mapped);
  }

  if (mapped !== undefined && mapped !== null && mapped !== '') {
    return mapped;
  }

  if (field.type === 'checkbox') return true;
  if (field.type === 'file') {
    return field.documentType
      ? profile.documents[field.documentType]
      : undefined;
  }
  return firstRealOption(field.options);
}

function fieldsForStep(step) {
  return schema.fields.filter((f) => f.wizardStep === step);
}

console.log('=== PKU wizard config ===');
assert(schema.wizard?.totalSteps === 7, 'totalSteps = 7');
assert(
  /Save and Next/i.test(schema.wizard.nextButtonSelector),
  'nextButtonSelector has Save and Next',
);
assert(/Submit/i.test(schema.wizard.submitButtonSelector), 'submit selector');

console.log('\n=== Steps 2–7 inventory + value resolution ===');
for (let step = 2; step <= 7; step += 1) {
  const fields = fieldsForStep(step);
  console.log(`\n--- Step ${step}: ${STEP_TITLES[step]} (${fields.length} fields) ---`);

  if (step === 7) {
    assert(fields.length === 0, 'Step 7 has no fill fields (Submit only)');
    continue;
  }

  assert(fields.length > 0, `Step ${step} has fields in schema`);

  for (const field of fields) {
    const value = resolveValue(field);
    const label = field.labelHint || field.selector;
    const empty =
      value === undefined || value === null || value === '';

    if (field.required && empty && field.type !== 'file') {
      assert(false, `Step ${step} required "${label}" resolved`);
      continue;
    }

    if (field.required && field.type === 'file') {
      const doc = field.documentType
        ? profile.documents[field.documentType]
        : undefined;
      if (field.documentType) {
        assert(Boolean(doc), `Step ${step} file "${label}" → documents.${field.documentType}`);
      } else {
        console.log(`WARN: required file without documentType: ${label}`);
      }
      continue;
    }

    if (!empty) {
      console.log(`  fill ${field.type.padEnd(8)} ${label} = ${String(value).slice(0, 60)}`);
    } else {
      console.log(`  skip ${field.type.padEnd(8)} ${label} (optional empty)`);
    }
  }
}

console.log('\n=== Step 6 attach types ===');
const step6 = fieldsForStep(6);
const attachIds = step6
  .map((f) => f.selector?.match(/attachTypeId="([^"]+)"/)?.[1])
  .filter(Boolean);
assert(attachIds.includes('ATTACH_TYPE_passportImage'), 'passport attach present');
assert(
  attachIds.includes('ATTACH_TYPE_checkBodyreport'),
  'medical attach present',
);
const csca = step6.find((f) =>
  f.selector?.includes('ATTACH_TYPE_8135227092'),
);
assert(csca && csca.required === false, 'CSCA optional for PKU Research Scholar');
const passportFile = step6.find((f) => f.documentType === 'passport');
assert(passportFile?.required === true, 'passport upload required on step 6');

console.log('\n=== Critical soft-defaults ===');
const china = fieldsForStep(3).find((f) =>
  f.selector?.includes('haveStudiedInChina'),
);
assert(resolveValue(china) === 'No', 'studiedInChina → No');
const work = fieldsForStep(3).find((f) =>
  f.selector?.includes('haveWorkHistory'),
);
assert(resolveValue(work) === 'No', 'haveWorkHistory → No');
const criminal = fieldsForStep(4).find((f) =>
  f.selector?.includes('hasCriminalRecord'),
);
assert(resolveValue(criminal) === 'No', 'hasCriminalRecord → No');
const emergName = fieldsForStep(4).find((f) =>
  f.selector?.includes('emergencyName'),
);
assert(Boolean(resolveValue(emergName)), 'emergencyName resolved');
const homeMobile = fieldsForStep(5).find((f) =>
  f.selector?.includes('homeMobile'),
);
assert(Boolean(resolveValue(homeMobile)), 'homeMobile resolved');

console.log('\n=== Playwright fixtures: step 3–4 radios + overlays ===');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<!DOCTYPE html><html><body>
  <h3>Step 3</h3>
  <label><input type="radio" name="applyEx.haveStudiedInChina" value="1"> Yes</label>
  <label><input type="radio" name="applyEx.haveStudiedInChina" value="0"> No</label>
  <label><input type="radio" name="haveWorkHistory" value="1"> Yes</label>
  <label><input type="radio" name="haveWorkHistory" value="0"> No</label>

  <h3>Step 4</h3>
  <label><input type="radio" name="applyEx.hasCriminalRecord" value="1"> Yes</label>
  <label><input type="radio" name="applyEx.hasCriminalRecord" value="0"> No</label>
  <input name="apply.emergencyName" />
  <input name="apply.emergencyMobile" />

  <h3>Step 5</h3>
  <input name="apply.homeMobile" />

  <div class="messager-window" style="display:block;width:200px;height:80px">
    <div class="messager-body">Successfully copied to the corresponding input box!</div>
    <div class="messager-button"><input class="okButton" type="button" value="Ok"></div>
  </div>
  <div class="WdateDiv" style="display:block;width:100px;height:100px">calendar</div>
</body></html>`);

async function pickRadioByLabel(name, label) {
  const radio = page.getByRole('radio', { name: label, exact: true }).first();
  await radio.check({ force: true });
  return radio.isChecked();
}

assert(
  await pickRadioByLabel('haveStudiedInChina', 'No'),
  'DOM: haveStudiedInChina=No',
);
assert(await pickRadioByLabel('haveWorkHistory', 'No'), 'DOM: haveWorkHistory=No');
assert(
  await pickRadioByLabel('hasCriminalRecord', 'No'),
  'DOM: hasCriminalRecord=No',
);

await page.fill(
  'input[name="apply.emergencyName"]',
  String(resolveValue(emergName)),
);
await page.fill(
  'input[name="apply.emergencyMobile"]',
  String(resolveValue(fieldsForStep(4).find((f) => f.selector.includes('emergencyMobile')))),
);
await page.fill(
  'input[name="apply.homeMobile"]',
  String(resolveValue(homeMobile)).replace(/\D/g, '').slice(-11) || '13800000000',
);

assert(
  (await page.inputValue('input[name="apply.emergencyName"]')).length > 0,
  'DOM: emergencyName filled',
);
assert(
  (await page.inputValue('input[name="apply.homeMobile"]')).length > 0,
  'DOM: homeMobile filled',
);

// Dismiss success dialog + close datepicker (mirrors form.filler overlays)
await page.evaluate(() => {
  for (const win of document.querySelectorAll('.messager-window')) {
    const ok = win.querySelector('input.okButton');
    ok?.click();
    win.style.display = 'none';
  }
  for (const el of document.querySelectorAll('.WdateDiv')) {
    el.style.display = 'none';
  }
});

assert(
  (await page.locator('.messager-window').evaluate((el) => getComputedStyle(el).display)) ===
    'none',
  'DOM: success dialog hidden after Ok',
);
assert(
  (await page.locator('.WdateDiv').evaluate((el) => getComputedStyle(el).display)) ===
    'none',
  'DOM: datepicker closed',
);

await browser.close();

console.log('\n=== Risks / live follow-ups ===');
console.log(
  'LIVE NEEDED: capture:pku-session → recon steps 2-7 field names & * required marks',
);
console.log(
  'NOTE: PKU Step2 UI title is "Study Plan" — may differ from ZZU language/guarantor layout',
);
console.log(
  'NOTE: Step6 attachTypeIds copied from ZZU — verify on first live upload step',
);

console.log('\n=== done ===');
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('All steps 2–7 debug assertions passed.');
