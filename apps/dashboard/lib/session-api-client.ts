import axios from "axios";

// Deliberately NOT the shared `apiClient` from "./api-client": that client
// points straight at the Nest API in dev (bypassing the `/api` rewrite),
// which would make session cookies cross-origin and fragile. Anything that
// relies on the session cookie must go through the same-origin `/api`
// rewrite so the cookie set by the API lands scoped to the dashboard's own
// origin, in both dev and prod.
export const sessionApiClient = axios.create({ baseURL: "/api" });
