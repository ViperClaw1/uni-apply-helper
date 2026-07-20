import { LOGIN_URL, FORM_URL } from './sdu-constants.mjs';
import {
  closeSduBrowserSession,
  createSduBrowserSession,
  DEFAULT_PROFILE_DIR,
  persistSduSession,
  saveSessionMeta,
} from './sdu-browser.mjs';
import { printVerifyResult, verifyUniversitySession } from './session-verify.mjs';
import { getUniversity } from './universities.mjs';

const university = getUniversity('shandong-university');
const useProfile = process.env.SDU_USE_PROFILE !== '0';
const keepOpen = process.env.SDU_KEEP_OPEN !== '0';

const session = await createSduBrowserSession(undefined, { forCapture: true });
const { page } = session;

await page.goto(LOGIN_URL, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

console.log(`University: ${university.displayName}`);
console.log(`Login URL:  ${LOGIN_URL}`);
console.log(`Form URL:   ${FORM_URL}`);
console.log(`Profile:    ${DEFAULT_PROFILE_DIR}`);
console.log('');
console.log('Headed Chrome. Залогинься, активируй email если нужно, дождись кабинета.');
console.log('После успешного логина нажми Enter в этом терминале.');

await new Promise((resolve) => {
  process.stdin.once('data', () => resolve());
});

const userAgent = await page.evaluate(() => navigator.userAgent);
saveSessionMeta({
  userAgent,
  capturedAt: new Date().toISOString(),
  mode: useProfile ? 'profile' : 'storageState',
  universityId: university.id,
  platform: 'cucas',
});

await persistSduSession(session.context);
console.log('Сессия сохранена: sdu-session.json + .b64 + sdu-session-meta.json');

if (useProfile) {
  console.log(`Persistent profile: ${DEFAULT_PROFILE_DIR}`);
}

console.log('\nRailway fallback:');
console.log('  SDU_SESSION_STATE_B64=<содержимое sdu-session.json.b64>');
console.log('  BROWSER_PROFILE_DIR_SHANDONG_UNIVERSITY=/data/profiles/sdu');
console.log('  или BROWSER_PROFILES_DIR=/data/profiles (+ Volume)');

console.log('\nПроверка в том же браузере...');
const result = await verifyUniversitySession(page, {
  ...university,
  formUrl: FORM_URL,
});
printVerifyResult(university, result);

if (keepOpen) {
  console.log('\nБраузер оставлен открытым. Закрой окно вручную когда закончишь.');
  console.log('Ctrl+C в терминале чтобы завершить скрипт.');
  process.exit(result.ok ? 0 : 1);
}

await closeSduBrowserSession(session);
process.exit(result.ok ? 0 : 1);
