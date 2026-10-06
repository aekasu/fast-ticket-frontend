import { NextResponse, type NextRequest } from "next/server";

// Two jobs on every page request (the API and static files are excluded below):
//  1. A Content-Security-Policy with a fresh nonce, so Next's own inline scripts run and nothing else can. The page must be
//     rendered per request for the nonce to reach its scripts (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
//  2. An optimistic session check: no cookie means no session, so go to the login screen without rendering. Whether the
//     token is still valid is decided by the panel layout (GET /auth/me) and, for data, by the backend.

const PUBLIC = ["/login", "/logout"];

function policy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // The dev server injects inline styles of its own, so there the nonce is not enough.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // React's style={{...}} attributes are not covered by a nonce; scripts stay locked down.
    "style-src-attr 'unsafe-inline'",
    // Thread HTML is sanitised, and remote images in it are not loaded (they would tell the sender when it was read).
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response =
    !PUBLIC.includes(pathname) && !request.cookies.has("ft_token") ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }],
};
