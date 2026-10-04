/** A readable message from a FastAPI error body (`detail` string, or the per-field list of a 422). */
export function errorMessage(error: unknown, fallback = "Request failed"): string {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d))).join("; ");
  }
  return fallback;
}

/** An API error that keeps the HTTP status, so a screen can tell "gone or not yours" (404) from a failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
