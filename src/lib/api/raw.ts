import { ApiError, errorMessage } from "./errors";

/**
 * Untyped GET through the same-origin proxy, for the config-driven admin screens, whose paths and shapes come from
 * `lib/admin/resources.ts` rather than from one literal path each. Everything else uses the typed client.
 */
export async function getJson<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(path);
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new ApiError(errorMessage(body, `Request failed (${res.status})`), res.status);
  return body as T;
}
