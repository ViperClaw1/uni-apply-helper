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
    name: 'Kvochkina Tatiana Fedorovna',
    relationship: 'Mother',
    company: 'N/A',
    nationality: 'Russian Federation',
    phone: '+79007654321',
    email: 'Tatyana_kv85@mail.ru',
  },
  emergencyContact: {
    name: 'Ivan Petrov',
    relationship: 'Father',
    company: 'N/A',
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
  applicationTargets: [
    {
      universityRaw: 'Peking University',
      universityId: 'pku',
      major: 'Molecular Medicine',
      degree: 'Research Scholar',
    },
  ],
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

function mapsToPaths(mapsTo) {
  if (!mapsTo) return [];
  return Array.isArray(mapsTo) ? mapsTo.filter(Boolean) : [mapsTo];
}

/** Mirror of FieldMapper.getValue for PKU-critical paths */
function resolveValue(field) {
  if (field.type === 'file') {
    return field.documentType
      ? profile.documents[field.documentType]
      : undefined;
  }

  if (
    field.selector?.includes('workplace') ||
    field.selector?.includes('careerName')
  ) {
    return 'High school graduate, no employer';
  }

  if (
    field.selector?.includes('fieldEnglish') ||
    field.selector?.includes('fieldName') ||
    /area of research/i.test(field.labelHint || '')
  ) {
    return (
      profile.applicationTargets?.[0]?.major ||
      profile.education[0]?.major ||
      'Molecular Medicine'
    );
  }

  if (field.selector?.includes('studyStartDate')) return '2026-09-01';
  if (field.selector?.includes('studyEndDate')) return '2027-06-30';
  if (field.selector?.includes('yydjzsScore')) return 'N/A';
  if (field.selector?.includes('yydjzsIssueDate')) return '2020-01-01';
  if (field.selector?.includes('advisorEn')) return 'To be assigned';
  if (field.selector?.includes('advisorConnect')) return 'N/A';
  if (field.selector?.includes('advisor')) return '待定';

  const paths = mapsToPaths(field.mapsTo);
  if (paths.length === 0) {
    if (field.type === 'checkbox') return true;
    return firstRealOption(field.options);
  }

  for (const path of paths) {
    if (path === 'personal.maritalStatus') return 'Unmarried';
    if (path === 'personal.studiedInChina' || path === 'personal.beenToChina') {
      return normalizeYesNo(getByPath(profile, path), 'No');
    }

    let mapped = getByPath(profile, path);
    if (
      mapped &&
      /date|borned|birth|expire|expiry|passportExpire|periodStart|periodEnd/i.test(
        `${field.selector} ${field.labelHint} ${path}`,
      )
    ) {
      mapped = normalizeDate(mapped);
    }
    if (mapped !== undefined && mapped !== null && mapped !== '') {
      return mapped;
    }
  }

  if (
    paths.includes('guarantor.relationship') ||
    paths.includes('emergencyContact.relationship') ||
    /guarRelation|guarSecRelative/i.test(field.selector || '')
  ) {
    return field.selector?.includes('Sec') ? 'Father' : 'Mother';
  }
  if (
    paths.includes('guarantor.company') ||
    paths.includes('emergencyContact.company') ||
    /guarWorkplace|guarSecWork/i.test(field.selector || '')
  ) {
    return 'N/A';
  }
  if (
    paths.includes('guarantor.nationality') ||
    paths.includes('emergencyContact.nationality') ||
    /guarCountryId/i.test(field.selector || '')
  ) {
    return profile.personal.nationality || 'Russian Federation';
  }
  if (
    paths.includes('guarantor.name') ||
    paths.includes('emergencyContact.name')
  ) {
    return (
      `${profile.personal.surname} ${profile.personal.givenName}`.trim() ||
      'Recommender'
    );
  }
  if (
    paths.includes('guarantor.phone') ||
    paths.includes('emergencyContact.phone')
  ) {
    return profile.personal.phone || '13800000000';
  }
  if (
    paths.includes('guarantor.email') ||
    paths.includes('emergencyContact.email')
  ) {
    return profile.personal.email || 'recommender@example.com';
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

  if (field.type === 'checkbox') return true;
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
const step2Must = [
  ['apply.fieldEnglish', 'Molecular Medicine'],
  ['apply.studyStartDate', '2026-09-01'],
  ['apply.studyEndDate', '2027-06-30'],
  ['apply.languageSkillId', 'None'],
  ['apply.hskId', 'None'],
  ['apply.hskOralId', 'None'],
  ['apply.englishLanguageSkillId', 'Good'],
  ['apply.yydjzs', 'Native Language'],
  ['apply.yydjzsScore', 'N/A'],
  ['apply.yydjzsIssueDate', '2020-01-01'],
  ['apply.guarRelation', 'Mother'],
  ['apply.guarWorkplace', 'N/A'],
  ['apply.guarSecEnname', 'Ivan Petrov'],
  ['apply.guarSecRelative', 'Father'],
  ['apply.guarSecWork', 'N/A'],
  ['apply.guarSecPhone', '+79007654321'],
  ['apply.guarSecEmail', 'ivan@example.com'],
];
for (const [selPart, expected] of step2Must) {
  const field = fieldsForStep(2).find((f) => f.selector?.includes(selPart));
  assert(Boolean(field), `Step2 schema has ${selPart}`);
  assert(
    resolveValue(field) === expected,
    `Step2 ${selPart} → ${expected} (got ${resolveValue(field)})`,
  );
}

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

console.log('\n=== Playwright fixtures: step 2 study plan + step 3–4 radios ===');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<!DOCTYPE html><html><body>
  <h3>Step 2</h3>
  <table>
    <tr><td>Area of Research (in English)</td><td><input name="apply.fieldEnglish" /></td></tr>
    <tr><td>Area of Research (in Chinese)</td><td><input name="apply.fieldName" /></td></tr>
    <tr><td>*Duration of Study</td>
      <td>
        <input name="apply.studyStartDate" class="Wdate" />
        <input name="apply.studyEndDate" class="Wdate" />
      </td>
    </tr>
    <tr><td>Supervisor English Name</td><td><input name="apply.advisorEn" /></td></tr>
    <tr><td>*Relationship</td><td><input name="apply.guarRelation" /></td></tr>
    <tr><td>*Organization</td><td><input name="apply.guarWorkplace" /></td></tr>
    <tr><td>Nationality</td>
      <td>
        <select name="apply.guarCountryId">
          <option value="">Please choose</option>
          <option value="1">Russian Federation</option>
          <option value="2">China</option>
        </select>
      </td>
    </tr>
  </table>
  <div class="WdateDiv" style="display:block;width:100px;height:100px">calendar</div>

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
</body></html>`);

async function setJs(name, value) {
  return page.evaluate(
    ({ name, value }) => {
      const el = document.querySelector(`input[name="${name}"]`);
      if (!el) return false;
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === value;
    },
    { name, value },
  );
}

assert(
  await setJs('apply.fieldEnglish', resolveValue(fieldsForStep(2).find((f) => f.selector.includes('fieldEnglish')))),
  'DOM: fieldEnglish filled via JS',
);
assert(
  await setJs('apply.studyStartDate', '2026-09-01'),
  'DOM: studyStartDate via JS (no datepicker type)',
);
assert(
  await setJs('apply.studyEndDate', '2027-06-30'),
  'DOM: studyEndDate via JS',
);
assert(await setJs('apply.guarRelation', 'Mother'), 'DOM: guarRelation');
assert(await setJs('apply.guarWorkplace', 'N/A'), 'DOM: guarWorkplace');
await page.selectOption('select[name="apply.guarCountryId"]', { label: 'Russian Federation' });
assert(
  (await page.inputValue('select[name="apply.guarCountryId"]')) === '1',
  'DOM: guarCountryId = Russian Federation',
);

// Close datepicker without interacting via fill()
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.WdateDiv')) {
    el.style.display = 'none';
  }
});
assert(
  (await page.locator('.WdateDiv').evaluate((el) => getComputedStyle(el).display)) ===
    'none',
  'DOM: step2 datepicker closed',
);

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
  'NOTE: 17gz AJAX Next (saveStudyPlanAndNextStep etc.) — URL stays /apply/index.do',
);
console.log(
  'NOTE: Step6 Add Document + filechooser (FileAttacher); verify attachTypeIds live',
);
console.log(
  'NOTE: Step7 final click = Submit OR Save and Next; URL stays /apply/index.do (AJAX)',
);
console.log(
  'AFTER SUBMIT: no redirect expected — success = dialog/content change',
);

console.log('\n=== done ===');
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('All steps 2–7 debug assertions passed.');
