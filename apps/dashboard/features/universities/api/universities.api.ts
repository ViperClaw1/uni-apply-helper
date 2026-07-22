import { apiClient } from "@/lib/api-client";
import type { UniversitySummary } from "../types/university.types";

export async function getUniversities() {
  const response = await apiClient.get<UniversitySummary[]>("/universities");

  return response.data;
}

export async function resolveUniversityByFormUrl(formUrl: string) {
  const response = await apiClient.get<UniversitySummary>("/universities/by-form-url", {
    params: { url: formUrl },
  });

  return response.data;
}
