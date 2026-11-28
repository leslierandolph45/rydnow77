/**
 * lib/rydnow/api.ts
 *
 * Typed client for the RYDNOW Django backend.
 *
 *   browser -> /api/rydnow/<path> -> Next.js proxy -> https://rydnow-backend.onrender.com/api/<path>
 *
 * Every path in ROUTES was copied from api/urls.py and api/booking_urls.py (relative to /api/).
 * Paths END WITH "/" because Django has APPEND_SLASH=True and a redirected POST loses its body.
 * The one exception is customer/wallet, which Django serves WITHOUT a trailing slash
 * (`path("customer/wallet", ...)`): "customer/wallet/" does not match any route.
 *
 * The frontend never sends or computes a price. Booking creation takes only the signed
 * `quote_token` returned by the quote call.
 *
 * Env:
 *   NEXT_PUBLIC_API_BASE=/api/rydnow          (API base path; defaults to /api/rydnow)
 *   NEXT_PUBLIC_RYDNOW_TOKEN_KEY=rydnow_token (localStorage key for the auth token; optional)
 */
import {
  API_BASE_DEFAULT,
  API_TIMEOUT_MS,
  COORD_DECIMALS,
  ERROR_MESSAGES,
  QUOTE_RETRY_CODES,
  SERVICE_HINTS,
  normalizePaymentMethod,
  normalizeServiceKey,
  type ApiErrorKind,
  type BookingStatus,
  type DocumentType,
  type PaymentMethod,
  type PaymentRecordStatus,
  type ServiceKey,
  type SurgeReason,
  type VerificationStatus,
} from "./config";


// ---------------------------------------------------------------------------
// Public type re-exports and aliases
// ---------------------------------------------------------------------------
export type { PaymentMethod, Place, ServiceKey, SurgeReason } from "./config";
/** A booking as the signed-in customer sees it. */
export type Booking = BookingDetail;
/** A price quote returned by booking/calculate-price/. */
export type Quote = QuoteResponse;
/** Names used by the previous client, kept so existing screens still compile. */
export type TripStop = TripStopInput & { address: string; waitMinutes: number };
export type CreateBookingInput = TripInput;


// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
/**
 * The browser must ALWAYS talk to the Next.js proxy (/api/rydnow), never straight to Django.
 * If NEXT_PUBLIC_API_BASE is set to a full backend URL by mistake, requests would skip the
 * proxy (and its trailing-slash handling), so only a same-origin path is accepted.
 */
const rawBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
// "//host" and "/\\host" are protocol-relative: they would send the token to another origin.
export const API_BASE = (/^\/(?![/\\])/.test(rawBase) ? rawBase : API_BASE_DEFAULT).replace(/\/+$/, "");


const TOKEN_KEY = process.env.NEXT_PUBLIC_RYDNOW_TOKEN_KEY || "rydnow_token";


/** Read the stored DRF token. Returns null on the server or when storage is unavailable. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}


// ===========================================================================
// 1. ROUTES (single source of truth: every call below uses these)
// ===========================================================================
/** One safe path segment. Empty, "." and ".." would silently change which route is called. */
const seg = (value: string): string => {
  const v = String(value ?? "").trim();
  if (!v || v === "." || v === "..") throw validationError("Missing or invalid reference.");
  return encodeURIComponent(v);
};


