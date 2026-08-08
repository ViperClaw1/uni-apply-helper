import { cookies } from "next/headers";
import type { Account } from "@/features/auth/api/auth.api";
import type { StudentProfile } from "@/features/students/types/student.types";

async function serverFetch(path: string) {
  const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, "");
  if (!apiOrigin) {
    return null;
  }

  const cookieHeader = (await cookies()).toString();
  return fetch(`${apiOrigin}${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
}

export async function getCurrentAccount(): Promise<Account | null> {
  const response = await serverFetch("/auth/me");
  if (!response?.ok) {
    return null;
  }

  const data = (await response.json()) as { account: Account };
  return data.account;
}

export async function getMyStudentProfile(): Promise<StudentProfile | null> {
  const response = await serverFetch("/students/me");
  if (!response?.ok) {
    return null;
  }

  const data = (await response.json()) as { student: StudentProfile | null };
  return data.student;
}
