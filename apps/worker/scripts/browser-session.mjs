import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from './stealth-browser.mjs';

function getProfilesRoot() {
  return process.env.BROWSER_PROFILES_DIR || resolve(process.cwd(), 'profiles');
}

export function resolveUniversityProfileDir(universityId) {
  return join(getProfilesRoot(), universityId);
}

export function getSessionPaths(universityId) {
  const sessionsDir = resolve(process.cwd(), 'browser-sessions');
  return {
    sessionsDir,
    sessionFile: join(sessionsDir, `${universityId}.json`),
    metaFile: join(sessionsDir, `${universityId}-meta.json`),
    b64File: join(sessionsDir, `${universityId}.json.b64`),
  };
}

export function loadSessionMeta(universityId) {
  const { metaFile } = getSessionPaths(universityId);

  if (!existsSync(metaFile)) {
    return {};
  }

  return JSON.parse(readFileSync(metaFile, 'utf-8'));
}

export function saveSessionMeta(universityId, meta) {
  const { sessionsDir, metaFile } = getSessionPaths(universityId);
  mkdirSync(sessionsDir, { recursive: true });
  writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
}

export function loadUniversitySession(universityId) {
  const envKey = `${universityId.toUpperCase().replace(/-/g, '_')}_SESSION_STATE_B64`;
  const b64 = process.env[envKey];

  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  const { sessionFile } = getSessionPaths(universityId);

  if (existsSync(sessionFile)) {
    return JSON.parse(readFileSync(sessionFile, 'utf-8'));
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

export function getBrowserOptions(universityId) {
  const profileDir = resolveUniversityProfileDir(universityId);
  const profileExists = existsSync(profileDir);

  return {
    headless: process.env.BROWSER_HEADLESS === '1',
    channel: process.env.BROWSER_CHANNEL || process.env.ZZU_BROWSER_CHANNEL || 'chrome',
    profileDir,
    profileExists,
    useProfile:
      process.env.BROWSER_USE_PROFILE !== '0' &&
      (process.env.BROWSER_USE_PROFILE === '1' || profileExists),
    cdpUrl: process.env.BROWSER_USE_CDP === '1' ? process.env.BROWSER_CDP_URL : undefined,
  };
}

export async function createUniversityBrowserSession(
  universityId,
  { forCapture = false, preferStorageState = false } = {},
) {
  const options = getBrowserOptions(universityId);
  const meta = loadSessionMeta(universityId);
  const state = loadUniversitySession(universityId);

  if (forCapture) {
    mkdirSync(options.profileDir, { recursive: true });

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
    } catch (error) {
      console.warn(
        `Profile "${options.profileDir}" busy or locked — falling back to storageState.`,
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

export async function closeUniversityBrowserSession(session) {
  if (!session.closable || process.env.BROWSER_KEEP_OPEN === '1') {
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

export async function persistUniversitySession(universityId, context) {
  const { sessionsDir, sessionFile, b64File } = getSessionPaths(universityId);
  const meta = loadSessionMeta(universityId);

  mkdirSync(sessionsDir, { recursive: true });
  await context.storageState({ path: sessionFile });

  if (!meta.userAgent) {
    const page = context.pages()[0];
    if (page) {
      meta.userAgent = await page.evaluate(() => navigator.userAgent);
    }
  }

  meta.capturedAt = new Date().toISOString();
  meta.mode = 'profile';
  meta.universityId = universityId;
  saveSessionMeta(universityId, meta);

  const b64 = Buffer.from(readFileSync(sessionFile)).toString('base64');
  writeFileSync(b64File, b64, 'utf-8');
}

export function printSessionArtifacts(universityId) {
  const profileDir = resolveUniversityProfileDir(universityId);
  const { sessionFile, b64File, metaFile } = getSessionPaths(universityId);
  const envKey = `${universityId.toUpperCase().replace(/-/g, '_')}_SESSION_STATE_B64`;

  console.log('\nСохранено:');
  console.log(`  Profile:       ${profileDir}`);
  console.log(`  storageState:  ${sessionFile}`);
  console.log(`  base64:        ${b64File}`);
  console.log(`  meta:          ${metaFile}`);
  console.log('\nRailway (если без Volume):');
  console.log(`  ${envKey}=<содержимое ${b64File}>`);
  console.log('  (или ZZU_SESSION_STATE_B64 / SDU_SESSION_STATE_B64 — legacy aliases)');
  console.log('\nАвтопуш: задай RAILWAY_API_TOKEN + PROJECT/ENVIRONMENT/SERVICE_ID в apps/worker/.env');
  console.log('\nRailway (рекомендуется Volume):');
  console.log('  BROWSER_PROFILES_DIR=/data/profiles');
  console.log('  + Volume mount /data на сервис worker');
}
