import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Me } from "@/lib/api/me";
import { FASTAPI_URL, TOKEN_COOKIE } from "./config";

/** The signed-in agent as osTicket currently sees them, or null when logged out / the token is no longer valid. */
export const getMe = cache(async (): Promise<Me | null> => {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
});

/** For pages that need an agent. A stale cookie is cleared by the `/logout` route, not here (cookies are read-only
 * while rendering), so a dead token goes through it to avoid a redirect loop with the login page. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/logout");
  return me;
}
