const STEP_LABELS: Record<string, string> = {
  validate_requirements: "Проверка документов",
  open_form: "Открытие формы",
  fill_wizard: "Заполнение формы",
  submit: "Отправка",
};

export function getStepLabel(stepName: string) {
  return STEP_LABELS[stepName] ?? stepName;
}

export function getStepStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "в очереди",
    processing: "в работе",
    completed: "готово",
    failed: "ошибка",
    skipped: "пропущено",
  };

  return labels[status] ?? status;
}

/** Pull a short human message out of raw API/JSON error blobs. */
export function formatErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Неизвестная ошибка";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const extracted = extractMessage(parsed);
    if (extracted) {
      return humanizeKnownErrors(extracted);
    }
  } catch {
    // not JSON — fall through
  }

  const nestedJson = trimmed.match(/\{[\s\S]*"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (nestedJson?.[1]) {
    return humanizeKnownErrors(nestedJson[1].replace(/\\"/g, '"'));
  }

  return humanizeKnownErrors(trimmed);
}

function extractMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value : null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.message === "string") {
    return record.message;
  }

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") {
      return nested.message;
    }
  }

  return null;
}

function humanizeKnownErrors(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("exceeded your current quota") || lower.includes("quota")) {
    return "Сервис временно перегружен (лимит запросов). Попробуйте позже.";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Слишком много запросов. Подождите немного и повторите.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Превышено время ожидания. Попробуйте ещё раз.";
  }

  if (message.length > 180) {
    return `${message.slice(0, 177)}…`;
  }

  return message;
}
