import {
  closeUniversityBrowserSession,
  createUniversityBrowserSession,
  persistUniversitySession,
  printSessionArtifacts,
  resolveUniversityProfileDir,
  saveSessionMeta,
} from './browser-session.mjs';
import {
  canPushToRailway,
  loadWorkerEnvFile,
  pushSessionToRailway,
} from './push-session-to-railway.mjs';
import {
  getUniversity,
  resolveUniversityId,
} from './universities.mjs';
import {
  printVerifyResult,
  verifyUniversitySession,
} from './session-verify.mjs';

loadWorkerEnvFile();

const universityId = resolveUniversityId();
const university = getUniversity(universityId);
const keepOpen = process.env.BROWSER_KEEP_OPEN !== '0';

console.log(`University: ${university.displayName} (${university.id})`);
console.log(`Platform:   ${university.platform}`);
console.log(`Login URL:  ${university.loginUrl}`);
console.log(`Profile:    ${resolveUniversityProfileDir(university.id)}`);
console.log('');

const session = await createUniversityBrowserSession(university.id, {
  forCapture: true,
});
const { page } = session;

await page.goto(university.loginUrl, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

console.log('Headed Chrome (stealth). Залогинься вручную, дождись личного кабинета.');
console.log('Для SDU/CUCAS: после логина открой раздел заявки, если нужно.');
console.log('Когда сессия готова — нажми Enter в этом терминале.\n');

await new Promise((resolve) => {
  process.stdin.once('data', () => resolve());
});

const userAgent = await page.evaluate(() => navigator.userAgent);
saveSessionMeta(university.id, {
  userAgent,
  capturedAt: new Date().toISOString(),
  mode: 'profile',
  universityId: university.id,
  platform: university.platform,
});

await persistUniversitySession(university.id, session.context);
printSessionArtifacts(university.id);

console.log('\nПроверка в том же браузере...');
const result = await verifyUniversitySession(page, university);
printVerifyResult(university, result);

if (result.ok && canPushToRailway()) {
  console.log('\nПушим сессию в Railway worker...');
  try {
    await pushSessionToRailway(university.id);
  } catch (error) {
    console.error(
      `Railway push failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error('Сессия сохранена локально — залей base64 вручную.');
  }
} else if (result.ok) {
  console.log(
    '\nRailway push пропущен (нет RAILWAY_API_TOKEN / PROJECT / ENVIRONMENT / SERVICE_ID).',
  );
}

if (keepOpen) {
  console.log('\nБраузер оставлен открытым. Закрой окно вручную когда закончишь.');
  console.log('Ctrl+C в терминале чтобы завершить скрипт.');
  process.exit(result.ok ? 0 : 1);
}

await closeUniversityBrowserSession(session);
process.exit(result.ok ? 0 : 1);
