/**
 * lib/rydnow/config.ts
 *
 * Single source of truth for RYDNOW client constants, shared types and small pure helpers.
 * ./api.ts imports from here.
 *
 * Rules for this file:
 *  - It imports nothing, so there can be no circular import.
 *  - No React, no browser globals, no side effects (safe in server and client components).
 *  - No pricing logic. Every price comes from the backend quote; `money()` only formats it.
 *  - Request/response types (TripInput, Quote, Booking, ...) live in ./api.ts, not here.
 *
 * Values marked "CONFIRM" are business rules or codes the backend owns. UI text that quotes
 * them (cancellation window and fee) must match what the API actually enforces.
 */


/** Keeps editor autocomplete for known values while still accepting new ones from the backend. */
type Open<T extends string> = T | (string & Record<never, never>);


/** Own-property lookup, so input such as "constructor" never resolves to an Object.prototype member. */
function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}


/** Lower-cased, with `_` and spaces as `-`. */
const slug = (value: string): string => value.trim().toLowerCase().replace(/[_\s]+/g, "-");


// ═══ API transport ═══


/** Same-origin Next.js proxy. The browser never calls Django directly. */
export const API_BASE_DEFAULT = "/api/rydnow";


/** Generous: a sleeping Render instance can be slow to answer the first call. */
export const API_TIMEOUT_MS = 60_000;


/** Decimal places signed into the quote token. Quote and create must round identically. */
export const COORD_DECIMALS = 6;


// ═══ Errors ═══


export type ApiErrorKind =
  | "network"
  | "timeout"
  | "aborted"
  | "auth"
  | "forbidden"
  | "not_found"
  | "payment_required"
  | "conflict"
  | "rate_limited"
  | "validation"
  | "server"
  | "bad_response"
  | "unknown";


/** Customer-safe fallback copy for each error kind. */
export const ERROR_MESSAGES: Readonly<Record<ApiErrorKind, string>> = {
  network: "No connection. Check your internet and try again.",
  timeout: "This is taking longer than usual. Please try again.",
  aborted: "The request was cancelled.",
  auth: "Please sign in again.",
  forbidden: "You don't have permission to do that.",
  not_found: "We couldn't find what you were looking for.",
  payment_required: "A payment is needed before you can continue.",
  conflict: "This has changed since you last looked. Refresh and try again.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  validation: "Please check your details and try again.",
  server: "Something went wrong on our side. Please try again in a moment.",
  bad_response: "We received an unexpected response. Please try again.",
  unknown: "Something went wrong. Please try again.",
};


/** Backend error codes meaning "request a new quote". CONFIRM against the booking views. */
export const QUOTE_RETRY_CODES: readonly string[] = [
  "quote_expired",
  "quote_invalid",
  "invalid_quote",
  "quote_used",
  "quote_mismatch",
];


// ═══ Services ═══


export const SERVICE_KEYS = ["okada", "parcel", "waste-bin"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];


/** Order the services appear on the dashboard. */
export const SERVICE_ORDER: readonly ServiceKey[] = SERVICE_KEYS;


export const SERVICE_LABELS: Readonly<Record<ServiceKey, string>> = {
  okada: "Okada",
  parcel: "Parcel",
  "waste-bin": "Waste Collection",
};


/** Behavioural limits per service. Display and input gating only; the backend validates again. */
export interface ServiceHints {
  /** false for pickups with no destination (waste collection). */
  readonly requiresDestination: boolean;
  /** Maximum extra stops between pickup and destination. */
  readonly maxStops: number;
  /** Longest wait the customer can add at a single stop, in minutes. */
  readonly maxWaitMinutes: number;
  /** Minutes after a provider accepts during which cancelling is still free. */
  readonly cancelGraceMinutes: number;
  /** Fee in GHS for cancelling after the grace period. */
  readonly cancelFeeAccepted: number;
}


// CONFIRM every number below against the backend settings.
export const SERVICE_HINTS: Readonly<Record<ServiceKey, ServiceHints>> = {
  okada: { requiresDestination: true, maxStops: 3, maxWaitMinutes: 15, cancelGraceMinutes: 2, cancelFeeAccepted: 5 },
  parcel: { requiresDestination: true, maxStops: 3, maxWaitMinutes: 15, cancelGraceMinutes: 2, cancelFeeAccepted: 5 },
  "waste-bin": { requiresDestination: false, maxStops: 0, maxWaitMinutes: 0, cancelGraceMinutes: 5, cancelFeeAccepted: 5 },
};


export function isServiceKey(value: unknown): value is ServiceKey {
  return typeof value === "string" && (SERVICE_KEYS as readonly string[]).includes(value);
}


