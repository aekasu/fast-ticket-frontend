import { NextRequest, NextResponse } from "next/server";
import { FASTAPI_URL, TOKEN_COOKIE, cookieBase } from "@/lib/server/config";

// Backend-for-frontend proxy: /api/v1/* -> FastAPI, with the cookie's token attached as a bearer header.
// The browser never sees the token, so it needs no CORS and cannot leak it.

const PASS_REQUEST_HEADERS = ["content-type", "accept", "idempotency-key"];
const PASS_RESPONSE_HEADERS = ["content-type", "content-disposition", "content-length", "retry-after", "x-login-error"];

async function proxy(request: NextRequest) {
  // Built from the raw pathname, not the route params: FastAPI's collection routes end in a slash
  // (`/tickets/`) and answer a redirect without it, so the slash must survive the proxy.
  const url = `${FASTAPI_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of PASS_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ detail: "backend_unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  // No refresh tokens: a 401 means the session is over, so drop the cookie and let the client go to /login.
  if (upstream.status === 401) response.cookies.set(TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
