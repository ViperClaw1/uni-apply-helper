/**
 * Debug LNPU apply_forms: buttons, empty required, try Next.
 * Usage: node apps/worker/scripts/debug-lnpu-next.mjs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './stealth-browser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
const outDir = resolve(root, 'data/captures/lnpu');
mkdirSync(outDir, { recursive: true });

const sessionCandidates = [
  resolve(root, 'apps/worker/browser-sessions/lnpu.json'),
  resolve(root, 'data/captures/lnpu/session.json'),
];
const sessionPath = sessionCandidates.find((p) => existsSync(p));
if (!sessionPath) {
  console.error('No LNPU session');
  process.exit(1);
}

const schema = JSON.parse(
  readFileSync(resolve(root, 'data/university-schemas/lnpu.json'), 'utf8'),
);

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({
  storageState: JSON.parse(readFileSync(sessionPath, 'utf8')),
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

page.on('dialog', async (d) => {
  console.log('DIALOG:', d.type(), d.message().slice(0, 200));
  await d.accept().catch(() => undefined);
});

await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
console.log('start', page.url());

if (/login|register/i.test(page.url())) {
  console.error('SESSION EXPIRED');
  await browser.close();
  process.exit(2);
}

// Prefer unfinished continue → apply_forms
const continueLink = page
  .locator('a.b_continue[href*="apply_forms"]')
  .first();
if ((await continueLink.count()) > 0) {
  await continueLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
} else {
  await page.goto(
    'http://lnpu.chiwest.cn/en/student/apply_forms?apply_id=OTg4NTU&is_show=2',
    { waitUntil: 'domcontentloaded', timeout: 60_000 },
  );
}

console.log('form url', page.url());

const dump = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('input, button, a.btn, a.button')]
    .map((el) => {
      const input = el;
      return {
        tag: el.tagName,
        type: el.getAttribute('type'),
        value: el.getAttribute('value') || '',
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        id: el.id || '',
        className: String(el.className || '').slice(0, 80),
        name: el.getAttribute('name') || '',
        onclick: (el.getAttribute('onclick') || '').slice(0, 200),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      };
    })
    .filter(
      (b) =>
        /save|next|submit|保存|下一步/i.test(
          `${b.value} ${b.text} ${b.onclick} ${b.id}`,
        ) || b.type === 'submit' || b.type === 'button',
    );

  const emptyRequired = [];
  for (const el of document.querySelectorAll(
    'input[validate*="required"], select[validate*="required"], textarea[validate*="required"]',
  )) {
    const input = el;
    if (input.type === 'hidden') continue;
    if (input.type === 'checkbox' || input.type === 'radio') {
      const name = input.name;
      const group = [
        ...document.querySelectorAll(`input[name="${CSS.escape(name)}"]`),
      ];
      if (!group.some((g) => g.checked)) {
        emptyRequired.push({ name, type: input.type, validate: input.getAttribute('validate') });
      }
      continue;
    }
    const val = (input.value || '').trim();
    if (!val || /^\.+please select/i.test(val) || val === '...Please select...') {
      emptyRequired.push({
        name: input.name,
        type: input.type || input.tagName,
        validate: input.getAttribute('validate'),
        value: val.slice(0, 40),
      });
    }
  }

  // Dedupe empty by name
  const seen = new Set();
  const empty = [];
  for (const e of emptyRequired) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    empty.push(e);
  }

  return {
    url: location.href,
    title: document.title,
    buttons,
    emptyRequired: empty,
    hasLastName: !!document.querySelector('input[name="student[last_name]"]'),
    durationStart: document.querySelector('input[name="apply[duration_start]"]')?.value || '',
    noticeChecked: !!document.querySelector('input[name="is_read_the_notice"]')?.checked,
  };
});

writeFileSync(
  resolve(outDir, 'debug-next-before.json'),
  JSON.stringify(dump, null, 2),
);
console.log('buttons:', dump.buttons.length);
for (const b of dump.buttons.slice(0, 30)) {
  console.log(
    `- [${b.visible ? 'V' : 'H'}] ${b.tag} type=${b.type} value="${b.value}" text="${b.text}" onclick="${b.onclick.slice(0, 80)}"`,
  );
}
console.log('emptyRequired count', dump.emptyRequired.length);
console.log(dump.emptyRequired.slice(0, 40));
console.log('durationStart', dump.durationStart, 'notice', dump.noticeChecked);

// Fill from schema (minimal JS fill)
const step1 = schema.fields.filter((f) => f.wizardStep === 1 && f.type !== 'file');
console.log('filling schema fields', step1.length);

for (const field of step1) {
  const value =
    field.type === 'checkbox'
      ? true
      : field.options?.[0] ??
        (field.mapsTo === 'personal.fullName' ? 'Test User' : undefined);
  if (value === undefined || value === null || value === '') continue;

  await page.evaluate(
    ({ selector, type, value }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      if (type === 'checkbox' || type === 'radio') {
        const nodes = document.querySelectorAll(selector);
        const first = nodes[0];
        if (first) {
          first.checked = true;
          first.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
      if (el.tagName === 'SELECT') {
        const opt = [...el.options].find(
          (o) =>
            o.text.trim() === value ||
            o.value === value ||
            o.text.toLowerCase().includes(String(value).toLowerCase()),
        );
        if (opt) {
          el.value = opt.value;
          const jq = window.jQuery;
          if (jq) {
            try {
              jq(el).val(opt.value).trigger('chosen:updated').trigger('change');
            } catch {}
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
      el.value = String(value);
      el.setAttribute('value', String(value));
      const jq = window.jQuery;
      if (jq) {
        try {
          jq(el).val(String(value)).trigger('input').trigger('change').trigger('blur');
        } catch {}
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { selector: field.selector, type: field.type, value: String(value) },
  );
}

await page.waitForTimeout(500);

// Force-fill anything still empty (simulate profile mapsTo)
await page.evaluate(() => {
  const setText = (name, value) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      const opt = [...el.options].find(
        (o) => o.value && !/please select/i.test(o.text),
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) {
          try {
            window.jQuery(el).val(opt.value).trigger('chosen:updated').trigger('change');
          } catch {}
        }
      }
      return;
    }
    if (el.type === 'checkbox') {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el.type === 'radio') {
      const first = document.querySelector(`input[type="radio"][name="${name}"]`);
      if (first) {
        first.checked = true;
        first.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  for (const el of document.querySelectorAll(
    'input[validate*="required"], select[validate*="required"], textarea[validate*="required"]',
  )) {
    if (el.type === 'hidden') continue;
    if (el.type === 'checkbox' && !el.checked) {
      setText(el.name, '1');
      continue;
    }
    if (el.type === 'radio') {
      const group = document.querySelectorAll(`input[name="${el.name}"]`);
      if (![...group].some((g) => g.checked)) setText(el.name, '1');
      continue;
    }
    const val = (el.value || '').trim();
    if (!val || /please select/i.test(val)) {
      setText(el.name, el.tagName === 'SELECT' ? '' : 'Test Value');
    }
  }
});

const afterFill = await page.evaluate(() => {
  const empty = [];
  for (const el of document.querySelectorAll(
    'input[validate*="required"], select[validate*="required"], textarea[validate*="required"]',
  )) {
    if (el.type === 'hidden') continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      const group = [
        ...document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]`),
      ];
      if (!group.some((g) => g.checked)) empty.push(el.name);
      continue;
    }
    const val = (el.value || '').trim();
    if (!val || /please select/i.test(val)) empty.push(el.name);
  }
  return [...new Set(empty)];
});
console.log('empty after force fill', afterFill.length, afterFill.slice(0, 30));

// Diagnose why Next won't advance
const diag = await page.evaluate(() => {
  const form = document.querySelector('form');
  const jq = window.jQuery || window.$;
  let valid = null;
  let validateErrors = [];
  if (jq && form && jq(form).data('validator')) {
    valid = jq(form).valid();
    validateErrors = jq(form)
      .find('.error:visible, label.error, span.error')
      .map((_, el) => (el.textContent || '').trim())
      .get()
      .filter(Boolean)
      .slice(0, 30);
  } else if (jq && form && typeof jq(form).valid === 'function') {
    try {
      valid = jq(form).valid();
    } catch (e) {
      valid = String(e);
    }
  }

  const chosenEmpty = [...document.querySelectorAll('select')].filter((sel) => {
    const text = sel.options[sel.selectedIndex]?.text || '';
    return !sel.value || /please select/i.test(text);
  }).map((s) => s.name).slice(0, 20);

  const badTel = [...document.querySelectorAll('input[validate*="tel"]')].map((el) => ({
    name: el.name,
    value: el.value,
  }));
  const badEmail = [...document.querySelectorAll('input[validate*="email"]')].map((el) => ({
    name: el.name,
    value: el.value,
  }));
  const badDate = [...document.querySelectorAll('input[validate*="date"]')].map((el) => ({
    name: el.name,
    value: el.value,
    validate: el.getAttribute('validate'),
  }));

  return {
    formAction: form?.getAttribute('action'),
    formOnsubmit: (form?.getAttribute('onsubmit') || '').slice(0, 200),
    valid,
    validateErrors,
    chosenEmpty,
    badTel,
    badEmail,
    badDate,
    pleaseSelectCount: (document.body.innerText.match(/Please select\.\.\./g) || []).length,
  };
});
console.log('diag', JSON.stringify(diag, null, 2));

// Fix phones/emails to satisfy tel/email validators, re-sync Chosen
await page.evaluate(() => {
  const jq = window.jQuery || window.$;
  for (const el of document.querySelectorAll('input[validate*="tel"]')) {
    el.value = '13800138000';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const el of document.querySelectorAll('input[validate*="email"]')) {
    el.value = 'test@example.com';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const sel of document.querySelectorAll('select')) {
    if (!sel.value || /please select/i.test(sel.options[sel.selectedIndex]?.text || '')) {
      const opt = [...sel.options].find((o) => o.value && !/please select/i.test(o.text));
      if (opt) sel.value = opt.value;
    }
    if (jq) {
      try {
        jq(sel).trigger('chosen:updated').trigger('change').trigger('liszt:updated');
      } catch {}
    }
  }
});

const beforeUrl = page.url();
// Try Save first (CUCAS tip), then Next
await page.locator('input#save_temp, input[value="Save"]').first().click({ force: true });
await page.waitForTimeout(2000);
console.log('after Save url', page.url());

await page.locator('input[type="submit"][value="Next"]').first().click({ force: true });
await page.waitForTimeout(4000);
console.log('after Next url', page.url(), 'changed?', page.url() !== beforeUrl);

const after = await page.evaluate(() => ({
  url: location.href,
  errors: [...document.querySelectorAll('span.error, label.error, .error')]
    .map((e) => (e.textContent || '').trim())
    .filter(Boolean)
    .slice(0, 20),
  tip: (document.body?.innerText || '').match(/please .{0,80}|必填.{0,40}|required.{0,40}/gi)?.slice(0, 10),
}));
writeFileSync(resolve(outDir, 'debug-next-after.json'), JSON.stringify(after, null, 2));
console.log('after', after);

await browser.close();

