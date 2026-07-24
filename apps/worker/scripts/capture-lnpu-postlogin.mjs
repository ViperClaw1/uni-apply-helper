/**
 * Headed LNPU capture: you solve captcha + login, script dumps post-login HTML.
 * Usage: node scripts/capture-lnpu-postlogin.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const OUT = resolve(process.cwd(), '../../data/captures/lnpu');
mkdirSync(OUT, { recursive: true });

const LOGIN = 'http://lnpu.chiwest.cn/en/student/login';
const DASHBOARD = 'http://lnpu.chiwest.cn/en/student/index';
const MY_APP = 'http://lnpu.chiwest.cn/en/student/index/all';

const browser = await chromium.launch({
  headless: false,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'en-US',
});
const page = await context.newPage();

await page.goto(LOGIN, { waitUntil: 'domcontentloaded', timeout: 60_000 });

// Login form (public)
const loginForm = await page.evaluate(() => {
  const form = document.querySelector('#myform, form[name="myform"], form');
  return form ? form.outerHTML : null;
});
if (loginForm) {
  writeFileSync(resolve(OUT, 'login-form.outer.html'), loginForm, 'utf-8');
  console.log('saved login-form.outer.html', loginForm.length);
}

console.log('\n=== LOGIN NOW (captcha) — waiting up to 5 min for /student/ (not login) ===\n');

await page.waitForURL(
  (url) => /\/en\/student\//i.test(url.pathname) && !/login|register/i.test(url.pathname),
  { timeout: 5 * 60_000 },
);

console.log('logged in →', page.url());

async function dump(label, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  const finalUrl = page.url();
  const title = await page.title();
  const bodyText = (await page.locator('body').innerText())
    .replace(/\s+/g, ' ')
    .slice(0, 500);

  const payload = await page.evaluate(() => {
    const pick = (...sels) => {
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el) return { selector: s, html: el.outerHTML };
      }
      return null;
    };

    const main =
      pick(
        '.main',
        '#main',
        '.content',
        '.container',
        '.student-main',
        '#content',
        'form',
      ) || { selector: 'body', html: document.body.outerHTML };

    return {
      pageHtml: document.documentElement.outerHTML,
      main,
      links: [...document.querySelectorAll('a[href]')]
        .map((a) => ({ text: (a.innerText || '').trim().slice(0, 80), href: a.getAttribute('href') }))
        .filter((x) => /apply|application|program|major|agree|next/i.test(`${x.text} ${x.href}`))
        .slice(0, 40),
    };
  });

  writeFileSync(resolve(OUT, `${label}.page.html`), payload.pageHtml, 'utf-8');
  writeFileSync(resolve(OUT, `${label}.main.outer.html`), payload.main.html, 'utf-8');
  writeFileSync(
    resolve(OUT, `${label}.meta.json`),
    JSON.stringify({ finalUrl, title, bodyText, mainSelector: payload.main.selector, links: payload.links }, null, 2),
    'utf-8',
  );
  console.log(`saved ${label}.* url=${finalUrl} main=${payload.main.selector} len=${payload.main.html.length}`);
}

await dump('01-dashboard', DASHBOARD);
await dump('02-my-application', MY_APP);

// If APPLY NOW visible — click and dump next screen (program search / agreement)
const applyClicked = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('a, button, div, span, input')];
  const el = candidates.find((n) => /apply\s*now/i.test((n.innerText || n.value || '').trim()));
  if (!el) return false;
  el.click();
  return true;
});

if (applyClicked) {
  await page.waitForTimeout(2500);
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  const label = '03-after-apply-now';
  const payload = await page.evaluate(() => {
    const el =
      document.querySelector('.main, #main, .content, .container, form') ||
      document.body;
    return {
      url: location.href,
      html: el.outerHTML,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    };
  });
  writeFileSync(resolve(OUT, `${label}.main.outer.html`), payload.html, 'utf-8');
  writeFileSync(
    resolve(OUT, `${label}.meta.json`),
    JSON.stringify({ finalUrl: payload.url, bodyText: payload.body }, null, 2),
    'utf-8',
  );
  console.log(`saved ${label} url=${payload.url} len=${payload.html.length}`);
} else {
  console.log('APPLY NOW not found on My Application — dump stops at 02');
}

await context.storageState({ path: resolve(OUT, 'session.json') });
console.log('saved session.json');
console.log('\nDone. Browser stays open 30s — close when ready.');
await page.waitForTimeout(30_000);
await browser.close();
