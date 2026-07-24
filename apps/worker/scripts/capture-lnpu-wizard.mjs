/**
 * LNPU wizard capture: session → apply_now → dump each wizard step JSON.
 * Usage: pnpm --filter worker exec node scripts/capture-lnpu-wizard.mjs
 * Optional: LNPU_APPLY_ID=13135  LNPU_HEADED=1
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const OUT = resolve(process.cwd(), '../../data/captures/lnpu');
const sessionPath = resolve(OUT, 'session.json');
const CAPTURE_FN = readFileSync(
  resolve(process.cwd(), '../../scripts/dom-field-capture.js'),
  'utf-8',
);

if (!existsSync(sessionPath)) {
  console.error('missing', sessionPath);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const storageState = JSON.parse(readFileSync(sessionPath, 'utf-8'));
const headed = process.env.LNPU_HEADED === '1' || process.env.BROWSER_HEADED === '1';
const preferApplyId = process.env.LNPU_APPLY_ID;

const browser = await chromium.launch({
  headless: !headed,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1200 },
  locale: 'en-US',
});
const page = await context.newPage();

function isLogin(url) {
  return /\/login|\/register/i.test(url);
}

async function bodySnippet() {
  return (await page.locator('body').innerText())
    .replace(/\s+/g, ' ')
    .slice(0, 400);
}

async function runCapture(stepNum) {
  const capture = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    return eval(src);
  }, CAPTURE_FN.replace(/^\(function captureDomFields\(\) \{/, '(() => {').replace(/\}\)\(\);\s*$/, '})();'));

  // fallback if IIFE returns undefined — re-inject cleanly
  const result =
    capture ??
    (await page.evaluate(() => {
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
        const parentLabel = el.closest('label');
        if (parentLabel?.textContent) {
          return parentLabel.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
        }
        const cell = el.closest('td, th, .form-group, .el-form-item, .control-group, li, tr');
        if (cell) {
          const labelEl = cell.querySelector('label, .el-form-item__label, th, .dt, .title');
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
        if (name) {
          if (tag === 'input' && type === 'radio') {
            return `input[type="radio"][name="${escapeAttr(name)}"]`;
          }
          if (tag === 'input' && type === 'checkbox') {
            return `input[type="checkbox"][name="${escapeAttr(name)}"]`;
          }
          return `${tag}[name="${escapeAttr(name)}"]`;
        }
        const id = el.getAttribute('id');
        if (id) return `#${CSS.escape(id)}`;
        return null;
      }

      const fields = [];
      for (const el of document.querySelectorAll('input, select, textarea')) {
        const tag = el.tagName.toLowerCase();
        const inputType = el.getAttribute('type') ?? tag;
        const name = el.getAttribute('name');
        if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') continue;
        const selector = buildSelector(el);
        if (!selector) continue;
        const field = {
          tag,
          inputType,
          name,
          id: el.getAttribute('id'),
          label: getLabel(el),
          placeholder: el.getAttribute('placeholder'),
          required:
            el.hasAttribute('required') ||
            el.getAttribute('aria-required') === 'true' ||
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
      for (const list of document.querySelectorAll('.attach-item-list, input[type="file"]')) {
        if (list.matches('input[type="file"]')) {
          const name = list.getAttribute('name');
          fileInputs.push({
            label: getLabel(list) || name || 'file',
            selector: name
              ? `input[type="file"][name="${escapeAttr(name)}"]`
              : 'input[type="file"]',
            required: list.hasAttribute('required'),
          });
          continue;
        }
        const attachTypeName = list.getAttribute('attachTypeName');
        const attachTypeId = list.getAttribute('attachTypeId');
        const tr = list.closest('tr');
        const raw =
          tr?.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim() ??
          attachTypeName;
        fileInputs.push({
          label: raw?.replace(/^\*\s*/, '').slice(0, 200) ?? 'document',
          selector: attachTypeId
            ? `[attachTypeId="${attachTypeId}"]`
            : `[attachTypeName="${attachTypeName}"]`,
          attachTypeName: attachTypeName ?? undefined,
          required: raw?.startsWith('*') ?? false,
        });
      }

      const nextBtn = [
        ...document.querySelectorAll(
          'input[type="button"], input[type="submit"], button, a.btn, a.button',
        ),
      ].find((el) =>
        /^(save and )?next|next step|save$/i.test(
          (el.value || el.textContent || '').trim(),
        ),
      );
      const submitBtn = [
        ...document.querySelectorAll(
          'input[type="button"], input[type="submit"], button, a.btn',
        ),
      ].find((el) =>
        /^submit/i.test((el.value || el.textContent || '').trim()),
      );

      // CUCAS step tabs
      const activeStep = document.querySelector(
        '.step .active, .steps .active, li.active, .nav-tabs .active, .process .on',
      );
      const stepTitle = activeStep?.textContent?.replace(/\s+/g, ' ').trim();

      return {
        url: location.href,
        capturedAt: new Date().toISOString(),
        wizardStepTitle: stepTitle || undefined,
        fields,
        fileInputs: fileInputs.length ? fileInputs : undefined,
        navigation: {
          nextButtonSelector: nextBtn
            ? nextBtn.tagName === 'INPUT'
              ? `input[value="${(nextBtn.getAttribute('value') || '').replace(/"/g, '\\"')}"]`
              : `${nextBtn.tagName.toLowerCase()}${nextBtn.id ? `#${nextBtn.id}` : ''}`
            : undefined,
          submitButtonSelector: submitBtn
            ? submitBtn.tagName === 'INPUT'
              ? `input[value="${(submitBtn.getAttribute('value') || '').replace(/"/g, '\\"')}"]`
              : 'button'
            : undefined,
        },
        bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
      };
    }));

  const path = resolve(OUT, `wizard-step-${stepNum}.json`);
  writeFileSync(path, JSON.stringify({ wizardStep: stepNum, ...result }, null, 2));
  console.log(
    `saved wizard-step-${stepNum}.json fields=${result.fields?.length ?? 0} files=${result.fileInputs?.length ?? 0} url=${result.url}`,
  );
  return result;
}

