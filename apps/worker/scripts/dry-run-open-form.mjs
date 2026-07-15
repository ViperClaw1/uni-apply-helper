import {
  closeZzuBrowserSession,
  createZzuBrowserSession,
  loadZzuSession,
} from './zzu-browser.mjs';
import { printVerifyResult, verifyZzuWizard } from './zzu-verify.mjs';

(async () => {
  const storageState = loadZzuSession();
  if (!storageState) {
    console.error('No session — run capture:zzu-session first');
    process.exit(1);
  }

  const session = await createZzuBrowserSession(storageState, {
    preferStorageState: true,
  });
  const { page } = session;

  console.log(
    `Browser mode: ${session.mode} (channel: chrome, stealth: on, headed: ${process.env.ZZU_HEADLESS !== '1'})`,
  );
  console.log('Replay via storageState → apply/index.do → Edit ...');

  const result = await verifyZzuWizard(page, { replayMode: true });
  printVerifyResult(result);

  if (!result.ok) {
    process.exit(1);
  }

  await closeZzuBrowserSession(session);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
