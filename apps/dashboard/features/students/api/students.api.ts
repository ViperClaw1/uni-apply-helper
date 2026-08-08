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
  sex?: string;
  cityOfBirth?: string;
  chineseName?: string;
  religion?: string;
  passportExpiry?: string;
  consulate?: string;
  maritalStatus?: string;
  hobby?: string;
  permanentAddress?: string;
  postCode?: string;
  currentInstitution?: string;
  beenToChina?: boolean;
  studiedInChina?: boolean;
  desiredField?: string;
};

export type EducationLevelInput = {
  degree?: string;
  institution?: string;
  major?: string;
  periodStartYear?: number;
  periodEndYear?: number;
};

export type MyEducationInput = {
  school?: EducationLevelInput;
  higher?: EducationLevelInput;
  chineseLevel?: string;
  englishLevel?: string;
};

export type MyGuarantorInput = {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  homeAddress?: string;
};

export type MyEmergencyContactInput = {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
};

export type FamilyRelativeInput = {
  fullName?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
};

export type MyFamilyInput = {
  father?: FamilyRelativeInput;
  mother?: FamilyRelativeInput;
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

export async function saveMyEducation(input: MyEducationInput) {
  const response = await sessionApiClient.put<StudentProfile>(
    "/students/me/education",
    input,
  );
  return response.data;
}

export async function saveMyGuarantor(input: MyGuarantorInput) {
  const response = await sessionApiClient.put<StudentProfile>(
    "/students/me/guarantor",
    input,
  );
  return response.data;
}

export async function saveMyEmergencyContact(input: MyEmergencyContactInput) {
  const response = await sessionApiClient.put<StudentProfile>(
    "/students/me/emergency-contact",
    input,
  );
  return response.data;
}

export async function saveMyFamily(input: MyFamilyInput) {
  const response = await sessionApiClient.put<StudentProfile>(
    "/students/me/family",
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