async function dismissOverlays() {
  for (const sel of [
    'button:has-text("OK")',
    'button:has-text("Confirm")',
    'button:has-text("Agree")',
    'button:has-text("I Agree")',
    'button:has-text("Accept")',
    'input[value="Agree"]',
    'input[value="OK"]',
    '.layui-layer-btn0',
    '.el-message-box__btns button',
  ]) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }

  const agreeCb = page.locator('input[type="checkbox"][name*="agree"], input#agree, input[name="agree"]').first();
  if ((await agreeCb.count()) > 0) {
    await agreeCb.check({ force: true }).catch(() => undefined);
  }
}

async function clickNext() {
  await dismissOverlays();
  const candidates = [
    'input[value="Next"]',
    'input[value="Save and Next"]',
    'input[value="Save"]',
    'button:has-text("Next")',
    'a:has-text("Next")',
    'input[value="Submit"]',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click({ force: true });
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      await page.waitForTimeout(1500);
      return sel;
    }
  }
  // JS fallback
  const clicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input, button, a')].find((n) =>
      /^(save and )?next|next step|continue$/i.test(
        (n.value || n.textContent || '').trim(),
      ),
    );
    if (!el) return null;
    el.click();
    return (el.value || el.textContent || '').trim();
  });
  if (clicked) {
    await page.waitForTimeout(1500);
  }
  return clicked;
}

async function isWizardForm() {
  const url = page.url();
  if (/apply_forms|apply\/forms|student\/apply\/\w+/i.test(url) && !/apply\/index$/i.test(url)) {
    const n = await page.locator('input[name*="student"], input[name*="passport"], textarea[name*="text"]').count();
    if (n >= 2) return true;
  }
  const n = await page.locator('input[name="student[last_name]"], input[name="passport[number]"]').count();
  return n > 0;
}

async function isProgramList() {
  return /\/student\/apply\/index\/?(\?|$)/i.test(page.url()) &&
    (await page.locator('a[onclick*="apply_now"]').count()) > 0;
}

// --- start ---
await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
console.log('start', page.url(), await bodySnippet());

