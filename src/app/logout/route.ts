import { NextResponse } from "next/server";
import { TOKEN_COOKIE, cookieBase } from "@/lib/server/config";

/** Landing point for a dead session: drop the cookie, then show the login screen. */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return response;
}
