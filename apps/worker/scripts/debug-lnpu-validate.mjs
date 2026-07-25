/**
 * Focused: fill ALL selects + Chinese phones, validate(), click Next, dump result.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './stealth-browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sessionPath = [
  resolve(root, 'apps/worker/browser-sessions/lnpu.json'),
  resolve(root, 'data/captures/lnpu/session.json'),
].find((p) => existsSync(p));

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({
  storageState: JSON.parse(readFileSync(sessionPath, 'utf8')),
  viewport: { width: 1400, height: 900 },
});
const page = await context.newPage();
page.on('dialog', async (d) => {
  console.log('DIALOG', d.message().slice(0, 300));
  await d.accept().catch(() => undefined);
});

page.on('response', async (res) => {
  const u = res.url();
  if (/apply_forms|apply_attr|save|next|check/i.test(u) && res.request().method() !== 'GET') {
    let body = '';
    try {
      body = (await res.text()).slice(0, 300);
    } catch {}
    console.log('POST', res.status(), u.slice(0, 120), body.slice(0, 150));
  }
});

await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
if (/login/i.test(page.url())) {
  console.error('SESSION EXPIRED');
  process.exit(2);
}
await page.waitForTimeout(2500);
const cont = page.locator('a.b_continue[href*="apply_forms"]').first();
if ((await cont.count()) > 0) {
  await cont.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
} else {
  await page.goto(
    'http://lnpu.chiwest.cn/en/student/apply_forms?apply_id=OTg4NTU&is_show=2',
    { waitUntil: 'domcontentloaded', timeout: 60_000 },
  );
  await page.waitForTimeout(1500);
}

if (!(await page.locator('input[name="student[last_name]"]').count())) {
  console.error('Not on application form', page.url());
  process.exit(3);
}

console.log('url', page.url());

const result = await page.evaluate(async () => {
  const jq = window.jQuery || window.$;

  const fillAll = () => {
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const type = el.type || el.tagName.toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file') continue;
      if (type === 'checkbox') {
        el.checked = true;
        continue;
      }
      if (type === 'radio') {
        if (![...document.querySelectorAll(`input[name="${el.name}"]`)].some((r) => r.checked)) {
          el.checked = true;
        }
        continue;
      }
      if (el.tagName === 'SELECT') {
        if (!el.value || /please select/i.test(el.options[el.selectedIndex]?.text || '')) {
          const opt = [...el.options].find((o) => o.value && !/please select/i.test(o.text));
          if (opt) el.value = opt.value;
        }
        if (jq) {
          try {
            jq(el).val(el.value).trigger('chosen:updated').trigger('liszt:updated').trigger('change');
          } catch {}
        }
        continue;
      }
      const validate = el.getAttribute('validate') || '';
      if (/tel/i.test(validate) || /mobile|phone/i.test(el.name)) {
        el.value = '13800138000';
      } else if (/email/i.test(validate) || /email/i.test(el.name)) {
        el.value = 'test@example.com';
      } else if (/date/i.test(validate)) {
        if (!el.value) el.value = '2020-01-01';
      } else if (!el.value) {
        el.value = 'Test';
      }
      if (jq) {
        try {
          jq(el).val(el.value).trigger('input').trigger('change').trigger('blur');
        } catch {}
      }
    }
  };

  fillAll();

  const form = document.querySelector('form');
  let valid = null;
  let errorList = [];
  if (jq && form) {
    try {
      // init validator if needed
      if (typeof jq(form).validate === 'function' && !jq(form).data('validator')) {
        // already bound usually
      }
      if (typeof jq(form).valid === 'function') {
        valid = jq(form).valid();
      }
      errorList = Object.entries(jq(form).validate()?.errorMap || {}).slice(0, 40);
      if (!errorList.length) {
        errorList = jq('label.error:visible, span.error:visible')
          .map((_, e) => [(e.htmlFor || e.id || '?'), (e.textContent || '').trim()])
          .get()
          .filter((x) => x[1]);
      }
    } catch (e) {
      valid = `err:${e.message}`;
    }
  }

  const emptySelects = [...document.querySelectorAll('select')]
    .filter((s) => !s.value || /please select/i.test(s.options[s.selectedIndex]?.text || ''))
    .map((s) => s.name)
    .slice(0, 40);

  const emptyRequired = [];
  for (const el of document.querySelectorAll('[validate*="required"]')) {
    if (el.type === 'hidden') continue;
    if (el.type === 'checkbox' && !el.checked) emptyRequired.push(el.name);
    else if (el.type === 'radio') {
      if (![...document.querySelectorAll(`input[name="${el.name}"]`)].some((r) => r.checked)) {
        if (!emptyRequired.includes(el.name)) emptyRequired.push(el.name);
      }
    } else if (!(el.value || '').trim() || /please select/i.test(el.value)) {
      emptyRequired.push(el.name);
    }
  }

  return {
    valid,
    errorList,
    emptySelects,
    emptyRequired: [...new Set(emptyRequired)].slice(0, 40),
    formAction: form?.action,
    formMethod: form?.method,
    pleaseSelectCount: (document.body.innerText.match(/Please select\.\.\./g) || []).length,
  };
});

console.log(JSON.stringify(result, null, 2));
writeFileSync(resolve(root, 'data/captures/lnpu/debug-validate.json'), JSON.stringify(result, null, 2));

const before = page.url();
await page.locator('input[type="submit"][value="Next"]').first().click({ force: true });
await page.waitForTimeout(5000);
console.log('after Next', page.url(), 'changed', page.url() !== before);

// Fallback: navigate to apply_attr directly if form saved
if (page.url() === before) {
  const applyId = new URL(page.url()).searchParams.get('apply_id');
  const attr = `http://lnpu.chiwest.cn/en/student/apply_attr?apply_id=${applyId}&is_show=2`;
  console.log('trying direct nav', attr);
  await page.goto(attr, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('attr url', page.url());
  console.log(
    'fileuploads',
    await page.locator('#fileupload_0, #fileupload_1, input[type=file]').count(),
  );
}

await browser.close();
