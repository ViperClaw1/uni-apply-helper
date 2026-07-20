import { markApplicationReady } from "../api/applications.api";
import { openUniversityForm } from "./extension-bridge";
import type { ApplicationItem } from "../types/application.types";

export function canOpenUniversityForm(application: ApplicationItem) {
  return (
    Boolean(application.formUrl) &&
    !["blocked", "submitted"].includes(application.status)
  );
}

export async function prepareAndOpenUniversityForm({
  studentId,
  application,
}: {
  studentId: string;
  application: ApplicationItem;
}) {
  if (!application.formUrl) {
    throw new Error("formUrl is missing for this application.");
  }

  if (application.status !== "ready_for_submission") {
    await markApplicationReady(application.id);
  }

  await openUniversityForm({
    studentId,
    applicationId: application.id,
    formUrl: application.formUrl,
  });
}
