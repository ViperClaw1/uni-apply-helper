import { apiClient } from "@/lib/api-client";
import type { GenerateLetterInput, MotivationLetter } from "../types/letter.types";

export async function getStudentLetters(studentId: string) {
  const response = await apiClient.get<MotivationLetter[]>(
    `/letters/students/${studentId}`,
  );

  return response.data;
}

export async function generateLetter(input: GenerateLetterInput) {
  const response = await apiClient.post<MotivationLetter>("/letters/generate", input);

  return response.data;
}

export async function approveLetter(letterId: string) {
  const response = await apiClient.post<MotivationLetter>(`/letters/${letterId}/approve`);

  return response.data;
}

export async function unapproveLetter(letterId: string) {
  const response = await apiClient.post<MotivationLetter>(
    `/letters/${letterId}/unapprove`,
  );

  return response.data;
}
