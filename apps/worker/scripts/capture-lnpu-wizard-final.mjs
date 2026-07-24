import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const ROOT = resolve(process.cwd(), '../..');
const OUT = resolve(ROOT, 'data/captures/lnpu');
const storageState = JSON.parse(readFileSync(resolve(OUT, 'session.json'), 'utf-8'));

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1200 },
  locale: 'en-US',
});
const page = await context.newPage();

async function captureUrl(step, url, title) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);

  const result = await page.evaluate(() => {
    function escapeAttr(value) {
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function getLabel(el) {
      const id = el.getAttribute('id');
      if (id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (byFor?.textContent) {
          return byFor.textContent.replace(/\s+/g, ' ').trim();
        }
      }

      const row = el.closest('tr');
      if (row) {
        const firstTd = row.querySelector('td');
        if (firstTd?.textContent) {
          return firstTd.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
        }
      }

      const cell = el.closest('td, th, .form-group, li, .control-group');
      if (cell) {
        const labelEl = cell.querySelector('label, .dt, th, .title');
        if (labelEl?.textContent) {
          return labelEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
        }
      }

      return (
        el.getAttribute('placeholder') ||
        el.getAttribute('aria-label') ||
        el.getAttribute('name') ||
        ''
      );
    }

    function buildSelector(el) {
      const name = el.getAttribute('name');
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type');

      if (type === 'file' && el.id) {
        return `#${CSS.escape(el.id)}`;
      }

      if (name) {
        if (type === 'radio') {
          return `input[type="radio"][name="${escapeAttr(name)}"]`;
        }
        if (type === 'checkbox') {
          return `input[type="checkbox"][name="${escapeAttr(name)}"]`;
        }
        return `${tag}[name="${escapeAttr(name)}"]`;
      }

      const id = el.getAttribute('id');
      return id ? `#${CSS.escape(id)}` : null;
    }

    const fields = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const tag = el.tagName.toLowerCase();
      const inputType = el.getAttribute('type') ?? tag;
      if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') {
        continue;
      }

      const selector = buildSelector(el);
      if (!selector) continue;

      const field = {
        tag,
        inputType,
        name: el.getAttribute('name'),
        id: el.getAttribute('id'),
        label: getLabel(el),
        placeholder: el.getAttribute('placeholder'),
        required:
          el.hasAttribute('required') ||
          /required/i.test(el.getAttribute('validate') || ''),
        selector,
      };

      if (tag === 'select') {
        field.options = [...el.options]
          .map((o) => o.text.trim())
          .filter(Boolean)
          .slice(0, 30);
      }

      fields.push(field);
    }

    const fileInputs = [];
    for (const el of document.querySelectorAll('input[type="file"]')) {
      const row = el.closest('tr');
      const raw = row?.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      fileInputs.push({
        label: raw.replace(/^\*\s*/, '').slice(0, 200) || el.id || 'file',
        selector: el.id ? `#${el.id}` : 'input[type="file"]',
        required: raw.startsWith('*'),
      });
    }

    const nextBtn = [...document.querySelectorAll('input, button, a')].find((el) =>
      /^(save and )?next|save|submit$/i.test((el.value || el.textContent || '').trim()),
    );

    return {
      url: location.href,
      capturedAt: new Date().toISOString(),
      fields,
      fileInputs: fileInputs.length ? fileInputs : undefined,
      navigation: {
        nextButtonSelector:
          nextBtn?.tagName === 'INPUT'
            ? `input[value="${nextBtn.getAttribute('value')}"]`
            : undefined,
        submitButtonSelector: /submit/i.test(document.body.innerText || '')
          ? 'input[value="Submit"], a:has-text("Submit"), button:has-text("Submit")'
          : undefined,
      },
      bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });

  const payload = {
    wizardStep: step,
    wizardStepTitle: title,
    ...result,
  };

  writeFileSync(resolve(OUT, `wizard-step-${step}.json`), JSON.stringify(payload, null, 2));
  console.log(
    `step ${step} (${title}): fields=${result.fields.length} files=${result.fileInputs?.length ?? 0}`,
  );
  if (result.fileInputs?.length) {
    console.log('  files:', result.fileInputs.map((f) => f.label).join(' | '));
  }
}

await captureUrl(
  1,
  'http://lnpu.chiwest.cn/en/student/apply_forms/index?apply_id=OTg4NDg',
  'Application Form',
);
await captureUrl(
  2,
  'http://lnpu.chiwest.cn/en/student/apply_attr?apply_id=OTg4NDg',
  'Upload Materials',
);
await captureUrl(
  3,
  'http://lnpu.chiwest.cn/en/student/apply_submit?apply_id=OTg4NDg',
  'Apply Submit',
);
await captureUrl(
  'pre-1',
  'http://lnpu.chiwest.cn/en/student/apply/start?apply_id=OTg4NDg',
  'Apply Now',
);

await context.storageState({ path: resolve(OUT, 'session.json') });
writeFileSync(
  resolve(OUT, 'session.json.b64'),
  Buffer.from(readFileSync(resolve(OUT, 'session.json'))).toString('base64'),
);
await browser.close();
console.log('done');
