import { apiClient } from "@/lib/api-client";
import { sessionApiClient } from "@/lib/session-api-client";
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

export async function getReloginStatus(jobId: string) {
  const response = await apiClient.get<{ status: string; failedReason?: string }>(
    `/universities/relogin-status/${jobId}`,
  );

  return response.data;
}

// Guard-protected — needs the session cookie, so sessionApiClient (not apiClient) even in dev.
export async function mintReloginViewerTicket(jobId: string) {
  const response = await sessionApiClient.post<{ ticket: string; expiresInMs: number }>(
    "/universities/relogin-viewer-ticket",
    { jobId },
  );

  return response.data;
}
