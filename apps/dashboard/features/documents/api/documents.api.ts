import { apiClient } from "@/lib/api-client";
import type { StudentDocument } from "../types/document.types";

export async function getStudentDocuments(studentId: string) {
  const response = await apiClient.get<StudentDocument[]>(
    `/students/${studentId}/documents`,
  );

  return response.data;
}

export async function uploadStudentDocument(
  studentId: string,
  type: string,
  file: File,
) {
  const form = new FormData();
  form.append("type", type);
  form.append("file", file);

  return response.data;
}

export async function retryDocumentParse(documentId: string) {
  const response = await apiClient.post<StudentDocument>(
    `/documents/${documentId}/parse`,
  );

  return response.data;
}
