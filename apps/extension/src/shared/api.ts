import type { StudentProfile, UniversitySchema } from '@uni-apply/shared';

export type ActiveApplicationResponse = {
  applicationId: string;
  studentId: string;
  university: {
    id: string;
    displayName: string;
    formUrl: string;
  };
  profile: StudentProfile;
  schema: UniversitySchema;
  motivationLetter?: string;
};

export async function apiFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}
