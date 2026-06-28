import type { NextConfig } from "next";

// Backend origin the /api/* proxy points at. Defaults to the hosted backend;
// override with BACKEND_ORIGIN in .env.local (e.g. the ALB URL) for local dev
// before DNS/HTTPS for pounce-api.hemut.com is live.
const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ?? "https://pounce-api.hemut.com";

// FastAPI's collection endpoints are canonical WITH a trailing slash
// (e.g. /api/agents/). Next's :path* rewrite strips the trailing slash, so the
// backend would 307 to its own absolute (cross-origin) URL and the browser
// fetch dies on CORS. We force the trailing slash for the known collection
// roots so each proxies straight through (same-origin 200); every other path
// (item routes like /api/campaigns/{id}) falls through to the catch-all.
const COLLECTIONS = [
  "agents",
  "campaigns",
  "leads",
  "runs",
  "analytics",
  "insurance",
  "transfer-destinations",
];

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const forced = COLLECTIONS.flatMap((c) => [
      { source: `/api/${c}`, destination: `${BACKEND_ORIGIN}/api/${c}/` },
      { source: `/api/${c}/`, destination: `${BACKEND_ORIGIN}/api/${c}/` },
    ]);
    return [
      ...forced,
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
