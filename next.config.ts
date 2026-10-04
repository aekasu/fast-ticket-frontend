import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
