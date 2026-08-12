import { apiClient } from "@/lib/api-client";
import type { UniversityDetail, UniversitySummary } from "../types/university.types";
import type { UniversitySession } from "../types/session.types";

export async function getUniversities() {
  const response = await apiClient.get<UniversitySummary[]>("/universities");

  return response.data;
}

export async function getUniversity(id: string) {
  const response = await apiClient.get<UniversityDetail>(`/universities/${id}`);

  return response.data;
}

export async function resolveUniversityByFormUrl(formUrl: string) {
  const response = await apiClient.get<UniversitySummary>("/universities/by-form-url", {
    params: { url: formUrl },
  });

  return response.data;
}

export async function getUniversitySessions() {
  const response = await apiClient.get<UniversitySession[]>("/universities/sessions");

  return response.data;
}

export async function renewUniversitySession(universityId: string) {
  const response = await apiClient.patch<{
    jobId?: string;
    status: string;
    profilePath?: string;
  }>(`/universities/${universityId}/relogin`);

  return response.data;
}