/** Alternate spellings the backend or older bookings may use. */
const SERVICE_ALIASES: Readonly<Record<string, ServiceKey>> = {
  bike: "okada",
  ride: "okada",
  delivery: "parcel",
  waste: "waste-bin",
  "waste-collection": "waste-bin",
  "waste-bin-collection": "waste-bin",
};


/** Maps any backend service string to a ServiceKey, or null when it is not recognised. */
export function normalizeServiceKey(value: string | null | undefined): ServiceKey | null {
  if (!value) return null;
  const key = slug(value);
  return isServiceKey(key) ? key : (lookup(SERVICE_ALIASES, key) ?? null);
}


// ═══ Places ═══


export interface Place {
  address: string;
  lat: number;
  lng: number;
}


// ═══ Payments ═══


export const PAYMENT_METHODS = ["cash", "momo", "card", "wallet"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];


export const PAYMENT_LABEL: Readonly<Record<PaymentMethod, string>> = {
  cash: "Cash",
  momo: "Mobile Money",
  card: "Card",
  wallet: "RYDNOW Wallet",
};


/** Methods paid on the hosted Paystack page before dispatch. */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = ["momo", "card"];


const PAYMENT_ALIASES: Readonly<Record<string, PaymentMethod>> = {
  "mobile-money": "momo",
};


export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}


/** Maps a payment method string to a PaymentMethod, or null when it is not recognised. */
export function normalizePaymentMethod(value: string | null | undefined): PaymentMethod | null {
  if (!value) return null;
  const key = slug(value);
  return isPaymentMethod(key) ? key : (lookup(PAYMENT_ALIASES, key) ?? null);
}


/** State of a payment record. CONFIRM against the Django model. */
export type PaymentRecordStatus = Open<"pending" | "paid" | "failed" | "refunded">;


// ═══ Quotes ═══


/** Used when the backend sends no (or an invalid) quote lifetime. CONFIRM against the API's quote TTL. */
export const QUOTE_FALLBACK_TTL_SECONDS = 120;


/** Surge reason codes. CONFIRM against the backend. */
export type SurgeReason = Open<"high_demand" | "peak_hours" | "bad_weather" | "low_supply">;


export const SURGE_REASON_LABELS: Readonly<Record<string, string>> = {
  high_demand: "High demand",
  peak_hours: "Busy hours",
  bad_weather: "Bad weather",
  low_supply: "Fewer providers nearby",
};


/** Unknown codes return undefined; the UI then shows the multiplier without a reason. */
export function surgeReasonLabel(reason: string | null | undefined): string | undefined {
  return reason ? lookup(SURGE_REASON_LABELS, reason) : undefined;
}


// ═══ Riders ═══


export const NEARBY_DEFAULT_RADIUS_KM = 5;
export const NEARBY_POLL_MS = 10_000;


/** Rider account review state. */
export type VerificationStatus = Open<
  "not_started" | "pending" | "under_review" | "approved" | "rejected" | "suspended"
>;


/** Rider document code sent to auth/rider/verify/. CONFIRM the codes and narrow this type. */
export type DocumentType = string;


// ═══ Lists ═══


export const PAGE_SIZE_DEFAULT = 20;


// ═══ Bookings ═══


/** CONFIRM against the backend's status list. */
export type BookingStatus = Open<
  "pending" | "accepted" | "completed" | "cancelled" | "canceled" | "expired" | "failed" | "no_riders_found"
>;


/** Statuses after which a booking can never change. */
const TERMINAL_BOOKING_STATUSES: ReadonlySet<string> = new Set<BookingStatus>([
  "completed",
  "cancelled",
  "canceled",
  "expired",
  "failed",
  "no_riders_found",
]);


export function isTerminalBooking(status: string | null | undefined): boolean {
  return !!status && TERMINAL_BOOKING_STATUSES.has(status.trim().toLowerCase());
}


// ═══ Formatting ═══


const ghs = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });


/**
 * Formats a GHS amount for display, for example "GH₵12.50".
 * A missing or invalid amount shows "—", never a misleading zero price.
 */
export function money(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" && amount.trim() !== "" ? Number(amount) : amount;
  return typeof n === "number" && Number.isFinite(n) ? ghs.format(n) : "—";
}


/** Same as `money`; kept for existing imports. */
export const formatMoney = money;


/** The trust line under the price card, built from SERVICE_HINTS. */
export function cancellationPolicyText(service: ServiceKey): string {
  const h = SERVICE_HINTS[service];
  return (
    `Cancel free until a rider accepts. After that, free for ${h.cancelGraceMinutes} ` +
    `minutes, then a small fee of ${money(h.cancelFeeAccepted)}.`
  );
}