export const ROUTES = {
  // ---- api/booking_urls.py -------------------------------------------------
  quote: "booking/calculate-price/", // POST  QuoteView (AllowAny)
  quoteShortAlias: "quote/", // POST  same view, kept for old clients (api/urls.py)
  quoteLegacy: "bookings/quote/", // POST  LegacyQuoteView (deprecated)
  bookingCreate: "booking/create/", // POST  BookingViewSet.create
  bookingList: "booking/", // GET   BookingViewSet.list
  bookingDetail: (ref: string) => `booking/${seg(ref)}/`, // GET
  bookingStatus: (ref: string) => `booking/${seg(ref)}/status/`, // PATCH
  bookingCancel: (ref: string) => `booking/${seg(ref)}/cancel/`, // POST
  bookingRelease: (ref: string) => `booking/${seg(ref)}/release/`, // POST
  revenueReport: "booking/admin/revenue/", // GET   staff only
  nearbyRiders: "dispatch/rider/nearby/", // GET   NearbyRidersView  (FIX: duplicate "rider/nearby" key removed)
  // booking/webhook/ is provider-to-server only and is intentionally not here.


  // ---- api/urls.py: auth ---------------------------------------------------
  login: "auth/login/", // POST
  tokenAuth: "auth/token/", // POST  DRF obtain_auth_token
  registerCustomer: "auth/register/customer/", // POST
  registerRider: "auth/register/rider/", // POST
  sendCode: "auth/verify/send-code/", // POST
  verifyCode: "auth/verify/", // POST
  riderDocuments: "auth/rider/verify/", // POST multipart (one document per call)
  riderVerificationStatus: "auth/rider/verification-status/", // GET
  me: "auth/me/", // GET, PATCH
  customerProfile: "profile/", // GET, PATCH


  // ---- api/urls.py: health -------------------------------------------------
  health: "health/", // GET   {"status": "ok"}


  // ---- api/urls.py: rider --------------------------------------------------
  offerAccept: (id: string) => `rider/offers/${seg(id)}/accept/`, // POST
  offerDecline: (id: string) => `rider/offers/${seg(id)}/decline/`, // POST
  riderWallet: "rider/wallet/", // GET
  riderTransactions: "rider/transactions/", // GET
  riderDepositInitiate: "rider/transactions/initiate/", // POST (same view as riderDeposit)
  riderDeposit: "rider/deposit/", // POST
  riderDeposits: "rider/deposits/", // GET
  riderDepositVerify: (reference: string) => `rider/deposits/${seg(reference)}/verify/`, // GET
  riderWithdraw: "rider/withdraw/", // POST
  riderLocation: "rider/update-location/", // PATCH
  ridersNearbyLegacy: "riders/nearby/", // GET   views.get_nearby_riders


  // ---- api/urls.py: customer wallet (NO trailing slash, see header) --------
  customerWallet: "customer/wallet", // GET


  // ---- api/urls.py: payments (Paystack) -------------------------------------
  paymentsInitialize: "payments/initialize/", // POST
  paymentsVerify: "payments/verify/", // POST
  // payments/paystack/webhook/ is Paystack-to-server only and is intentionally not here.


  /**
   * Routes that exist in urls.py but whose handlers fail in the code reviewed
   * (see audit notes). Listed so nothing 404s by accident; do not build screens on them yet.
   */
  defective: {
    legacyBookings: "bookings/", // BookingViewSet list/create (same serializer problems as booking/)
    legacyBookingDetail: (ref: string) => `bookings/${seg(ref)}/`, // url kwarg `ref` vs view arg `reference`
    legacyBookingCancel: (ref: string) => `bookings/${seg(ref)}/cancel/`, // same mismatch
    promoValidate: "promos/validate/", // booking_views.promo_validate
    listBookings: "list-bookings/",
    riderBookings: "rider/bookings/",
    riderPresence: "rider/presence/",
    acceptBooking: "accept-booking/",
    declineBooking: "decline-booking/",
    arriveRide: "arrive-ride/",
    startRide: "start-ride/",
    completeRide: "complete-ride/",
    releaseBooking: "release-booking/",
  },
} as const;    


// ===========================================================================
// 2. ERRORS
// ===========================================================================
export interface ApiErrorInit {
  kind: ApiErrorKind;
  status: number; // 0 when no HTTP response was received
  method: string;
  url: string;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  raw?: unknown;
}


export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly method: string;
  readonly url: string;
  /** Machine code from the backend when it sends one (see QUOTE_RETRY_CODES), plus "route_not_found". */
  readonly code?: string;
  /** Per-field messages from DRF / the booking views. */
  readonly fieldErrors: Record<string, string[]>;
  readonly raw: unknown;


  constructor(init: ApiErrorInit) {
    super(init.message || ERROR_MESSAGES[init.kind]);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.method = init.method;
    this.url = init.url;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.raw = init.raw;
  }


  /** Worth offering "Retry". */
  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "server" || this.kind === "rate_limited";
  }


  /**
   * Text safe to show a customer. Backend messages are written for users in the kinds below
   * (views.fail(), PromoRejected, QuoteRejected...). For everything else use the generic copy.
   */
  get userMessage(): string {
    const backendIsUserFacing =
      this.kind === "validation" ||
      this.kind === "conflict" ||
      this.kind === "payment_required" ||
      this.kind === "forbidden";
    if (backendIsUserFacing && this.message && this.message !== ERROR_MESSAGES[this.kind]) return this.message;
    return ERROR_MESSAGES[this.kind];
  }


  /** A 404 whose body was NOT JSON: the URL matched no route (Django's own 404 page or the proxy),
   *  as opposed to a view saying "record not found". */
  get isRouteNotFound(): boolean {
    return this.code === "route_not_found";
  }
}


export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const isAbort = (e: unknown): boolean =>
  isApiError(e) ? e.kind === "aborted" : (e as { name?: unknown } | null | undefined)?.name === "AbortError";


/**
 * Customer-safe message for any thrown value. ApiErrors use their userMessage;
 * anything else uses `fallback`, then the generic "unknown" copy.
 * Returns "" for a cancelled request: there is nothing to tell the user.
 */
export function friendlyError(e: unknown, fallback?: string): string {
  if (isAbort(e)) return "";
  if (isApiError(e)) return e.userMessage || fallback || ERROR_MESSAGES.unknown;
  return fallback ?? ERROR_MESSAGES.unknown;
}


/** The quote token is missing, expired, used, or issued for a different trip: request a new quote. */
export function needsNewQuote(e: unknown): boolean {
  if (!isApiError(e)) return false;
  if (e.code && QUOTE_RETRY_CODES.includes(e.code)) return true;
  if (e.status === 410) return true;
  return e.kind === "validation" && Boolean(e.fieldErrors.quote_token?.length);
}


function flatten(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flatten);
  return [];
}


const RESERVED_KEYS = new Set(["success", "error", "detail", "message", "code", "details"]);


/**
 * Shapes the backend produces:
 *   views.py function views       {"success": false, "error": "..."}
 *   QuoteView 400                 {"error": "Invalid request", "details": {field: [..]}}
 *   booking_views._error          {"detail": "...", "code": "..."}
 *   DRF validation / exceptions   {field: ["..."]} or {"detail": "..."}
 * (api/exception_handler.py was not available when this was written.)
 */
