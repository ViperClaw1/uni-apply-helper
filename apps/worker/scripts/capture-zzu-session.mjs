import { LOGIN_URL } from './zzu-constants.mjs';
import {
  closeZzuBrowserSession,
  createZzuBrowserSession,
  persistZzuSession,
  saveSessionMeta,
} from './zzu-browser.mjs';
import { printVerifyResult, verifyZzuWizard } from './zzu-verify.mjs';

(async () => {
  const useProfile = process.env.ZZU_USE_PROFILE !== '0';
  const keepOpen = process.env.ZZU_KEEP_OPEN !== '0';
  const session = await createZzuBrowserSession(undefined, { forCapture: true });
  const { page } = session;

  await page.goto(LOGIN_URL);
  console.log('Stealth + Chrome channel. Залогинься, реши капчу, дождись кабинета.');
  console.log('После успешного логина нажми Enter в этом терминале.');

  await new Promise((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  const userAgent = await page.evaluate(() => navigator.userAgent);
  saveSessionMeta({
    userAgent,
    capturedAt: new Date().toISOString(),
    mode: useProfile ? 'profile' : 'storageState',
  });

  await persistZzuSession(session.context);
  console.log('Сессия сохранена: zzu-session.json + .b64 + zzu-session-meta.json');

  if (useProfile) {
    console.log('Persistent profile: zzu-browser-profile/');
  }

  console.log('\nПроверка в том же браузере (без перезапуска)...');
  const result = await verifyZzuWizard(page, { fromCurrentPage: true });
  printVerifyResult(result);

  if (keepOpen) {
    console.log('\nБраузер оставлен открытым. Закрой окно вручную когда закончишь.');
    console.log('Ctrl+C в терминале чтобы завершить скрипт.');
    console.log('Отдельный dry-run: закрой браузер → pnpm dry-run:open-form');
    process.exit(result.ok ? 0 : 1);
  }

  await closeZzuBrowserSession(session);
  process.exit(result.ok ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
