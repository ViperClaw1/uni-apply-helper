import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { ApplicationBatch } from "@/features/applications/types/application.types";

export type TimelineEventKind =
  | "batch_created"
  | "application_created"
  | "application_submitted"
  | "step_started"
  | "step_completed"
  | "step_failed";

export type TimelineEvent = {
  id: string;
  at: string;
  kind: TimelineEventKind;
  label: string;
};

export function buildApplicationTimeline(
  batches: ApplicationBatch[],
  t: Dictionary,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const h = t.students.detail.history;

  for (const batch of batches) {
    events.push({
      id: `batch-${batch.id}-created`,
      at: batch.createdAt,
      kind: "batch_created",
      label: h.batchCreated,
    });

    for (const application of batch.applications) {
      const university = application.universityDisplayName ?? application.universityId;

      events.push({
        id: `application-${application.id}-created`,
        at: application.createdAt,
        kind: "application_created",
        label: `${h.applicationCreated} — ${university}`,
      });

      if (application.submittedAt) {
        events.push({
          id: `application-${application.id}-submitted`,
          at: application.submittedAt,
          kind: "application_submitted",
          label: `${h.applicationSubmitted} — ${university}`,
        });
      }

      for (const step of application.steps) {
        if (step.startedAt) {
          events.push({
            id: `step-${step.id}-started`,
            at: step.startedAt,
            kind: "step_started",
            label: `${step.stepName} ${h.stepStarted} — ${university}`,
          });
        }

        if (step.completedAt) {
          events.push({
            id: `step-${step.id}-completed`,
            at: step.completedAt,
            kind: step.status === "failed" ? "step_failed" : "step_completed",
            label: `${step.stepName} ${
              step.status === "failed" ? h.stepFailed : h.stepCompleted
            } — ${university}`,
          });
        }
      }
    }
  }

  return events.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
}