function readBody(body: unknown): { message: string; code?: string; fields: Record<string, string[]> } {
  if (typeof body === "string") return { message: body, fields: {} };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "", fields: {} };


  const obj = body as Record<string, unknown>;
  const fields: Record<string, string[]> = {};
  const addFields = (source: Record<string, unknown>, skipReserved: boolean) => {
    for (const [key, value] of Object.entries(source)) {
      if (skipReserved && RESERVED_KEYS.has(key)) continue;
      const messages = flatten(value);
      if (messages.length) fields[key] = messages;
    }
  };
  if (obj.details && typeof obj.details === "object") addFields(obj.details as Record<string, unknown>, false);
  addFields(obj, true);


  const direct = [obj.error, obj.detail, obj.message].flatMap(flatten).filter(Boolean);
  // Skip QuoteView's generic "Invalid request" when it carries field details.
  const message =
    direct.find((m) => !(m === "Invalid request" && Object.keys(fields).length)) ||
    Object.values(fields).flat().join(" ");
  return { message, code: typeof obj.code === "string" ? obj.code : undefined, fields };
}


function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 402) return "payment_required";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}


// ===========================================================================
// 3. TRANSPORT
// ===========================================================================
export const tokenStore = {
  get(): string | null {
    return getToken();
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};


interface ApiConfig {
  /** Return the DRF token (sent as `Authorization: Token <key>`). Return null if the proxy adds auth itself. */
  getToken: () => string | null | Promise<string | null>;
  /** Called after a 401 on a request that carried a token, with the rejected token. */
  onUnauthorized?: (rejectedToken: string) => void;
  timeoutMs: number;
}
const cfg: ApiConfig = {
  getToken: () => tokenStore.get(),
  // A late 401 from an old session must not wipe a token saved by a newer sign-in.
  onUnauthorized: (rejected) => {
    if (tokenStore.get() === rejected) tokenStore.clear();
  },
  timeoutMs: API_TIMEOUT_MS,
};
export function configureApi(partial: Partial<ApiConfig>): void {
  Object.assign(cfg, partial);
}


type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export type Query = Record<string, QueryValue>;


interface RequestOptions {
  query?: Query;
  body?: unknown; // JSON
  form?: FormData; // multipart (uploads)
  auth?: boolean; // default true
  signal?: AbortSignal;
  idempotencyKey?: string;
  timeoutMs?: number;
}
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";


function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const qs = params.toString();
  return `${API_BASE}/${path.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
}


async function request<T>(method: Method, path: string, o: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, o.query);
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (o.form) {
    body = o.form; // the browser sets the multipart boundary
  } else if (o.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(o.body);
  }


  let sentToken: string | null = null;
  if (o.auth !== false) {
    const token = await cfg.getToken();
    if (token) {
      headers.Authorization = `Token ${token}`;
      sentToken = token;
    }
  }
  if (o.idempotencyKey) headers["Idempotency-Key"] = o.idempotencyKey;


  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, o.timeoutMs ?? cfg.timeoutMs);
  const forwardAbort = () => controller.abort();
  o.signal?.addEventListener("abort", forwardAbort, { once: true });
  if (o.signal?.aborted) controller.abort();


  // The timer and abort listener stay active until the body has been read: a connection
  // can stall or drop after the headers arrive.
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    text = await res.text();
  } catch (err) {
    const kind: ApiErrorKind = o.signal?.aborted ? "aborted" : timedOut ? "timeout" : "network";
    throw new ApiError({ kind, status: 0, method, url, raw: err });
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener("abort", forwardAbort);
  }


  let data: unknown = null;
  let isJson = true;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      isJson = false;
    }
  }


  if (!res.ok) {
    const parsed = readBody(isJson ? data : null);
    const err = new ApiError({
      kind: kindForStatus(res.status),
      status: res.status,
      method,
      url,
      message: parsed.message || undefined,
      code: parsed.code ?? (res.status === 404 && !isJson ? "route_not_found" : undefined),
      fieldErrors: parsed.fields,
      raw: isJson ? data : text.slice(0, 500),
    });
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[rydnow] ${method} ${url} -> ${res.status}${err.isRouteNotFound ? " (no route matched)" : ""}`, err.raw);
    }
    if (res.status === 401 && sentToken) cfg.onUnauthorized?.(sentToken);
    throw err;
  }
  if (text && !isJson) {
    throw new ApiError({ kind: "bad_response", status: res.status, method, url, raw: text.slice(0, 500) });
  }
  return data as T;
}


const get = <T>(path: string, query?: Query, o: RequestOptions = {}) => request<T>("GET", path, { ...o, query });
const post = <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>("POST", path, { ...o, body });
const patch = <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>("PATCH", path, { ...o, body });


// ===========================================================================
// 4. RESPONSE TYPES
// ===========================================================================
/** views.py function views wrap every success as {"success": true, "message"?, ...}. */
export type Ok<T extends object = object> = { success: true; message?: string } & T;


export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
/** DRF DecimalFields are serialised as strings. Display them; do not do arithmetic with them. */
type Decimal = string;


