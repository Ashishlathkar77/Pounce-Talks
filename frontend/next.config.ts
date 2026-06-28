import type { NextConfig } from "next";

// Backend origin the /api/* proxy points at. Defaults to the hosted backend;
// override with BACKEND_ORIGIN in .env.local (e.g. the ALB URL) for local dev
// before DNS/HTTPS for pounce-api.hemut.com is live.
const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ?? "https://pounce-api.hemut.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
