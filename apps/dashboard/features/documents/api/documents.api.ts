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

  const response = await apiClient.post<StudentDocument>(
    `/students/${studentId}/documents/upload`,
    form,
  );

  return response.data;
}

export async function deleteStudentDocument(documentId: string) {
  const response = await apiClient.delete<StudentDocument>(
    `/documents/${documentId}`,
  );

  return response.data;
}

export async function reorderStudentDocuments(
  studentId: string,
  type: string,
  orderedIds: string[],
) {
  const response = await apiClient.patch<StudentDocument[]>(
    `/students/${studentId}/documents/reorder`,
    { type, orderedIds },
  );

  return response.data;
}

export async function retryDocumentParse(documentId: string) {
  const response = await apiClient.post<StudentDocument>(
    `/documents/${documentId}/parse`,
  );

  return response.data;
}
