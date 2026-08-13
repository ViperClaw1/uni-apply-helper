export const env = {
  // Prod (Vercel): leave unset → same-origin `/api` (rewritten to Railway via API_ORIGIN).
  // Local: set NEXT_PUBLIC_API_URL=http://localhost:3000
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "/api"),
  // WebSocket connections (the relogin viewer) need a real absolute origin — there's no
  // rewrite equivalent for a WS upgrade the way `/api` proxies plain HTTP requests. Undefined
  // in prod unless explicitly set means the viewer feature degrades to "unavailable", not a crash.
  apiWsOrigin:
    process.env.NEXT_PUBLIC_API_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : undefined),
};