// ---- 4.1 Quote (booking_views.QuoteView) ---------------------------------
export interface QuoteBreakdown {
  base_fare: number;
  distance_fare: number;
  subtotal: number;
  surge_amount: number;
  minimum_fare: number;
  minimum_applied: boolean;
  ride_fare: number;
  stop_fees: number;
  waiting_charge: number;
  booking_fee: number;
  discount: number;
  promo_code: string;
}
export interface QuoteWaitingStop {
  stop: number;
  wait_minutes: number;
  billable_minutes: number;
  charge: number;
}
export interface QuoteResponse {
  service_type: ServiceKey;
  booking_service_type: string;
  currency: string;
  distance_km: number;
  price_per_km: number;
  breakdown: QuoteBreakdown;
  stops: { count: number; max_allowed: number; fee_per_stop: number };
  waiting: {
    rate_per_minute: number;
    free_minutes_per_stop: number;
    max_billable_minutes_per_stop: number;
    billable_minutes: number;
    charge: number;
    per_stop: QuoteWaitingStop[];
  };
  surge: { active: boolean; multiplier: number; reason: SurgeReason };
  /** The amount to show. */
  total_price: number;
  /** null for anonymous estimates: booking needs a logged-in user. */
  quote_token: string | null;
  quoted_at: string;
  valid_until: string;
  expires_in_seconds: number;
  /** Only on the deprecated bookings/quote/ route. */
  surge_multiplier?: number;
}


// ---- 4.2 Bookings (booking_serializers.py) -------------------------------
export interface BookingListItem {
  reference: string;
  /** Raw stored value; read it with normalizeServiceKey(). */
  service_type: string;
  service_key: ServiceKey;
  status: BookingStatus;
  status_label: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_for: string | null;
  subtotal: number;
  discount_amount: number;
  total_price: number;
  currency: string;
  created_at: string;
}
export interface BookingStopOut {
  sequence: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
}
export interface BookingHistoryEntry {
  status: string;
  notes: string;
  at: string;
}
export interface BookingRiderOut {
  id?: string;
  name: string;
  phone?: string;
  rating?: number;
  completed_trips?: number;
  photo?: string | null;
  vehicle?: { model: string; plate: string; color: string };
}
export interface BookingPaymentOut {
  reference?: string;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  amount?: number;
}
/** What the booking's customer sees. */
export interface BookingDetail extends BookingListItem {
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  notes: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  stops: BookingStopOut[];
  history: BookingHistoryEntry[];
  rider: BookingRiderOut | null;
  payment: BookingPaymentOut | null;
}
/** What the assigned rider sees (adds customer name, own earnings). */
export interface RiderBookingDetail extends BookingDetail {
  customer: { name: string; phone?: string };
  earnings: number | null;
}
/** Staff only. */
export interface StaffBookingDetail extends BookingDetail {
  customer: { id: number; name: string; phone: string };
  fare: Record<string, unknown> | null;
}


// ---- 4.3 Riders ----------------------------------------------------------
export interface NearbyRider {
  id: string;
  name: string;
  rating: number;
  tier: string;
  distance_km: number;
  latitude: number;
  longitude: number;
  vehicle: { model: string; color: string };
}
export interface LegacyNearbyRider {
  id: string;
  full_name: string;
  lat: number;
  lon: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  rating_average: number;
  location_updated_at: string | null;
}


// ---- 4.4 Auth / profile --------------------------------------------------
export type UserRole = "rider" | "staff" | "customer";
export interface LoginUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string;
  referral_code: string;
  is_verified?: boolean;
  verification_status?: VerificationStatus;
  phone_verified?: boolean;
}
export interface MeRider {
  id: string;
  role: "rider";
  rider_id: string;
  rider_code: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_photo: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "suspended";
  rejection_reason: string;
  created_at: string;
  rating: number;
  completed_jobs: number;
  vehicle_plate: string;
  acceptance_rate: number;
  completion_rate: number | null;
  is_online: boolean;
  services: { key: ServiceKey; approved: boolean; active: boolean }[];
}
export interface MeCustomer {
  id: number;
  role: "customer";
  full_name: string;
  email: string;
  phone_number: string;
  phone_verified: boolean;
  profile_photo: string | null;
  status: "active" | "blocked";
  referral_code: string;
  created_at: string;
}
export interface CustomerProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  profile_photo: string | null;
  preferred_language: string;
  marketing_opt_in: boolean;
  segment: string;
  total_bookings: number;
  rating_average: number;
  outstanding_fees: Decimal;
  referral_code: string | null;
  can_book: boolean;
  loyalty_tier: string;
  created_at: string;
}
export interface RiderDocumentState {
  type: DocumentType;
  label: string;
  name: string | null;
  status: "missing" | "uploaded" | "approved" | "rejected";
  url: string | null;
  notes: string;
}


