export const env = {
  // Prod (Vercel): leave unset → same-origin `/api` (rewritten to Railway via API_ORIGIN).
  // Local: set NEXT_PUBLIC_API_URL=http://localhost:3000
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "/api"),
};
