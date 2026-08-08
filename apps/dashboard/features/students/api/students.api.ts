import { apiClient } from "@/lib/api-client";
import { sessionApiClient } from "@/lib/session-api-client";
import type {
  StudentListItem,
  StudentProfile,
} from "../types/student.types";

export type MyProfileInput = {
  surname: string;
  givenName: string;
  email: string;
  phone?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportNo?: string;
};

export async function getMyProfile() {
  const response = await sessionApiClient.get<{
    student: StudentProfile | null;
  }>("/students/me");
  return response.data.student;
}

export async function saveMyProfile(input: MyProfileInput) {
  const response = await sessionApiClient.put<StudentProfile>(
    "/students/me",
    input,
  );
  return response.data;
}

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

export async function deleteStudent(studentId: string) {
  await apiClient.delete(`/students/${studentId}`);
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
