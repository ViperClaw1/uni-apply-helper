import { sessionApiClient as authClient } from "@/lib/session-api-client";

export type AccountRole = "student" | "agency";

export type Account = {
  id: string;
  email: string;
  role: AccountRole;
  emailVerifiedAt: string | null;
  agencyProfile?: { legalName: string; country: string; taxId: string };
};

export type SignupPayload = {
  email: string;
  password: string;
  confirmPassword: string;
  role: AccountRole;
  agency?: { legalName: string; country: string; taxId: string };
};

export async function signup(payload: SignupPayload) {
  // Email verification is temporarily not required (no verified Resend
  // sending domain yet) — the API logs the caller in immediately and
  // returns `account`. Once verification is required again, it'll return
  // `email` only and the caller should show a "check your email" state.
  const response = await authClient.post<{ email?: string; account?: Account }>(
    "/auth/signup",
    payload,
  );
  return response.data;
}

export async function login(payload: { email: string; password: string }) {
  const response = await authClient.post<{ account: Account }>(
    "/auth/login",
    payload,
  );
  return response.data;
}

export async function verifyEmail(token: string) {
  const response = await authClient.post<{ account: Account }>(
    "/auth/verify-email",
    { token },
  );
  return response.data;
}

export async function logout() {
  await authClient.post("/auth/logout");
}

export async function me() {
  const response = await authClient.get<{ account: Account }>("/auth/me");
  return response.data;
}