if (isLogin(page.url())) {
  console.error('SESSION EXPIRED — re-login needed');
  if (headed) {
    console.log('Log in manually (5 min)…');
    await page.goto('http://lnpu.chiwest.cn/en/student/login', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(
      (u) => /\/en\/student\//i.test(u.pathname) && !/login|register/i.test(u.pathname),
      { timeout: 5 * 60_000 },
    );
    await context.storageState({ path: sessionPath });
    console.log('session refreshed');
  } else {
    await browser.close();
    process.exit(2);
  }
}

await page.goto('http://lnpu.chiwest.cn/en/student/apply/index', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.waitForTimeout(1500);
console.log('program list', page.url());

// Prefer English Bachelor if possible, else first apply_now
const applyId = await page.evaluate((prefer) => {
  const links = [...document.querySelectorAll('a[onclick*="apply_now"]')];
  if (prefer) {
    const hit = links.find((a) => a.getAttribute('onclick')?.includes(`apply_now(${prefer})`));
    if (hit) {
      hit.click();
      return prefer;
    }
  }
  // Prefer English instruction language rows
  const rows = [...document.querySelectorAll('table tbody tr')];
  for (const row of rows) {
    const text = row.innerText || '';
    if (/english/i.test(text) && /bachelor|master|doctoral|language/i.test(text)) {
      const a = row.querySelector('a[onclick*="apply_now"]');
      if (a) {
        const id = a.getAttribute('onclick')?.match(/apply_now\((\d+)\)/)?.[1];
        a.click();
        return id || 'row';
      }
    }
  }
  const first = links[0];
  if (!first) return null;
  const id = first.getAttribute('onclick')?.match(/apply_now\((\d+)\)/)?.[1];
  first.click();
  return id || 'first';
}, preferApplyId);

console.log('clicked apply_now', applyId);
await page.waitForTimeout(2000);
await page.waitForLoadState('domcontentloaded').catch(() => undefined);
await dismissOverlays();
console.log('after apply_now', page.url(), await bodySnippet());

// Advance pre-wizard (scholarship / agreement / notes) up to real form
for (let i = 0; i < 10; i += 1) {
  if (await isWizardForm()) break;
  if (await isProgramList()) {
    console.log('still on program list — apply_now may have failed');
    break;
  }

  const stepLabel = `pre-${i + 1}`;
  await runCapture(stepLabel);

  // scholarship radios etc.
  await page.evaluate(() => {
    const radio = document.querySelector('input[type="radio"]:not(:disabled)');
    if (radio && !document.querySelector('input[type="radio"]:checked')) {
      radio.click();
    }
    const cb = document.querySelector(
      'input[type="checkbox"][name*="agree"], input#agree, input[name="agree"]',
    );
    if (cb && !cb.checked) cb.click();
  });

  const clicked = await clickNext();
  console.log(`pre-wizard advance ${i}: clicked=${clicked} url=${page.url()}`);
  await dismissOverlays();

  if (!clicked) break;
}

// Capture wizard steps + try to advance (may stall on required fields)
let step = 1;
let prevSig = '';
for (; step <= 12; step += 1) {
  if (isLogin(page.url())) {
    console.error('hit login mid-wizard');
    break;
  }

  const cap = await runCapture(step);
  const sig = `${page.url()}|${cap.fields?.length}|${cap.wizardStepTitle}|${(cap.fields || [])
    .map((f) => f.name)
    .slice(0, 5)
    .join(',')}`;

  if (sig === prevSig) {
    console.log('no progress — stop (fill required fields manually?)');
    if (headed) {
      console.log('HEADED: fill step + click Next. Waiting 3 min for URL/field change…');
      const before = sig;
      await page.waitForFunction(
        (prev) => {
          const names = [...document.querySelectorAll('input[name],select[name],textarea[name]')]
            .map((e) => e.getAttribute('name'))
            .filter(Boolean)
            .slice(0, 5)
            .join(',');
          const cur = `${location.href}|${names}`;
          return cur !== prev.split('|').slice(0, 1).concat(names).join('|') &&
            !/login/i.test(location.href);
        },
        before,
        { timeout: 180_000 },
      ).catch(() => null);
      await page.waitForTimeout(1000);
      const cap2 = await runCapture(step);
      const sig2 = `${page.url()}|${cap2.fields?.length}`;
      if (sig2 === `${before.split('|')[0]}|${cap.fields?.length}`) {
        break;
      }
      prevSig = sig2;
      continue;
    }
    break;
  }
  prevSig = sig;

  // Stop if submit-only page with few fields
  if (
    /submit/i.test(cap.bodySnippet || '') &&
    (cap.fields?.length ?? 0) < 3 &&
    !(cap.fileInputs?.length)
  ) {
    console.log('likely submit page — done');
    break;
  }

  const clicked = await clickNext();
  console.log(`wizard step ${step} next=${clicked}`);
  if (!clicked) {
    if (headed) {
      console.log('No Next found — waiting for manual navigation…');
      await page.waitForTimeout(60_000);
    } else {
      break;
    }
  }
  await dismissOverlays();
}

await context.storageState({ path: sessionPath });
writeFileSync(
  resolve(OUT, 'session.json.b64'),
  Buffer.from(readFileSync(sessionPath)).toString('base64'),
);
console.log('session refreshed + session.json.b64 written');
console.log('done at', page.url());

if (headed) {
  await page.waitForTimeout(10_000);
}
await browser.close();
