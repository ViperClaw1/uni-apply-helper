import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

const META_FILE = resolve(process.cwd(), 'sdu-session-meta.json');
const SESSION_FILE = resolve(process.cwd(), 'sdu-session.json');
const DEFAULT_PROFILE_DIR = resolve(process.cwd(), 'profiles', 'shandong-university');

export function getSduBrowserOptions() {
  const profileDir =
    process.env.SDU_PROFILE_DIR ||
    process.env.BROWSER_PROFILE_DIR_SHANDONG_UNIVERSITY ||
    DEFAULT_PROFILE_DIR;
  const profileExists = existsSync(profileDir);

  return {
    headless: process.env.SDU_HEADLESS === '1' || process.env.BROWSER_HEADLESS === '1',
    channel:
      process.env.SDU_BROWSER_CHANNEL ||
      process.env.BROWSER_CHANNEL ||
      'chrome',
    profileDir,
    profileExists,
    useProfile:
      process.env.SDU_USE_PROFILE === '1' ||
      process.env.BROWSER_USE_PROFILE === '1' ||
      (profileExists && process.env.SDU_USE_PROFILE !== '0'),
    cdpUrl:
      process.env.SDU_USE_CDP === '1' ? process.env.SDU_CDP_URL : undefined,
  };
}

export function loadSessionMeta() {
  if (!existsSync(META_FILE)) {
    return {};
  }

  return JSON.parse(readFileSync(META_FILE, 'utf-8'));
}

export function saveSessionMeta(meta) {
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

export function loadSduSession() {
  const b64 = process.env.SDU_SESSION_STATE_B64;
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  if (existsSync(SESSION_FILE)) {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  }

  return undefined;
}

function buildContextOptions(storageState, meta) {
  const options = {
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };

  if (storageState) {
    options.storageState = storageState;
  }

  if (meta.userAgent) {
    options.userAgent = meta.userAgent;
  }

  return options;
}

export async function createSduBrowserSession(
  storageState,
  { forCapture = false, preferStorageState = false } = {},
) {
  const options = getSduBrowserOptions();
  const meta = loadSessionMeta();
  const state = storageState ?? loadSduSession();

  if (forCapture) {
    mkdirSync(options.profileDir, { recursive: true });

    if (process.env.SDU_USE_PROFILE !== '0') {
      const context = await chromium.launchPersistentContext(options.profileDir, {
        headless: false,
        channel: options.channel,
        args: ['--disable-blink-features=AutomationControlled'],
        viewport: { width: 1440, height: 1200 },
        locale: 'en-US',
        timezoneId: 'Asia/Shanghai',
      });
      const page = context.pages()[0] ?? (await context.newPage());
      return { browser: context, context, page, mode: 'profile', closable: true };
    }

    const browser = await chromium.launch({
      headless: false,
      channel: options.channel,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext(buildContextOptions(undefined, meta));
    const page = await context.newPage();

    return { browser, context, page, mode: 'capture', closable: true };
  }

  if (options.useProfile && !preferStorageState) {
    mkdirSync(options.profileDir, { recursive: true });
    try {
      const context = await chromium.launchPersistentContext(options.profileDir, {
        headless: options.headless,
        channel: options.channel,
        args: ['--disable-blink-features=AutomationControlled'],
        ...buildContextOptions(undefined, meta),
      });
      const page = context.pages()[0] ?? (await context.newPage());
      return { browser: context, context, page, mode: 'profile', closable: true };
    } catch {
      console.warn(
        'SDU profile busy or locked — falling back to storageState. Close capture browser if open.',
      );
    }
  }

  if (options.cdpUrl) {
    const browser = await chromium.connectOverCDP(options.cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return { browser, context, page, mode: 'cdp', closable: false };
  }

  const browser = await chromium.launch({
    headless: options.headless,
    channel: options.channel,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext(buildContextOptions(state, meta));
  const page = await context.newPage();

  return { browser, context, page, mode: 'storageState', closable: true };
}

export async function closeSduBrowserSession(session) {
  if (!session.closable || process.env.SDU_KEEP_OPEN === '1') {
    return;
  }

  const closeTarget =
    session.mode === 'profile' || session.mode === 'capture'
      ? session.context
      : session.browser;

  await Promise.race([
    closeTarget.close(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Browser close timeout')), 5_000),
    ),
  ]).catch(() => undefined);
}

export async function persistSduSession(context) {
  const meta = loadSessionMeta();
  await context.storageState({ path: SESSION_FILE });

  if (!meta.userAgent) {
    const page = context.pages()[0];
    if (page) {
      meta.userAgent = await page.evaluate(() => navigator.userAgent);
    }
  }

  meta.capturedAt = new Date().toISOString();
  meta.mode = process.env.SDU_USE_PROFILE === '1' ? 'profile' : 'storageState';
  meta.universityId = 'shandong-university';
  saveSessionMeta(meta);

  const b64 = Buffer.from(readFileSync(SESSION_FILE)).toString('base64');
  writeFileSync(`${SESSION_FILE}.b64`, b64, 'utf-8');
}

export { META_FILE, SESSION_FILE, DEFAULT_PROFILE_DIR };
