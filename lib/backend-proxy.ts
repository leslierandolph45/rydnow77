// lib/backend-proxy.ts
// Server-only helper: forwards a JSON request to the Django API and relays the response.
// Set BACKEND_API_URL in Vercel (Project Settings -> Environment Variables).
import { NextRequest, NextResponse } from "next/server";
import { backendOrigin, withSlash } from "./backend-url";

// "https://host" and "https://host/api" both work (no ".../api/api/...").
const BACKEND = backendOrigin(process.env.BACKEND_API_URL, process.env.NEXT_PUBLIC_API_URL);

// Render free-tier services can take a while to wake up, so be generous.
const BACKEND_TIMEOUT_MS = 30_000;

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

function jsonError(detail: string, status: number) {
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Forward a JSON request. `backendPath` is relative to /api (for example "/booking/create/");
 * the trailing slash is added if missing and the incoming query string is passed on.
 */
export async function proxyRequest(req: NextRequest, backendPath: string, method: Method = "POST") {
  let body: string | undefined;
  try {
    const text = await req.text();
    if (text) {
      JSON.parse(text); // reject malformed JSON early
      body = text;
    }
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;
  const idem = req.headers.get("idempotency-key");
  if (idem) headers["Idempotency-Key"] = idem;

  const path = withSlash(backendPath);
  const url = `${BACKEND}/api${path}${path.includes("?") ? "" : req.nextUrl.search}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(res.status === 204 ? null : text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return jsonError(
      aborted
        ? "The booking service took too long to respond. Please try again."
        : "Could not reach the booking service. Please try again.",
      aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}

// Existing callers keep working.
export const proxyPost = (req: NextRequest, backendPath: string) => proxyRequest(req, backendPath, "POST");
export const proxyPatch = (req: NextRequest, backendPath: string) => proxyRequest(req, backendPath, "PATCH");

