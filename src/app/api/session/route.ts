import { NextResponse } from "next/server";
import { FASTAPI_URL, TOKEN_COOKIE, cookieBase } from "@/lib/server/config";

/** Log in: forward the credentials, keep the token in an httpOnly cookie, return no token. */
export async function POST(request: Request) {
  const { username, password } = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${FASTAPI_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const headers = new Headers();
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    const body = (await upstream.json().catch(() => ({}))) as { detail?: unknown };
    return NextResponse.json(
      {
        error: upstream.headers.get("X-Login-Error") ?? (upstream.status === 429 ? "rate_limited" : "login_failed"),
        retry_after: retryAfter ? Number(retryAfter) : undefined,
        detail: typeof body.detail === "string" ? body.detail : undefined,
      },
      { status: upstream.status, headers },
    );
  }

  const { access_token, expires_in } = (await upstream.json()) as { access_token: string; expires_in: number };
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE, access_token, { ...cookieBase, maxAge: expires_in });
  return response;
}

/** Log out: the API has no revoke endpoint, so dropping the cookie is the whole logout. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return response;
}
