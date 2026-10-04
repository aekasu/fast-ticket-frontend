import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

// Browser-side typed client. It talks to our own origin: /api/v1/* is proxied to FastAPI with the cookie's token.
const onUnauthorized: Middleware = {
  async onResponse({ response }) {
    // No refresh tokens: a 401 ends the session.
    // Full page load on purpose (drops the query cache).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (response.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    return undefined;
  },
};

export const api = createClient<paths>({ baseUrl: "" });
api.use(onUnauthorized);
