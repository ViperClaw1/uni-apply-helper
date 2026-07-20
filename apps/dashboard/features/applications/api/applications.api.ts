import { apiClient } from "@/lib/api-client";
import type { ApplicationBatch, ApplicationItem } from "../types/application.types";

export async function createApplicationBatch(studentId: string) {
  const response = await apiClient.post<ApplicationBatch>(
    `/students/${studentId}/applications/batches`,
  );

  return response.data;
}

export async function getApplicationBatches(studentId: string) {
  const response = await apiClient.get<ApplicationBatch[]>(
    `/students/${studentId}/applications/batches`,
  );

  return response.data;
}

export async function markApplicationReady(applicationId: string) {
  const response = await apiClient.patch<ApplicationItem>(
    `/applications/${applicationId}/ready`,
  );

  return response.data;
}
