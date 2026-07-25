import { existsSync, readFileSync } from 'node:fs';
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
  channel: 'chrome',
});
const context = await browser.newContext({
  storageState: JSON.parse(readFileSync(sessionPath, 'utf8')),
});
const page = await context.newPage();
page.on('dialog', async (d) => {
  console.log('DIALOG', d.message().slice(0, 200));
  await d.accept().catch(() => undefined);
});
page.on('response', async (res) => {
  if (res.request().method() === 'POST') {
    console.log('POST', res.status(), res.url().slice(0, 140));
  }
});

for (const show of ['2', '1']) {
  const url = `http://lnpu.chiwest.cn/en/student/apply_forms?apply_id=OTg4NTU&is_show=${show}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  if (/login/i.test(page.url())) {
    console.error('SESSION EXPIRED');
    process.exit(2);
  }
  const info = await page.evaluate(() => ({
    url: location.href,
    buttons: [...document.querySelectorAll('input[type=button], input[type=submit], button')]
      .map((el) => ({
        type: el.type,
        value: el.value,
        id: el.id,
        visible: !!(el.offsetWidth || el.offsetHeight),
      })),
    hasLast: !!document.querySelector('input[name="student[last_name]"]'),
    action: document.querySelector('form')?.action,
  }));
  console.log('\n=== is_show try', show, '===');
  console.log(JSON.stringify(info, null, 2));
}

// On whichever page has Next, fill phones/selects and submit
await page.goto(
  'http://lnpu.chiwest.cn/en/student/apply_forms?apply_id=OTg4NTU&is_show=2',
  { waitUntil: 'domcontentloaded' },
);
await page.waitForTimeout(1500);
console.log('landed', page.url());

await page.evaluate(() => {
  const jq = window.jQuery || window.$;
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const type = el.type || '';
    if (['hidden', 'submit', 'button', 'file'].includes(type)) continue;
    if (type === 'checkbox') {
      el.checked = true;
      continue;
    }
    if (type === 'radio') {
      el.checked = true;
      continue;
    }
    if (el.tagName === 'SELECT') {
      const opt = [...el.options].find((o) => o.value && !/please select/i.test(o.text));
      if (opt) el.value = opt.value;
      if (jq) {
        try {
          jq(el).val(el.value).trigger('chosen:updated').trigger('change');
        } catch {}
      }
      continue;
    }
    const v = el.getAttribute('validate') || '';
    if (/tel|mobile|phone/i.test(v + el.name)) el.value = '13800138000';
    else if (/email/i.test(v + el.name)) el.value = 'a@b.com';
    else if (/date/i.test(v)) el.value = el.value || '2020-01-01';
    else if (!el.value) el.value = 'Test';
  }
});

const before = page.url();
const next = page.locator('input[value="Next"]').first();
const save = page.locator('input[value="Save"]').first();
console.log('next count', await next.count(), 'save count', await save.count());

if ((await next.count()) > 0) {
  await next.click({ force: true });
} else if ((await save.count()) > 0) {
  await save.click({ force: true });
} else {
  await page.evaluate(() => document.querySelector('form')?.submit());
}

await page.waitForTimeout(5000);
console.log('after', page.url(), 'changed', page.url() !== before);

if (/apply_forms/i.test(page.url())) {
  const applyId = 'OTg4NTU';
  await page.goto(
    `http://lnpu.chiwest.cn/en/student/apply_attr?apply_id=${applyId}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForTimeout(2000);
  console.log(
    'direct attr',
    page.url(),
    'files',
    await page.locator('#fileupload_0, [id^=fileupload]').count(),
  );
}

await browser.close();
