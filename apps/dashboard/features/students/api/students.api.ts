import { apiClient } from "@/lib/api-client";
import type {
  StudentListItem,
  StudentProfile,
} from "../types/student.types";

export async function getStudents() {
  const response = await apiClient.get<StudentListItem[]>("/students");

  return response.data;
}

export async function getStudentProfile(studentId: string) {
  const response = await apiClient.get<StudentProfile>(
    `/students/${studentId}/profile`,
  );

  return response.data;
}

export async function setStudentApplicationTargets(
  studentId: string,
  formUrls: string[],
) {
  const response = await apiClient.put<StudentProfile>(
    `/students/${studentId}/application-targets`,
    { formUrls },
  );

  return response.data;
}
