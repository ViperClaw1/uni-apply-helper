import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';
import {
  getSessionPaths,
  persistUniversitySession,
  printSessionArtifacts,
  saveSessionMeta,
} from './browser-session.mjs';
import {
  canPushToRailway,
  loadWorkerEnvFile,
  pushSessionToRailway,
} from './push-session-to-railway.mjs';

loadWorkerEnvFile();

/**
 * Headed LNPU capture: captcha + login → persist browser-sessions/lnpu.json(.b64).
 *
 * Usage:
 *   pnpm --filter worker capture:lnpu-session
 *   pnpm --filter worker capture:session -- --university=lnpu
 */
const UNIVERSITY_ID = 'lnpu';
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

const loginForm = await page.evaluate(() => {
  const form = document.querySelector('#myform, form[name="myform"], form');
  return form ? form.outerHTML : null;
});
if (loginForm) {
  writeFileSync(resolve(OUT, 'login-form.outer.html'), loginForm, 'utf-8');
  console.log('saved login-form.outer.html', loginForm.length);
}

console.log(
  '\n=== LOGIN NOW (captcha) — waiting up to 5 min for /student/ (not login) ===\n',
);

await page.waitForURL(
  (url) =>
    /\/en\/student\//i.test(url.pathname) &&
    !/login|register/i.test(url.pathname),
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
      pick('.main', '#main', '.content', '.container', 'form') || {
        selector: 'body',
        html: document.body.outerHTML,
      };

    return {
      pageHtml: document.documentElement.outerHTML,
      main,
      links: [...document.querySelectorAll('a[href]')]
        .map((a) => ({
          text: (a.innerText || '').trim().slice(0, 80),
          href: a.getAttribute('href'),
        }))
        .filter((x) =>
          /apply|application|program|major|agree|next/i.test(
            `${x.text} ${x.href}`,
          ),
        )
        .slice(0, 40),
    };
  });

  writeFileSync(resolve(OUT, `${label}.page.html`), payload.pageHtml, 'utf-8');
  writeFileSync(
    resolve(OUT, `${label}.main.outer.html`),
    payload.main.html,
    'utf-8',
  );
  writeFileSync(
    resolve(OUT, `${label}.meta.json`),
    JSON.stringify(
      {
        finalUrl,
        title,
        bodyText,
        mainSelector: payload.main.selector,
        links: payload.links,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(
    `saved ${label}.* url=${finalUrl} main=${payload.main.selector} len=${payload.main.html.length}`,
  );
}

await dump('01-dashboard', DASHBOARD);
await dump('02-my-application', MY_APP);

const userAgent = await page.evaluate(() => navigator.userAgent);
saveSessionMeta(UNIVERSITY_ID, {
  userAgent,
  capturedAt: new Date().toISOString(),
  mode: 'storageState',
  universityId: UNIVERSITY_ID,
  platform: 'cucas',
});

await persistUniversitySession(UNIVERSITY_ID, context);

const { sessionFile, b64File } = getSessionPaths(UNIVERSITY_ID);
writeFileSync(resolve(OUT, 'session.json'), readFileSync(sessionFile));
writeFileSync(resolve(OUT, 'session.json.b64'), readFileSync(b64File));
printSessionArtifacts(UNIVERSITY_ID);

if (canPushToRailway()) {
  console.log('\nПушим LNPU_SESSION_STATE_B64 в Railway…');
  try {
    await pushSessionToRailway(UNIVERSITY_ID);
  } catch (error) {
    console.error(
      `Railway push failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} else {
  console.log(
    '\nRailway push пропущен — нет RAILWAY_* в apps/worker/.env. Залей browser-sessions/lnpu.json.b64 вручную.',
  );
}

console.log('\nDone. Browser stays open 20s.');
await page.waitForTimeout(20_000);
await browser.close();
