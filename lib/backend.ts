// lib/backend.ts — shared helper for the Next.js booking API routes (server-side only)
import { backendOrigin, withSlash } from "./backend-url";

// "https://host" and "https://host/api" both end up as "https://host/api"
export const API_BASE = `${backendOrigin(process.env.BACKEND_API_URL, process.env.NEXT_PUBLIC_API_URL)}/api`;

// Render free instances can take ~50 s to wake up, so allow a generous timeout.
const TIMEOUT_MS = 30_000;

export type BackendResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

export async function backendFetch<T = any>(
  path: string,
  init: { method: string; body?: unknown },
  request?: Request,
): Promise<BackendResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  // Forward the caller's credentials so the backend knows who is acting.
  const auth = request?.headers.get("authorization");
  if (auth) headers.Authorization = auth;
  // Lets the backend de-duplicate retried withdrawals and similar requests.
  const idem = request?.headers.get("idempotency-key");
  if (idem) headers["Idempotency-Key"] = idem;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${withSlash(path)}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null; // an HTML error page is never passed on to the user
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? undefined : extractError(data, res.status),
    };
  } catch (err: any) {
    const timedOut = err?.name === "AbortError";
    console.error(`[backend] ${init.method} ${path} failed:`, err);
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      data: null,
      error: timedOut ? "Backend timed out" : "Backend unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractError(data: any, status: number): string {
  if (!data) return `Backend error (${status})`;
  if (typeof data === "string") return data;
  if (data.error) return String(data.error); // the API's own envelope: { success: false, error }
  if (data.detail) return String(data.detail);
  if (data.message) return String(data.message);
  // DRF field errors: { field: ["msg"] }
  const first = Object.entries(data)[0];
  if (first) {
    const [field, msg] = first;
    return `${field}: ${Array.isArray(msg) ? msg[0] : msg}`;
  }
  return `Backend error (${status})`;
}

// Booking references are interpolated into URLs, so only allow safe characters.
export function isValidId(id: unknown): id is string | number {
  return (
    (typeof id === "number" && Number.isFinite(id)) ||
    (typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id))
  );
}

// ─── Routes ───
// Every path below is relative to /api and must match api/urls.py / api/booking_urls.py.
// A path can be overridden with an env template that uses {id} as the placeholder.
const fromTemplate =
  (envValue: string | undefined, fallback: (id: string | number) => string) =>
  (id: string | number) =>
    envValue ? envValue.replace("{id}", encodeURIComponent(String(id))) : fallback(id);

/**
 * Staff re-dispatch of a pending booking.
 * NOTE: api/views.py has booking_dispatch (staff only), but NO route points at it yet. Add
 *   path("booking/<str:reference>/dispatch/", views.booking_dispatch)
 * to api/urls.py, or set DISPATCH_ENDPOINT_TEMPLATE. Normal bookings are dispatched
 * automatically when they are created or paid, so customers never need to call this.
 */
export const dispatchPath = fromTemplate(
  process.env.DISPATCH_ENDPOINT_TEMPLATE,
  (id) => `/booking/${encodeURIComponent(String(id))}/dispatch/`,
);

// Payments are not per-booking URLs on the backend:
//   POST /api/payments/initialize/   body: { purpose: "booking", booking_ref }
//   POST /api/payments/verify/       body: { reference }
// The id argument is kept so existing callers still compile; it is only used with a template.
export const paymentInitPath = fromTemplate(process.env.PAYMENT_INIT_ENDPOINT_TEMPLATE, () => "/payments/initialize/");
export const paymentVerifyPath = fromTemplate(process.env.PAYMENT_VERIFY_ENDPOINT_TEMPLATE, () => "/payments/verify/");

export const paymentInitBody = (bookingRef: string) => ({ purpose: "booking", booking_ref: bookingRef });
export const paymentVerifyBody = (reference: string) => ({ reference });

// Reads the assigned rider out of whatever shape the backend returns.
export function extractRider(data: any) {
  const r = data?.rider ?? data?.booking?.rider ?? null;
  if (!r) return null;
  if (typeof r !== "object") return { id: r, name: "Rider", phone: "" };
  return {
    id: r.id,
    name: r.name || r.full_name || "Rider",
    phone: r.phone || r.phone_number || "",
  };
}

export type PaymentState = "paid" | "pending" | "failed";

// Reads the payment outcome from the backend's { payment_status, status } fields.
export function readPaymentState(data: any): PaymentState {
  const raw = String(data?.payment_status ?? data?.status ?? "").toLowerCase();
  if (data?.verified === true || data?.paid === true || ["success", "successful", "paid"].includes(raw)) return "paid";
  if (["failed", "abandoned", "cancelled", "canceled", "reversed", "declined", "error"].includes(raw)) return "failed";
  return "pending"; // includes the backend's 202 "still being processed" answer
}

