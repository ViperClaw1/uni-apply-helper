import { apiClient } from "@/lib/api-client";
import type { ApplicationBatch } from "../types/application.types";

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
