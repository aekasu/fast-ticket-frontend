import "server-only";

export const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** httpOnly cookie that holds the backend's access token. Never readable from page JavaScript. */
export const TOKEN_COOKIE = "ft_token";

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
