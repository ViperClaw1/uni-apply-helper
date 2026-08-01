const STEP_LABELS: Record<string, string> = {
  validate_requirements: "Проверка документов",
  open_form: "Открытие формы",
  fill_wizard: "Заполнение формы",
  submit: "Отправка",
  extension_ready: "Готово к заполнению",
  consultant_submit: "Отправка консультантом",
};

const STEP_ORDER: Record<string, number> = {
  validate_requirements: 1,
  open_form: 2,
  fill_wizard: 3,
  extension_ready: 4,
  submit: 5,
  consultant_submit: 6,
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

/** Pipeline order: first step at top. */
export function sortStepsByPipeline<T extends { stepName: string; startedAt?: string }>(
  steps: T[],
): T[] {
  return [...steps].sort((left, right) => {
    const leftOrder = STEP_ORDER[left.stepName] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = STEP_ORDER[right.stepName] ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftStarted = left.startedAt ? Date.parse(left.startedAt) : 0;
    const rightStarted = right.startedAt ? Date.parse(right.startedAt) : 0;

    return leftStarted - rightStarted;
  });
}
