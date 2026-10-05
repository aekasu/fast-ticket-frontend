import type { NextConfig } from "next";
import path from "node:path";

// Hostnames other than localhost that may load the dev server's scripts (`next dev` refuses cross-origin requests to its
// dev assets otherwise, so a page opened on another device would render but never become interactive). Set
// DEV_ALLOWED_ORIGINS to the hostname or IP those devices type, comma-separated, e.g. "192.168.1.20,laptop.local".
// Development only; unset by default.
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  // A package-lock.json higher up (in the home directory) otherwise confuses root detection.
  turbopack: { root: path.resolve(__dirname) },
  // FastAPI's collection routes end in a slash (`/api/v1/tickets/`); Next must not strip it before the proxy
  // forwards the request.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The panel is never meant to be framed, and thread bodies come from customers.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
