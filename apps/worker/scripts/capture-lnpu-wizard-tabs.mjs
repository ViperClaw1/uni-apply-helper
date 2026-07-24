/**
 * Dump CUCAS tab steps: Application Form / Upload Materials / Apply Submit
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const OUT = resolve(process.cwd(), '../../data/captures/lnpu');
const sessionPath = resolve(OUT, 'session.json');
const storageState = JSON.parse(readFileSync(sessionPath, 'utf-8'));
mkdirSync(OUT, { recursive: true });

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

// Resume existing draft if possible
await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

if (/login/i.test(page.url())) {
  console.error('session expired');
  process.exit(2);
}

// Prefer Edit/Continue on unfinished application
const edited = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a, button')];
  const edit = links.find((el) =>
    /^(edit|continue|modify|完善|编辑)/i.test((el.textContent || '').trim()),
  );
  if (edit) {
    edit.click();
    return (edit.textContent || '').trim();
  }
  return null;
});
console.log('edit click', edited, page.url());
await page.waitForTimeout(2000);

if (!/apply_forms|apply\/start/i.test(page.url())) {
  // fallback to known apply_id from previous capture
  await page.goto('http://lnpu.chiwest.cn/en/student/apply_forms/index?apply_id=OTg4NDg', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
}

console.log('form url', page.url());

async function capture(label) {
  const result = await page.evaluate(() => {
    function escapeAttr(value) {
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
    function getLabel(el) {
      const id = el.getAttribute('id');
      if (id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (byFor?.textContent) return byFor.textContent.replace(/\s+/g, ' ').trim();
      }
      const cell = el.closest('td, th, .form-group, li, tr, .control-group');
      if (cell) {
        const labelEl = cell.querySelector('label, .dt, th, .title');
        if (labelEl?.textContent) {
          return labelEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
        }
      }
      return el.getAttribute('placeholder') || el.getAttribute('name') || '';
    }
    function buildSelector(el) {
      const name = el.getAttribute('name');
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type');
      if (name) {
        if (type === 'radio') return `input[type="radio"][name="${escapeAttr(name)}"]`;
        if (type === 'checkbox') return `input[type="checkbox"][name="${escapeAttr(name)}"]`;
        return `${tag}[name="${escapeAttr(name)}"]`;
      }
      const id = el.getAttribute('id');
      return id ? `#${CSS.escape(id)}` : null;
    }

    const fields = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const tag = el.tagName.toLowerCase();
      const inputType = el.getAttribute('type') ?? tag;
      if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') continue;
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
        visible: !!(el.offsetParent || el.getClientRects().length),
      };
      if (tag === 'select') {
        field.options = [...el.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 30);
      }
      fields.push(field);
    }

    const fileInputs = [];
    for (const list of document.querySelectorAll('.attach-item-list, input[type="file"], [attachTypeId]')) {
      if (list.matches('input[type="file"]')) {
        const name = list.getAttribute('name');
        fileInputs.push({
          label: getLabel(list) || name || 'file',
          selector: name ? `input[type="file"][name="${escapeAttr(name)}"]` : 'input[type="file"]',
          required: list.hasAttribute('required'),
        });
        continue;
      }
      const attachTypeName = list.getAttribute('attachTypeName');
      const attachTypeId = list.getAttribute('attachTypeId');
      const tr = list.closest('tr');
      const raw = tr?.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim() ?? attachTypeName;
      fileInputs.push({
        label: raw?.replace(/^\*\s*/, '').slice(0, 200) ?? 'document',
        selector: attachTypeId
          ? `[attachTypeId="${attachTypeId}"]`
          : `[attachTypeName="${attachTypeName}"]`,
        attachTypeName: attachTypeName ?? undefined,
        required: raw?.startsWith('*') ?? false,
      });
    }

    const tabs = [...document.querySelectorAll('a, li, span, div')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /application form|upload materials|apply submit|apply now/i.test(t))
      .slice(0, 20);

    const nextBtn = [...document.querySelectorAll('input, button, a')].find((el) =>
      /^(save and )?next|save|submit$/i.test((el.value || el.textContent || '').trim()),
    );

    return {
      url: location.href,
      capturedAt: new Date().toISOString(),
      tabs,
      fields,
      fileInputs: fileInputs.length ? fileInputs : undefined,
      navigation: {
        nextButtonSelector: nextBtn
          ? nextBtn.tagName === 'INPUT'
            ? `input[value="${nextBtn.getAttribute('value')}"]`
            : undefined
          : undefined,
      },
      bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });

  const visible = result.fields.filter((f) => f.visible);
  writeFileSync(
    resolve(OUT, `${label}.json`),
    JSON.stringify({ ...result, fields: result.fields }, null, 2),
  );
  console.log(
    label,
    'fields=',
    result.fields.length,
    'visible=',
    visible.length,
    'files=',
    result.fileInputs?.length ?? 0,
    'url=',
    result.url,
  );
  console.log('  tabs sample', result.tabs?.slice(0, 8));
  console.log('  body', result.bodySnippet?.slice(0, 200));
  return result;
}

await capture('wizard-step-1');

// Click Upload Materials tab / step
for (const text of ['Upload Materials', 'Upload', '材料']) {
  const clicked = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('a, li, span, button, div')].find((n) =>
      new RegExp(`^\\d*\\s*${t}$`, 'i').test((n.textContent || '').replace(/\s+/g, ' ').trim()) ||
      (n.textContent || '').replace(/\s+/g, ' ').trim() === t,
    );
    // also try contains
    const el2 =
      el ||
      [...document.querySelectorAll('a, li, span')].find((n) =>
        new RegExp(t, 'i').test((n.textContent || '').trim()) &&
        (n.textContent || '').trim().length < 40,
      );
    if (!el2) return null;
    el2.click();
    return (el2.textContent || '').trim();
  }, text);
  if (clicked) {
    console.log('clicked tab', clicked);
    await page.waitForTimeout(2000);
    break;
  }
}

await capture('wizard-step-2-upload');

// Apply Submit tab
for (const text of ['Apply Submit', 'Submit']) {
  const clicked = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('a, li, span')].find(
      (n) =>
        new RegExp(t, 'i').test((n.textContent || '').trim()) &&
        (n.textContent || '').trim().length < 40,
    );
    if (!el) return null;
    el.click();
    return (el.textContent || '').trim();
  }, text);
  if (clicked) {
    console.log('clicked tab', clicked);
    await page.waitForTimeout(2000);
    break;
  }
}

await capture('wizard-step-3-submit');

// Also try Next from application form to see if multipage
await page.goto('http://lnpu.chiwest.cn/en/student/apply_forms/index?apply_id=OTg4NDg', {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(1000);

// Inspect step indicator HTML
const stepHtml = await page.evaluate(() => {
  const candidates = [
    document.querySelector('.step'),
    document.querySelector('.steps'),
    document.querySelector('.process'),
    document.querySelector('#step'),
    ...document.querySelectorAll('[class*="step"]'),
  ].filter(Boolean);
  return candidates.slice(0, 5).map((el) => ({
    className: el.className,
    html: el.outerHTML.slice(0, 800),
  }));
});
writeFileSync(resolve(OUT, 'wizard-step-indicator.json'), JSON.stringify(stepHtml, null, 2));
console.log('step indicators', stepHtml.length, stepHtml.map((s) => s.className));

await context.storageState({ path: sessionPath });
await browser.close();
console.log('done');
