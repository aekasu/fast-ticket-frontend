import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no cookie means no session, so go to the login screen without rendering. Whether the
// token is still valid is decided by the panel layout (GET /auth/me) and, for data, by the backend.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ft_token")) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|logout|_next/static|_next/image|favicon.ico).*)"],
};
