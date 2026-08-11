import { apiClient } from "@/lib/api-client";
import type {
  ApplicationBatch,
  ApplicationItem,
  ApplicationReadiness,
} from "../types/application.types";

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

export async function getApplicationsReadiness(studentId: string) {
  const response = await apiClient.get<ApplicationReadiness[]>(
    `/students/${studentId}/applications/readiness`,
  );

  return response.data;
}

export async function markApplicationReady(applicationId: string) {
  const response = await apiClient.patch<ApplicationItem>(
    `/applications/${applicationId}/ready`,
  );

  return response.data;
}

export async function submitApplication(applicationId: string) {
  const response = await apiClient.post<ApplicationItem>(
    `/applications/${applicationId}/consultant-submit`,
  );

  return response.data;
}
