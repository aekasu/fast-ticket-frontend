import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A package-lock.json higher up (in the home directory) otherwise confuses root detection.
  turbopack: { root: path.resolve(__dirname) },
  // FastAPI's collection routes end in a slash (`/api/v1/tickets/`); Next must not strip it before the proxy
  // forwards the request.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
