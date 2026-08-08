import axios from "axios";

// Deliberately NOT the shared `apiClient` from "@/lib/api-client": that client
// points straight at the Nest API in dev (bypassing the `/api` rewrite), which
// would make session cookies cross-origin and fragile. Auth always goes
// through the same-origin `/api` rewrite so the cookie set by the API lands
// scoped to the dashboard's own origin, in both dev and prod.
const authClient = axios.create({ baseURL: "/api" });

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
  const response = await authClient.post<{ email: string }>(
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
