const STEP_LABELS: Record<string, string> = {
  validate_requirements: "Проверка документов",
  open_form: "Открытие формы",
  fill_wizard: "Заполнение формы",
  submit: "Отправка",
  extension_ready: "Готово к заполнению",
  consultant_submit: "Отправка консультантом",
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
