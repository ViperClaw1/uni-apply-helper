import { apiFetch, type ActiveApplicationResponse } from '../shared/api';
import type {
  FillSession,
  RuntimeMessage,
  RuntimeResponse,
  StorageConfig,
} from '../shared/messages';

let currentFillSession: FillSession | null = null;

async function ensurePopupOnActionClick(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}

async function openSidePanel(): Promise<void> {
  const window = await chrome.windows.getLastFocused();

  if (window.id) {
    await chrome.sidePanel.open({ windowId: window.id });
  }
}

void ensurePopupOnActionClick();

chrome.runtime.onInstalled.addListener(() => {
  void ensurePopupOnActionClick();
});

async function getConfig(): Promise<StorageConfig> {
  return chrome.storage.local.get([
    'apiBaseUrl',
    'apiKey',
    'activeStudentId',
    'activeApplicationId',
  ]) as Promise<StorageConfig>;
}

async function fetchActiveApplication(
  url: string,
): Promise<ActiveApplicationResponse | null> {
  const config = await getConfig();

  if (!config.apiBaseUrl || !config.apiKey || !config.activeStudentId) {
    console.warn('[UniApply] Extension API not configured:', {
      hasApiBaseUrl: Boolean(config.apiBaseUrl),
      hasApiKey: Boolean(config.apiKey),
      hasActiveStudentId: Boolean(config.activeStudentId),
    });
    return null;
  }

  try {
    return await apiFetch<ActiveApplicationResponse>(
      config.apiBaseUrl,
      config.apiKey,
      `/applications/active?url=${encodeURIComponent(url)}&studentId=${encodeURIComponent(config.activeStudentId)}`,
    );
  } catch (error) {
    console.warn('[UniApply] fetchActiveApplication failed:', error);
    return null;
  }
}

async function confirmSubmission(applicationId: string): Promise<void> {
  const config = await getConfig();

  if (!config.apiBaseUrl || !config.apiKey) {
    throw new Error('API not configured');
  }

  await apiFetch(config.apiBaseUrl, config.apiKey, `/applications/${applicationId}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (currentFillSession?.applicationId === applicationId) {
    currentFillSession = { ...currentFillSession, submitted: true };
  }
}

async function fetchDocument(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
  const fileName = url.split('/').pop()?.split('?')[0] ?? 'document';

  return { buffer, mimeType, fileName };
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    void (async () => {
      try {
        switch (message.type) {
          case 'GET_ACTIVE_APPLICATION': {
            const application = await fetchActiveApplication(message.url);
            sendResponse({ ok: true, application: application ?? undefined });
            break;
          }
          case 'SUBMIT_CONFIRMED':
          case 'CONFIRM_SUBMIT': {
            await confirmSubmission(message.applicationId);
            sendResponse({ ok: true });
            break;
          }
          case 'FETCH_DOCUMENT': {
            const doc = await fetchDocument(message.url);
            sendResponse({ ok: true, ...doc });
            break;
          }
          case 'SET_ACTIVE_CONTEXT': {
            await chrome.storage.local.set({
              activeStudentId: message.studentId,
              activeApplicationId: message.applicationId,
            });
            await openSidePanel();
            sendResponse({ ok: true });
            break;
          }
          case 'FIELDS_FILLED': {
            currentFillSession = message.session;
            sendResponse({ ok: true });
            break;
          }
          case 'GET_FILL_SESSION': {
            sendResponse({ ok: true, session: currentFillSession });
            break;
          }
          case 'GET_CONFIG': {
            sendResponse({ ok: true, config: await getConfig() });
            break;
          }
          case 'SAVE_CONFIG': {
            await chrome.storage.local.set(message.config);
            sendResponse({ ok: true });
            break;
          }
          case 'TEST_CONNECTION': {
            const config = await getConfig();
            if (!config.apiBaseUrl || !config.apiKey) {
              sendResponse({ ok: true, connected: false });
              break;
            }
            const response = await fetch(
              `${config.apiBaseUrl.replace(/\/$/, '')}/universities`,
            );
            sendResponse({ ok: true, connected: response.ok });
            break;
          }
          default:
            sendResponse({ ok: false, error: 'Unknown message type' });
        }
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();

    return true;
  },
);

chrome.runtime.onMessageExternal.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    if (message.type !== 'SET_ACTIVE_CONTEXT') {
      sendResponse({ ok: false, error: 'Unsupported external message' });
      return true;
    }

    void chrome.storage.local
      .set({
        activeStudentId: message.studentId,
        activeApplicationId: message.applicationId,
      })
      .then(() => openSidePanel())
      .then(() => sendResponse({ ok: true }))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));

    return true;
  },
);
