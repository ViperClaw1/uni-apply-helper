/**
 * Resume LNPU session → dump My Application + click APPLY NOW → dump next screen.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const OUT = resolve(process.cwd(), '../../data/captures/lnpu');
const sessionPath = resolve(OUT, 'session.json');
if (!existsSync(sessionPath)) {
  console.error('no session.json');
  process.exit(1);
}

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

async function dump(label) {
  await page.waitForTimeout(800);
  const payload = await page.evaluate(() => {
    const candidates = [
      '.right_content',
      '.main_content',
      '#content',
      '.content',
      '.container',
      '.main',
      'form',
      'body',
    ];
    let el = null;
    let selector = 'body';
    for (const s of candidates) {
      const found = document.querySelector(s);
      if (found && found.innerText && found.innerText.trim().length > 40) {
        el = found;
        selector = s;
        break;
      }
    }
    if (!el) el = document.body;
    return {
      url: location.href,
      title: document.title,
      selector,
      html: el.outerHTML,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800),
      applyNow: [...document.querySelectorAll('a, button, input, div, span')]
        .filter((n) => /apply\s*now/i.test((n.innerText || n.value || '').trim()))
        .map((n) => ({
          tag: n.tagName,
          text: (n.innerText || n.value || '').trim().slice(0, 60),
          href: n.getAttribute?.('href') || null,
          id: n.id || null,
          className: String(n.className || '').slice(0, 80),
          onclick: n.getAttribute?.('onclick') || null,
        }))
        .slice(0, 20),
    };
  });

  writeFileSync(resolve(OUT, `${label}.main.outer.html`), payload.html, 'utf-8');
  writeFileSync(
    resolve(OUT, `${label}.meta.json`),
    JSON.stringify(
      {
        finalUrl: payload.url,
        title: payload.title,
        bodyText: payload.body,
        mainSelector: payload.selector,
        applyNow: payload.applyNow,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(label, payload.url, 'sel=', payload.selector, 'len=', payload.html.length, 'applyNow=', payload.applyNow.length);
  return payload;
}

await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

if (/login/i.test(page.url())) {
  console.error('session expired → login');
  await browser.close();
  process.exit(2);
}

const before = await dump('02b-my-application');

// Prefer real <a href> APPLY NOW
const href = before.applyNow.find((x) => x.href && !x.href.startsWith('javascript:'))?.href;
if (href) {
  const target = href.startsWith('http') ? href : new URL(href, page.url()).href;
  console.log('goto APPLY NOW href', target);
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
} else {
  console.log('click APPLY NOW via locator');
  const loc = page.getByText(/apply\s*now/i).first();
  if ((await loc.count()) > 0) {
    await loc.click({ force: true });
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForTimeout(2000);
  } else {
    console.log('no APPLY NOW found');
  }
}

await dump('03b-after-apply-now');

// Also try common CUCAS program URL
await page.goto('http://lnpu.chiwest.cn/en/student/apply/index_major', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
}).catch(() => undefined);
if (!/login/i.test(page.url())) {
  await dump('04-index-major');
}

await page.goto('http://lnpu.chiwest.cn/en/student/apply/create', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
}).catch(() => undefined);
if (!/login/i.test(page.url()) && !/404/i.test(await page.title())) {
  await dump('05-apply-create');
}

await browser.close();
console.log('done');
