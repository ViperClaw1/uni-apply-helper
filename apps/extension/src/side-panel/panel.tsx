import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { FillSession, RuntimeResponse } from '../shared/messages';

function statusColor(status: string) {
  switch (status) {
    case 'filled':
      return '#16a34a';
    case 'missing':
      return '#dc2626';
    case 'skipped':
      return '#ca8a04';
    default:
      return '#64748b';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'filled':
      return 'Заполнено';
    case 'missing':
      return 'Не найдено';
    case 'skipped':
      return 'Пропущено';
    default:
      return status;
  }
}

function Panel() {
  const [session, setSession] = useState<FillSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_FILL_SESSION',
    })) as RuntimeResponse;

    if (response.ok) {
      setSession(response.session ?? null);
    }
  }, []);

  useEffect(() => {
    void loadSession();

    const listener = (message: { type?: string; session?: FillSession }) => {
      if (message.type === 'FIELDS_FILLED' && message.session) {
        setSession(message.session);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    const interval = window.setInterval(() => void loadSession(), 2000);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      window.clearInterval(interval);
    };
  }, [loadSession]);

  async function handleConfirmSubmit() {
    if (!session?.applicationId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = (await chrome.runtime.sendMessage({
      type: 'CONFIRM_SUBMIT',
      applicationId: session.applicationId,
    })) as RuntimeResponse;

    if (!response.ok) {
      setError(response.error ?? 'Unknown error');
    } else {
      setSession({ ...session, submitted: true });
    }

    setIsSubmitting(false);
  }

  if (!session) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Uni Apply</h1>
        <p style={styles.muted}>Откройте форму вуза через дашборд — заполнение начнётся автоматически.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Uni Apply</h1>
      <div style={styles.card}>
        <div style={styles.label}>Студент</div>
        <div style={styles.value}>{session.studentName}</div>
        <div style={{ ...styles.label, marginTop: 12 }}>Вуз</div>
        <div style={styles.value}>{session.universityName}</div>
        {session.wizardStep && session.wizardTotalSteps ? (
          <div style={styles.progress}>
            Шаг {session.wizardStep} / {session.wizardTotalSteps}
          </div>
        ) : null}
        {session.submitted ? (
          <div style={styles.success}>Заявка отмечена как отправленная</div>
        ) : null}
      </div>

      <div style={styles.fields}>
        {session.results.map((field) => (
          <div key={field.selector} style={styles.fieldRow}>
            <span style={{ color: statusColor(field.status), fontWeight: 600 }}>
              {statusLabel(field.status)}
            </span>
            <span style={styles.fieldLabel}>{field.label ?? field.selector}</span>
          </div>
        ))}
      </div>

      {!session.submitted ? (
        <button
          type="button"
          style={styles.button}
          disabled={isSubmitting}
          onClick={() => void handleConfirmSubmit()}
        >
          {isSubmitting ? 'Отправляем...' : 'Отметить как отправлено'}
        </button>
      ) : null}

      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'system-ui, sans-serif',
    padding: 16,
    color: '#0f172a',
    background: '#f8fafc',
    minHeight: '100vh',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 2,
  },
  progress: {
    marginTop: 12,
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: 600,
  },
  success: {
    marginTop: 12,
    fontSize: 12,
    color: '#16a34a',
    fontWeight: 600,
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: '#fff',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
  },
  fieldLabel: {
    color: '#475569',
    wordBreak: 'break-all',
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#0f172a',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  muted: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.5,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 8,
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