// ---- 4.5 Wallets ---------------------------------------------------------
export interface CustomerWalletTx {
  id: number;
  reference: string;
  transaction_type: string;
  type_display: string;
  direction: "credit" | "debit";
  status: string;
  amount: Decimal;
  balance_after: Decimal;
  currency: string;
  description: string;
  booking_reference: string;
  created_at: string;
}
export interface RiderWalletOut {
  balance: Decimal;
  held_balance: Decimal;
  total_funds: Decimal;
  currency: string;
  total_earned: Decimal;
  total_withdrawn: Decimal;
  min_withdrawal: Decimal;
  daily_withdrawal_limit: Decimal;
  is_active: boolean;
  is_frozen: boolean;
  frozen_reason: string;
  updated_at: string;
}
export interface RiderWalletTx {
  id: number;
  reference: string;
  transaction_type: string;
  type_display: string;
  direction: "credit" | "debit";
  status: string;
  status_display: string;
  amount: Decimal;
  signed_amount: Decimal;
  balance_before: Decimal;
  balance_after: Decimal;
  currency: string;
  description: string;
  booking_ref: string;
  created_at: string;
}
export interface TransactionQuery extends Query {
  type?: string;
  direction?: "credit" | "debit";
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
  min_amount?: string | number;
  max_amount?: string | number;
  search?: string;
  ordering?: "-created_at" | "created_at" | "-amount" | "amount";
  page?: number;
  page_size?: number;
}
export interface WithdrawalOut {
  id: number;
  reference: string;
  amount: Decimal;
  fee: Decimal;
  net_amount: Decimal;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  status_display: string;
  method: string;
  provider: string;
  account_name: string;
  masked_account: string;
  failure_reason: string;
  requested_at: string;
  processed_at: string | null;
}


// ---- 4.6 Payments --------------------------------------------------------
export interface InitializePaymentBody {
  purpose: "booking" | "wallet_deposit";
  /** required when purpose === "booking" */
  booking_ref?: string;
  /** required when purpose === "wallet_deposit" */
  amount?: number | string;
}
export type InitializePaymentResponse = Ok<{
  authorization_url: string;
  reference: string;
  amount: string;
  access_code?: string | null;
  required?: boolean;
  payment_url?: string;
}>;
/** 200/201 = settled, 202 = still processing (poll again after retry_after seconds). */
export type VerifyPaymentResponse = Ok<{
  status: "paid" | "pending";
  payment_status?: "paid" | "pending";
  retry_after?: number;
  reference?: string;
  amount?: string;
  new_balance?: string;
  can_go_online?: boolean;
  booking_id?: string;
  booking_ref?: string;
  booking_status?: BookingStatus;
  total_amount?: string;
}>;


// ===========================================================================
// 5. REQUEST BUILDERS (keep quote and create IDENTICAL)
// ===========================================================================
/**
 * The quote token signs the service, the route coordinates (6 dp) and the stop order.
 * Booking creation rejects the token if any of them differ ("quote_mismatch"), so both
 * request bodies are built from ONE TripInput through the functions below.
 */
export interface TripPoint {
  lat: number;
  lng: number;
  address?: string;
}
export interface TripStopInput extends TripPoint {
  /** Expected wait at this stop, minutes. The quote prices it; default 0. */
  waitMinutes?: number;
}
export interface TripInput {
  service: ServiceKey | string;
  pickup: TripPoint & { address: string };
  /** Omit for waste collection (it is picked up at the pickup point). */
  destination?: TripPoint;
  stops?: TripStopInput[];
  promoCode?: string;
  notes?: string;
  paymentMethod?: PaymentMethod | string;
  /** null / undefined = as soon as possible. Must be in the future. */
  scheduledFor?: Date | string | null;
}


export const coord6 = (n: number): number => Number(n.toFixed(COORD_DECIMALS));


/** NaN would be serialised as null and fail on the server with an unhelpful message. */
function point(p: TripPoint, field: string): { lat: number; lng: number } {
  const ok = Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  if (!ok) throw validationError("Please choose a valid location.", field);
  return { lat: coord6(p.lat), lng: coord6(p.lng) };
}


function validationError(message: string, field?: string): ApiError {
  return new ApiError({
    kind: "validation",
    status: 0,
    method: "LOCAL",
    url: "",
    message,
    fieldErrors: field ? { [field]: [message] } : {},
  });
}


function normalizeTrip(trip: TripInput) {
  const service = normalizeServiceKey(trip.service);
  if (!service) throw validationError("Unknown service type.", "service_type");


  const destination = trip.destination ?? (SERVICE_HINTS[service].requiresDestination ? undefined : trip.pickup);
  if (!destination) throw validationError("A destination is required.", "destination");


  const stops = (trip.stops ?? []).map((s) => ({
    address: s.address ?? "",
    ...point(s, "stops"),
    wait_minutes: Number.isFinite(s.waitMinutes) ? Math.max(0, s.waitMinutes as number) : 0,
  }));
  return {
    service,
    pickup: { address: trip.pickup.address, ...point(trip.pickup, "pickup") },
    destination: { address: destination.address ?? "", ...point(destination, "destination") },
    stops,
  };
}


/** Body for POST booking/calculate-price/ (booking_serializers.QuoteRequestSerializer). */
export function toQuoteBody(trip: TripInput) {
  const t = normalizeTrip(trip);
  const promo = (trip.promoCode ?? "").trim();
  return {
    service_type: t.service,
    pickup_lat: t.pickup.lat,
    pickup_lng: t.pickup.lng,
    destination_lat: t.destination.lat,
    destination_lng: t.destination.lng,
    stops: t.stops,
    ...(promo ? { promo_code: promo } : {}),
  };
}


