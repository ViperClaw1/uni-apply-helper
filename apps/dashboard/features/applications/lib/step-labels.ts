import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STEP_ORDER: Record<string, number> = {
  validate_requirements: 1,
  open_form: 2,
  fill_wizard: 3,
  extension_ready: 4,
  submit: 5,
  consultant_submit: 6,
};

export function getStepLabel(stepName: string, t: Dictionary) {
  const labels: Record<string, string> = t.applications.steps.names;
  return labels[stepName] ?? stepName;
}

export function getStepStatusLabel(status: string, t: Dictionary) {
  const labels: Record<string, string> = t.applications.steps.status;

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
