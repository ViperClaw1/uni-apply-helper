import { readFileSync, existsSync } from 'node:fs';
import { chromium } from './stealth-browser.mjs';

const sessionPath = existsSync('../browser-sessions/lnpu.json')
  ? '../browser-sessions/lnpu.json'
  : '../../data/captures/lnpu/session.json';
const storageState = JSON.parse(readFileSync(sessionPath, 'utf-8'));

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 1000 },
  locale: 'en-US',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await context.newPage();

page.on('response', async (res) => {
  const url = res.url();
  if (/apply|index|datatable|all|unfinished|student/i.test(url) && res.request().resourceType() === 'xhr') {
    let body = '';
    try {
      body = (await res.text()).slice(0, 300);
    } catch {
      body = '<no body>';
    }
    console.log('XHR', res.status(), url.slice(0, 120), body.slice(0, 200));
  }
});

await page.goto('http://lnpu.chiwest.cn/en/student/index/all', {
  waitUntil: 'networkidle',
  timeout: 90_000,
});
await page.waitForTimeout(8000);

const info = await page.evaluate(() => {
  const proc = document.querySelector('#example_processing');
  return {
    url: location.href,
    processingDisplay: proc ? getComputedStyle(proc).display : null,
    continues: [...document.querySelectorAll('a.b_continue, a[href*="apply_forms"]')].map(
      (a) => a.getAttribute('href'),
    ),
    empty: document.querySelector('td.dataTables_empty')?.textContent?.trim(),
    bodySlice: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
  };
});
console.log(JSON.stringify(info, null, 2));

// Direct resume URL from earlier capture
await page.goto(
  'http://lnpu.chiwest.cn/en/student/apply_forms?apply_id=OTg4NDg&is_show=2',
  { waitUntil: 'domcontentloaded', timeout: 60_000 },
);
await page.waitForTimeout(2000);
console.log(
  'direct forms',
  page.url(),
  'fields',
  await page.locator('input[name="student[last_name]"]').count(),
);

await browser.close();