/** Body for POST booking/create/ (booking_serializers.BookingCreateSerializer). */
export function toCreateBody(trip: TripInput, quoteToken: string) {
  const t = normalizeTrip(trip);
  const method = normalizePaymentMethod(trip.paymentMethod ?? "cash");
  if (!method) throw validationError("Unsupported payment method.", "payment_method");
  const when = trip.scheduledFor ? new Date(trip.scheduledFor) : null;
  if (when && Number.isNaN(when.getTime())) throw validationError("Choose a valid date and time.", "scheduled_for");
  const scheduled = when ? when.toISOString() : null;
  return {
    quote_token: quoteToken,
    service_type: t.service,
    pickup_address: t.pickup.address,
    pickup_latitude: t.pickup.lat,
    pickup_longitude: t.pickup.lng,
    dropoff_address: t.destination.address,
    dropoff_latitude: t.destination.lat,
    dropoff_longitude: t.destination.lng,
    stops: t.stops,
    notes: trip.notes ?? "",
    payment_method: method,
    scheduled_for: scheduled,
  };
}


/** Display helper: seconds left on a quote (never used to price anything). */
export function quoteSecondsLeft(quote: Pick<QuoteResponse, "valid_until">, now: number = Date.now()): number {
  const left = Math.floor((Date.parse(quote.valid_until) - now) / 1000);
  return Number.isFinite(left) ? Math.max(0, left) : 0;
}


// ===========================================================================
// 6. RESPONSE NORMALISERS
// ===========================================================================
// DRF can send decimals as strings. Convert for display; never invent a price.
type Raw = Record<string, unknown>;


const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);


function badResponse(url: string, raw: unknown): ApiError {
  return new ApiError({ kind: "bad_response", status: 200, method: "PARSE", url, raw });
}


/** Converts the listed keys to numbers where present. null / missing values are left alone. */
function numeric<T>(value: T, keys: readonly string[]): T {
  if (!isRecord(value)) return value;
  const out: Raw = { ...value };
  for (const key of keys) {
    const v = out[key];
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) out[key] = Number(v);
  }
  return out as T;
}


const BOOKING_MONEY = ["subtotal", "discount_amount", "total_price"] as const;
const BREAKDOWN_NUMBERS = [
  "base_fare", "distance_fare", "subtotal", "surge_amount", "minimum_fare", "ride_fare",
  "stop_fees", "waiting_charge", "booking_fee", "discount",
] as const;


function parseQuote(raw: unknown): QuoteResponse {
  if (!isRecord(raw)) throw badResponse(ROUTES.quote, raw);
  const q = numeric(raw, ["total_price", "distance_km", "price_per_km", "expires_in_seconds"]);
  if (typeof q.total_price !== "number" || !Number.isFinite(q.total_price) || !isRecord(q.breakdown) || !isRecord(q.surge)) {
    throw badResponse(ROUTES.quote, raw);
  }
  return {
    ...q,
    breakdown: numeric(q.breakdown, BREAKDOWN_NUMBERS),
    surge: numeric(q.surge, ["multiplier"]),
    quote_token: typeof q.quote_token === "string" && q.quote_token ? q.quote_token : null,
  } as unknown as QuoteResponse;
}


/** Accepts a bare booking or a {booking: {...}} wrapper. */
function parseBooking<T extends BookingDetail = BookingDetail>(raw: unknown): T {
  const data = isRecord(raw) && isRecord(raw.booking) ? raw.booking : raw;
  if (!isRecord(data) || typeof data.reference !== "string") throw badResponse(ROUTES.bookingList, raw);
  return numeric(data, BOOKING_MONEY) as unknown as T;
}


/**
 * The checkout URL to redirect to. Only https is allowed, so a bad response can never
 * run a "javascript:" URL through window.location.
 */
