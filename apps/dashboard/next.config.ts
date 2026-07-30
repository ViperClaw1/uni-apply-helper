import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, "");

if (apiOrigin) {
  const looksLikeDb =
    /[@:]postgres|rlwy\.net|postgresql:\/\//i.test(apiOrigin) ||
    !/^https?:\/\//i.test(apiOrigin);

  if (looksLikeDb) {
    throw new Error(
      `API_ORIGIN must be the Nest HTTP URL (e.g. https://api-xxx.up.railway.app), not DATABASE_URL. Got: ${apiOrigin.replace(/\/\/.*@/, "//***@")}`,
    );
  }
}

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
