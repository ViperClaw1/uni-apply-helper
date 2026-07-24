import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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
});
const page = await context.newPage();

async function dump(label, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  if (/login/i.test(page.url())) {
    console.log(label, 'SESSION EXPIRED →', page.url());
    return null;
  }

  const info = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a, button, input, span')]
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        href: el.getAttribute?.('href'),
        onclick: el.getAttribute?.('onclick'),
        className: String(el.className || '').slice(0, 40),
      }))
      .filter((x) =>
        /apply|edit|continue|modify|return|notice|完善|编辑|查看|progress|unfinished/i.test(
          `${x.text} ${x.href || ''} ${x.onclick || ''}`,
        ),
      );

    return {
      url: location.href,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
      links: links.slice(0, 50),
    };
  });

  console.log('===', label, info.url);
  console.log(info.body.slice(0, 350));
  console.log(JSON.stringify(info.links, null, 2));
  return info;
}

await dump(
  'notice',
  'http://lnpu.chiwest.cn/en/student/index/home_notice?title=apply_notice_title&content=apply_notice_content_1',
);

const panel = await page.evaluate(
  () =>
    document.querySelector('.shenqingbtn, .width_925, .content')?.outerHTML?.slice(0, 2000) ||
    '',
);
writeFileSync('../../data/captures/lnpu/home-notice.panel.html', panel);
console.log('panel:', panel.slice(0, 600));

const my = await dump('myapp', 'http://lnpu.chiwest.cn/en/student/index/all');
if (my) {
  await page.evaluate(() => {
    const a = document.querySelector('a[href*="/student/apply/index"]');
    if (a) a.click();
  });
  await page.waitForTimeout(2500);
  console.log(
    'after APPLY NOW →',
    page.url(),
    (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400),
  );

  // If notice — click RETURN and look for edit on unfinished
  if (/home_notice/i.test(page.url())) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('a, span, button')].find((el) =>
        /^return$/i.test((el.innerText || '').trim()),
      );
      btn?.click();
    });
    await page.waitForTimeout(1500);
    console.log('after RETURN →', page.url());
  }
}

await dump('unfinished', 'http://lnpu.chiwest.cn/en/student/index/unfinished');
await browser.close();