export function paymentRedirectUrl(r: { authorization_url?: string; payment_url?: string }): string {
  const url = r.authorization_url || r.payment_url || "";
  if (!/^https:\/\//i.test(url)) throw badResponse(ROUTES.paymentsInitialize, r);
  return url;
}


// ===========================================================================
// 7. ENDPOINTS
// ===========================================================================
export const api = {
  // ---- health check (use it to tell "proxy/backend unreachable" from "route missing") ----
  health: () => get<{ status: string }>(ROUTES.health, undefined, { auth: false }),


  // ---- pricing + bookings ------------------------------------------------
  booking: {
    /** POST booking/calculate-price/. Anonymous callers get an estimate with quote_token = null.
     *  Pass `promoCode` here to apply a promo (promos/validate/ is defective, see ROUTES.defective).
     *  The view is AllowAny but rejects a stale token with 401, so that case is retried anonymously
     *  (quote_token is then null: ask the user to sign in before booking). */
    quote: async (trip: TripInput, o: { signal?: AbortSignal } = {}): Promise<QuoteResponse> => {
      const body = toQuoteBody(trip);
      try {
        return parseQuote(await post<unknown>(ROUTES.quote, body, { signal: o.signal }));
      } catch (e) {
        if (!isApiError(e) || e.status !== 401) throw e;
        return parseQuote(await post<unknown>(ROUTES.quote, body, { signal: o.signal, auth: false }));
      }
    },


    /** POST booking/create/. Replaying the same quote_token returns the existing booking with 200. */
    create: async (trip: TripInput, quoteToken: string): Promise<BookingDetail> => {
      if (!quoteToken) throw validationError("Please get a new price before booking.", "quote_token");
      return parseBooking(await post<unknown>(ROUTES.bookingCreate, toCreateBody(trip, quoteToken)));
    },


    /** GET booking/?status=pending,accepted&page=1&page_size=20 */
    list: async (
      q: { status?: BookingStatus | BookingStatus[]; page?: number; page_size?: number } = {},
      signal?: AbortSignal,
    ): Promise<Paginated<BookingListItem>> => {
      const data = await get<Paginated<BookingListItem>>(ROUTES.bookingList, q as Query, { signal });
      if (!data || !Array.isArray(data.results)) throw badResponse(ROUTES.bookingList, data);
      return { ...data, results: data.results.map((b) => numeric(b, BOOKING_MONEY)) };
    },


    /** GET booking/<ref>/  (shape depends on the caller: customer, rider or staff). */
    detail: async <T extends BookingDetail = BookingDetail>(ref: string, signal?: AbortSignal): Promise<T> =>
      parseBooking<T>(await get<unknown>(ROUTES.bookingDetail(ref), undefined, { signal })),


    /** PATCH booking/<ref>/status/ . The backend decides which transitions are allowed. */
    updateStatus: (ref: string, status: BookingStatus, note = "") =>
      patch<RiderBookingDetail>(ROUTES.bookingStatus(ref), { status, note }),


    /** POST booking/<ref>/cancel/ (a rider "cancelling" releases the job instead). */
    cancel: (ref: string, reason = "") => post<BookingDetail>(ROUTES.bookingCancel(ref), { reason }),


    /** POST booking/<ref>/release/ (rider gives an accepted job back). */
    release: (ref: string, reason = "") => post<BookingDetail>(ROUTES.bookingRelease(ref), { reason }),


    /** GET booking/admin/revenue/ (staff). Money values arrive as strings. */
    revenue: (q: { start?: string; end?: string } = {}) =>
      get<{
        currency: string;
        start: string;
        end: string;
        daily: Record<string, unknown>[];
        totals: Record<string, unknown>;
        cancellation_fees: { count: number; collected: string };
      }>(ROUTES.revenueReport, q),
  },


  // ---- riders near a point (availability) ---------------------------------
  riders: {
    /** GET dispatch/rider/nearby/?lat&lng&radius_km&service_type&limit  (login required). */
    nearby: async (q: { lat: number; lng: number; radius_km?: number; service_type?: ServiceKey; limit?: number }, signal?: AbortSignal) => {
      const data = await get<{ count: number; results: NearbyRider[] }>(ROUTES.nearbyRiders, q, { signal });
      if (!data || !Array.isArray(data.results)) throw badResponse(ROUTES.nearbyRiders, data);
      return { ...data, results: data.results.map((r) => numeric(r, ["rating", "distance_km", "latitude", "longitude"])) };
    },


    /** GET riders/nearby/?lat&lon&service&radius_km&limit  (older search used by the customer app). */
    nearbyLegacy: (q: { lat: number; lon: number; service?: ServiceKey; radius_km?: number; limit?: number }, signal?: AbortSignal) =>
      get<Ok<{ service: string; count: number; riders: LegacyNearbyRider[]; results: LegacyNearbyRider[] }>>(
        ROUTES.ridersNearbyLegacy,
        q,
        { signal },
      ),
  },


  // ---- auth ----------------------------------------------------------------
  auth: {
    /** `username` may be the username or the email address. */
    login: (username: string, password: string) =>
      post<Ok<{ token: string; user: LoginUser }>>(ROUTES.login, { username, password }, { auth: false }),


    /** DRF's own token endpoint. Returns {token}. */
    token: (username: string, password: string) =>
      post<{ token: string }>(ROUTES.tokenAuth, { username, password }, { auth: false }),


    registerCustomer: (b: { email: string; password: string; full_name?: string; phone?: string; referral_code?: string }) =>
      post<Ok<{ user_id: number; email: string; token: string; user: LoginUser }>>(ROUTES.registerCustomer, b, { auth: false }),


    registerRider: (b: {
      full_name: string;
      email: string;
      phone: string;
      password: string;
      password_confirm?: string;
      referral_code?: string;
    }) =>
      post<
        Ok<{
          rider_id: string;
          rider_code: string;
          email: string;
          phone: string;
          is_verified: boolean;
          verification_status: VerificationStatus;
          requires_approval: boolean;
          token: string;
        }>
      >(ROUTES.registerRider, b, { auth: false }),


    sendCode: (phone: string) => post<Ok<{ expires_in: number }>>(ROUTES.sendCode, { phone }, { auth: false }),
    verifyCode: (phone: string, code: string) => post<Ok<{ verified: true }>>(ROUTES.verifyCode, { phone, code }, { auth: false }),


    /** GET auth/me/. Accounts with neither a rider nor a customer profile get 404. */
    me: () => get<Ok<MeRider | MeCustomer>>(ROUTES.me),


    /** PATCH auth/me/. Customers cannot change full_name (403); phone changes are rejected (400).
     *  Send a FormData when including profile_photo. */
    updateMe: (b: { full_name?: string; email?: string } | FormData) =>
      b instanceof FormData
        ? request<Ok<MeRider | MeCustomer>>("PATCH", ROUTES.me, { form: b })
        : patch<Ok<MeRider | MeCustomer>>(ROUTES.me, b),


    /** POST auth/rider/verify/ (multipart). One document per call. */
    uploadRiderDocument: (b: { document_type: DocumentType; file: File; expiry_date?: string }) => {
      const form = new FormData();
      form.append("document_type", b.document_type);
      form.append("document_file", b.file);
      if (b.expiry_date) form.append("expiry_date", b.expiry_date);
      return request<
        Ok<{
          id: string;
          document_type: DocumentType;
          document_status: string;
          documents_uploaded: boolean;
          submitted_for_review: boolean;
        }>
      >("POST", ROUTES.riderDocuments, { form });
    },


    riderVerificationStatus: () =>
      get<
        Ok<{
          stage: "suspended" | "approved" | "under_review" | "rejected" | "not_started";
          documents: RiderDocumentState[];
          rejection_reason: string;
          missing: string[];
        }>
      >(ROUTES.riderVerificationStatus),
  },


  // ---- customer ------------------------------------------------------------
  customer: {
    profile: () => get<Ok<{ data: CustomerProfile }>>(ROUTES.customerProfile),
    /** Only these fields are editable (the name is staff-controlled, the phone uses OTP). */
    updateProfile: (b: { preferred_language?: string; marketing_opt_in?: boolean } | FormData) =>
      b instanceof FormData
        ? request<Ok<{ data: CustomerProfile }>>("PATCH", ROUTES.customerProfile, { form: b })
        : patch<Ok<{ data: CustomerProfile }>>(ROUTES.customerProfile, b),


    /** GET customer/wallet  (no trailing slash, on purpose). */
    wallet: () =>
      get<
        Ok<{
          wallet: { id: string; balance: Decimal; withdrawable_balance: Decimal; bonus_credit: Decimal; currency: string; updated_at: string };
          balance: Decimal;
          withdrawable_balance: Decimal;
          bonus_credit: Decimal;
          currency: string;
          transactions: CustomerWalletTx[];
        }>
      >(ROUTES.customerWallet),
  },


  // ---- rider ---------------------------------------------------------------
  rider: {
    wallet: () =>
      get<
        Ok<{
          wallet: RiderWalletOut;
          balance: Decimal;
          currency: string;
          minimum_required: Decimal;
          can_go_online: boolean;
          transactions: RiderWalletTx[];
          message: string | null;
        }>
      >(ROUTES.riderWallet),


    /** Paginated; also returns summary, monthly_trend and insights. CSV export is ?export=csv (use a plain link). */
    transactions: (q: TransactionQuery = {}) =>
      get<
        Paginated<RiderWalletTx> &
          Ok<{
            currency: string;
            balance: Decimal;
            summary: { total_in: Decimal; total_out: Decimal; net: Decimal; count: number };
            monthly_trend: { month: string; money_in: Decimal; money_out: Decimal }[];
            insights: { low_balance: boolean; message: string | null };
          }>
      >(ROUTES.riderTransactions, q),


    /** POST rider/deposit/. Returns the Paystack checkout URL; the wallet is credited only after payment verifies. */
    deposit: (amount: number | string) => post<InitializePaymentResponse>(ROUTES.riderDeposit, { amount }),


    deposits: (q: { page?: number; page_size?: number } = {}) =>
      get<Paginated<RiderWalletTx> & Ok>(ROUTES.riderDeposits, q),


    /** GET rider/deposits/<reference>/verify/ . 202 = still pending: poll again. */
    verifyDeposit: (reference: string) => get<VerifyPaymentResponse>(ROUTES.riderDepositVerify(reference)),


    /** POST rider/withdraw/ . Send an idempotency key so a double tap cannot withdraw twice. */
    withdraw: (b: { amount: number | string; payout_account_id?: number }, idempotencyKey?: string) =>
      post<Ok<{ withdrawal: WithdrawalOut; withdrawal_id: string; reference: string; amount: string; fee: string; new_balance: string }>>(
        ROUTES.riderWithdraw,
        b,
        { idempotencyKey },
      ),


    /** PATCH rider/update-location/ */
    updateLocation: (b: { latitude: number; longitude: number; speed_kmh?: number | null; heading?: number | null }) =>
      patch<Ok<{ latitude: number; longitude: number; updated_at: string }>>(ROUTES.riderLocation, b),


    acceptOffer: (offerId: string) => post<Ok>(ROUTES.offerAccept(offerId)),
    declineOffer: (offerId: string, reason = "") => post<Ok>(ROUTES.offerDecline(offerId), { reason }),
  },


  // ---- payments (Paystack) ---------------------------------------------------
  payments: {
    /** POST payments/initialize/ . For a booking the amount always comes from the server. */
    initialize: (b: InitializePaymentBody) => post<InitializePaymentResponse>(ROUTES.paymentsInitialize, b),
    /** POST payments/verify/ . Safe to call repeatedly; 202 = poll again after `retry_after` seconds. */
    verify: (reference: string) => post<VerifyPaymentResponse>(ROUTES.paymentsVerify, { reference }),
  },
};


export type Api = typeof api;


