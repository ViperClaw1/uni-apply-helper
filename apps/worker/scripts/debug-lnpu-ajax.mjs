import { readFileSync, existsSync } from 'node:fs';
import { chromium } from './stealth-browser.mjs';

const sessionPath = existsSync('../browser-sessions/lnpu.json')
  ? '../browser-sessions/lnpu.json'
  : '../../data/captures/lnpu/session.json';
const storageState = JSON.parse(readFileSync(sessionPath, 'utf-8'));

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
});
const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1000 },
  locale: 'en-US',
});
const page = await context.newPage();

await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.waitForTimeout(2000);

for (const fun of ['all', 'unfinished', 'invalid']) {
  const data = await page.evaluate(async (f) => {
    const r = await fetch(`/en/student/index/ajax_data?test=test&fun=${f}`, {
      credentials: 'same-origin',
    });
    return r.json();
  }, fun);
  console.log('ajax', fun, JSON.stringify(data).slice(0, 500));
}

// APPLY NOW → notice, scrape page for apply_id
await page.goto('http://lnpu.chiwest.cn/en/student/apply/index', {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(2000);
console.log('after apply index', page.url());

const noticeBits = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const ids = [...html.matchAll(/apply_id[=:][\"']?([A-Za-z0-9]+)/gi)].map(
    (m) => m[1],
  );
  const numeric = [...html.matchAll(/apply_id=(\d+)/gi)].map((m) => m[1]);
  return {
    url: location.href,
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
    ids: [...new Set(ids)].slice(0, 20),
    numeric: [...new Set(numeric)],
  };
});
console.log(JSON.stringify(noticeBits, null, 2));

await browser.close();
