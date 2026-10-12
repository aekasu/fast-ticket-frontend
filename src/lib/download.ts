import { ApiError, errorMessage } from "./api/errors";

/** The file name in a `Content-Disposition: attachment; filename="x"` header, or null. */
export function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/**
 * Fetch a file through the same-origin proxy and save it as a blob: a plain link cannot show the API's refusal (a 404,
 * or a 501 when osTicket's server lacks an extension), a fetch can. Throws an `ApiError` carrying the API's message.
 */
export async function saveFile(path: string, fallbackName: string): Promise<string> {
  const res = await fetch(path);
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as unknown;
    throw new ApiError(errorMessage(body, `Request failed (${res.status})`), res.status);
  }
  const name = dispositionName(res.headers.get("content-disposition")) ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}
