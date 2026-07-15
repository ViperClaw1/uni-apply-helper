import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { RuntimeResponse } from '../shared/messages';

function Popup() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3000');
  const [apiKey, setApiKey] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ type: 'GET_CONFIG' })
      .then((response: RuntimeResponse) => {
        if (response.ok && response.config) {
          setApiBaseUrl(response.config.apiBaseUrl ?? 'http://localhost:3000');
          setApiKey(response.config.apiKey ?? '');
        }
      });
  }, []);

  async function handleSave() {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config: { apiBaseUrl, apiKey },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config: { apiBaseUrl, apiKey },
    });

    const response = (await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
    })) as RuntimeResponse;

    setConnected(response.ok ? (response.connected ?? false) : false);
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Uni Apply Helper</h1>

      <label style={styles.label}>
        API URL
        <input
          style={styles.input}
          value={apiBaseUrl}
          onChange={(event) => setApiBaseUrl(event.target.value)}
          placeholder="http://localhost:3000"
        />
      </label>

      <label style={styles.label}>
        API Key
        <input
          style={styles.input}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="EXTENSION_API_KEY"
        />
      </label>

      <div style={styles.actions}>
        <button type="button" style={styles.button} onClick={() => void handleSave()}>
          Сохранить
        </button>
        <button type="button" style={styles.secondaryButton} onClick={() => void handleTest()}>
          Проверить
        </button>
      </div>

      {saved ? <p style={styles.success}>Сохранено</p> : null}
      {connected === true ? <p style={styles.success}>API доступен</p> : null}
      {connected === false ? <p style={styles.error}>API недоступен</p> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    padding: 16,
    fontFamily: 'system-ui, sans-serif',
    color: '#0f172a',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 16px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
  },
  input: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#0f172a',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  success: {
    color: '#16a34a',
    fontSize: 12,
    marginTop: 8,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 8,
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
