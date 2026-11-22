// lib/backend-url.ts
// ONE rule for building Django URLs, shared by lib/backend.ts, lib/backend-proxy.ts,
// app/api/rydnow/[...path]/route.ts and the useAuth hook.
//
// Env vars may be set as "https://host" or "https://host/api"; both give the same origin.
// Django routes end with "/", so withSlash() adds the slash (a POST without it is redirected
// by Django and the request body is lost).

export const DEFAULT_BACKEND = "https://rydnow-backend.onrender.com";

/** First non-empty candidate, trimmed, without trailing slashes and without a trailing "/api". */
export function backendOrigin(...candidates: Array<string | undefined | null>): string {
  const raw = candidates.find((c) => typeof c === "string" && c.trim() !== "") ?? DEFAULT_BACKEND;
  return raw.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

/** "/booking/RYD123" -> "/booking/RYD123/", keeps any "?query" or "#hash" untouched. */
export function withSlash(path: string): string {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const rest = cut === -1 ? "" : path.slice(cut);
  const rooted = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${rooted.endsWith("/") ? rooted : `${rooted}/`}${rest}`;
}

