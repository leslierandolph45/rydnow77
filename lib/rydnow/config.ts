/**
 * lib/rydnow/config.ts
 *
 * Shared constants for the RYDNOW frontend. Values in the "backend mirror"
 * sections are copied from the Django backend (api/models.py, api/pricing.py,
 * api/booking_serializers.py). Values marked "frontend only" have no backend
 * source and exist purely for UI behaviour.
 *
 * RULE: nothing in this file is used to calculate a price. Fares come only from
 *   POST /api/booking/calculate-price/   (via api.booking.quote in ./api.ts)
 * The hints below are static display text (stop limits, cancellation policy)
 * that the quote response does not carry. Commission and rider-earning rates are
 * deliberately NOT included: the backend never exposes them to customers.
 *
 * If you change pricing.RATES in Django, update SERVICE_HINTS to match.
 */

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
/** Used when NEXT_PUBLIC_API_BASE is not set. The Next.js proxy maps
 *  /api/rydnow/<path> -> https://rydnow-backend.onrender.com/api/<path>. */
export const API_BASE_DEFAULT = "/api/rydnow";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
export const CURRENCY = "GHS" as const; // pricing.CURRENCY
export const CURRENCY_SYMBOL = "GH₵";

/** Display only. Never use the result for arithmetic. */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}

export type PaymentRecordStatus = "pending" | "paid" | "failed" | "partially_refunded" | "refunded" | "cancelled";


/** Short alias for formatMoney. Display only. */
export const money = formatMoney;

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------
/** A named location chosen by the customer (pickup, destination or stop). */
export interface Place {
  address: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Services  (pricing keys == models.SERVICE_CHOICES == pricing.RATES keys)
// ---------------------------------------------------------------------------
export const SERVICE_KEYS = ["okada", "parcel", "waste-bin"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** Alias of SERVICE_KEYS for call sites that prefer the "types" naming. */
export const SERVICE_TYPES = SERVICE_KEYS;

/** Order in which services are listed in the UI (frontend only). */
export const SERVICE_ORDER = ["okada", "parcel", "waste-bin"] as const;

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  okada: "Okada Ride",
  parcel: "Parcel Delivery",
  "waste-bin": "Waste Collection",
};

export interface ServiceInfo {
  key: ServiceKey;
  label: string;
}

/** Ordered list of services for pickers and tabs. */
export const SERVICES: readonly ServiceInfo[] = SERVICE_ORDER.map((key) => ({
  key,
  label: SERVICE_LABELS[key],
}));

/** pricing.BOOKING_SERVICE_VALUES. The backend currently has two spellings of the
 *  stored Booking.service_type (see audit notes), so always read it through
 *  normalizeServiceKey() instead of comparing raw strings. */
export const BOOKING_SERVICE_VALUES: Record<ServiceKey, string> = {
  okada: "ride",
  parcel: "delivery",
  "waste-bin": "waste_collection",
};

/** pricing.SERVICE_ALIASES (lower-cased). */
const SERVICE_ALIASES: Record<string, ServiceKey> = {
  okada: "okada",
  ride: "okada",
  okada_ride: "okada",
  parcel: "parcel",
  delivery: "parcel",
  "waste-bin": "waste-bin",
  waste_bin: "waste-bin",
  waste_collection: "waste-bin",
  "waste-collection": "waste-bin",
  waste: "waste-bin",
};

/** Any accepted spelling -> pricing key, or null if unknown. */
export function normalizeServiceKey(value: unknown): ServiceKey | null {
  return SERVICE_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

export interface ServiceHints {
  /** pricing.RATES[key].max_stops (extra stops beyond pickup/destination) */
  maxStops: number;
  /** Waste collection is picked up at the pickup point: no destination. */
  requiresDestination: boolean;
  surgeEnabled: boolean;
  freeWaitMinutes: number;
  maxWaitMinutes: number;
  /** Free cancellation window after a rider accepts. */
  cancelGraceMinutes: number;
  /** Fee after the grace window (rider accepted). */
  cancelFeeAccepted: number;
  /** Fee once the rider has arrived. */
  cancelFeeArrived: number;
}

export const SERVICE_HINTS: Record<ServiceKey, ServiceHints> = {
  okada: {
    maxStops: 2, requiresDestination: true, surgeEnabled: true,
    freeWaitMinutes: 3, maxWaitMinutes: 15,
    cancelGraceMinutes: 2, cancelFeeAccepted: 3.0, cancelFeeArrived: 5.0,
  },
  parcel: {
    maxStops: 3, requiresDestination: true, surgeEnabled: true,
    freeWaitMinutes: 5, maxWaitMinutes: 20,
    cancelGraceMinutes: 2, cancelFeeAccepted: 4.0, cancelFeeArrived: 6.0,
  },
  "waste-bin": {
    maxStops: 2, requiresDestination: false, surgeEnabled: false,
    freeWaitMinutes: 5, maxWaitMinutes: 30,
    cancelGraceMinutes: 5, cancelFeeAccepted: 10.0, cancelFeeArrived: 15.0,
  },
};

/** The two trust lines under the price card, built from the hints above. */
export function cancellationPolicyText(service: ServiceKey): string {
  const h = SERVICE_HINTS[service];
  return (
    `Cancel free until a rider accepts. After that, free for ${h.cancelGraceMinutes} ` +
    `minutes, then a small fee of ${formatMoney(h.cancelFeeAccepted)}.`
  );
}

// ---------------------------------------------------------------------------
// Booking status  (models.Booking.Status; note the hyphen in "en-route")
// ---------------------------------------------------------------------------
export const BOOKING_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  ACCEPTED: "accepted",
  EN_ROUTE: "en-route",
  ARRIVED: "arrived",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  accepted: "Accepted",
  "en-route": "En Route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

/**
 * Tolerant spellings of a booking status (lower-cased). FRONTEND ONLY:
 * the canonical values are Booking.Status above. The extra spellings
 * (searching, in_progress, done, canceled...) are defensive guesses and
 * should be verified against what the backend actually sends.
 */
const STATUS_ALIASES: Record<string, BookingStatus> = {
  draft: "draft",
  pending: "pending",
  searching: "pending",
  accepted: "accepted",
  "en-route": "en-route",
  en_route: "en-route",
  enroute: "en-route",
  "en route": "en-route",
  in_progress: "en-route",
  arrived: "arrived",
  completed: "completed",
  complete: "completed",
  done: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  failed: "failed",
};

/** Any accepted spelling -> BookingStatus, or null if unknown. */
export function normalizeStatus(value: unknown): BookingStatus | null {
  return STATUS_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

export type StatusTone = "neutral" | "progress" | "success" | "danger";
export const BOOKING_STATUS_TONE: Record<BookingStatus, StatusTone> = {
  draft: "neutral",
  pending: "progress",
  accepted: "progress",
  "en-route": "progress",
  arrived: "progress",
  completed: "success",
  cancelled: "danger",
  failed: "danger",
};

/** Booking.TRANSITIONS */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["accepted", "cancelled", "failed"],
  accepted: ["en-route", "cancelled", "failed"],
  "en-route": ["arrived", "cancelled", "failed"],
  arrived: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
};

/** Booking.ACTIVE_STATUSES / TERMINAL_STATUSES */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ["pending", "accepted", "en-route", "arrived"];
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = ["completed", "cancelled", "failed"];

/** booking_services.cancel_booking: a customer may cancel only these. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly BookingStatus[] = ["pending", "accepted"];

/**
 * Statuses PATCH booking/<ref>/status/ accepts today
 * (booking_serializers._rider_status_choices on the current Booking.Status).
 * "arrived" is NOT accepted by that endpoint yet.
 */
export const RIDER_PATCHABLE_STATUSES: readonly BookingStatus[] = ["accepted", "en-route", "completed", "cancelled"];

export const isActiveBooking = (s: string): boolean => (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(s);
export const isTerminalBooking = (s: string): boolean => (TERMINAL_BOOKING_STATUSES as readonly string[]).includes(s);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
/** Booking.PaymentMethod */
export const PAYMENT_METHODS = ["cash", "momo", "card", "wallet"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  momo: "Mobile Money",
  card: "Card",
  wallet: "Wallet",
};

/** Short alias for PAYMENT_METHOD_LABELS. */
export const PAYMENT_LABEL = PAYMENT_METHOD_LABELS;

/** Paid through Paystack before the booking is released to dispatch. */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = ["momo", "card"];

/** booking_serializers.PAYMENT_METHOD_ALIASES */
const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  mobile_money: "momo", "mobile-money": "momo", mtn: "momo", momo: "momo",
  visa: "card", visa_card: "card", debit: "card", debit_card: "card", credit_card: "card", card: "card",
  cash: "cash", wallet: "wallet",
};
export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  return PAYMENT_METHOD_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

/** Booking.PaymentStatus */
export type BookingPaymentStatus = "unpaid" | "paid" | "refunded";
/** Payment.Status */
export type PaymentRecordStatus = "pending" | "paid" | "failed" | "partially_refunded" | "refunded" | "cancelled";

// ---------------------------------------------------------------------------
// Surge  (pricing.SurgeResult.reason)
// ---------------------------------------------------------------------------
export type SurgeReason = "none" | "demand" | "peak_hours" | "override" | "disabled";
export const SURGE_REASON_LABELS: Record<SurgeReason, string> = {
  none: "",
  disabled: "",
  demand: "High demand",
  peak_hours: "Peak hours",
  override: "Busy right now",
};

// ---------------------------------------------------------------------------
// Rider verification  (models.VerificationStatus / RiderDocument)
// ---------------------------------------------------------------------------
export type VerificationStatus = "pending" | "under_review" | "verified" | "rejected" | "suspended";
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending Documents",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

export type DocumentType =
  | "ghana_card_front"
  | "ghana_card_back"
  | "passport_photo"
  | "riding_license"
  | "vehicle_registration"
  | "insurance";
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ghana_card_front: "Ghana Card (Front)",
  ghana_card_back: "Ghana Card (Back)",
  passport_photo: "Passport Photo",
  riding_license: "Riding Licence",
  vehicle_registration: "Vehicle Registration",
  insurance: "Insurance Certificate",
};
/** RiderDocument.REQUIRED_TYPES (insurance is optional). */
export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  "ghana_card_front", "ghana_card_back", "passport_photo", "riding_license", "vehicle_registration",
];
export const ALLOWED_DOCUMENT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;
export const MAX_DOCUMENT_SIZE_MB = 10; // serializers.MAX_DOCUMENT_SIZE_MB
export const MAX_PHOTO_SIZE_MB = 5; // serializers.MAX_PHOTO_SIZE_MB

// ---------------------------------------------------------------------------
// Limits and timings
// ---------------------------------------------------------------------------
export const COORD_DECIMALS = 6; // quotes sign coordinates rounded to 6 dp (pricing.COORD)
export const MAX_WAIT_INPUT_MINUTES = 240; // pricing.MAX_WAIT_INPUT_MINUTES
export const MAX_TRIP_KM = 100; // pricing.MAX_DISTANCE_KM
export const PROMO_CODE_MAX_LENGTH = 50; // QuoteRequestSerializer.promo_code
/** settings.PRICING_QUOTE_VALIDITY_MINUTES default (5). Use quote.expires_in_seconds when present. */
export const QUOTE_FALLBACK_TTL_SECONDS = 300;
export const NEARBY_POLL_MS = 20_000; // NearbyRidersView is "polled about every 20 s"
export const NEARBY_DEFAULT_RADIUS_KM = 5;
export const PAGE_SIZE_DEFAULT = 20; // StandardPagination
export const PAGE_SIZE_MAX = 100;
export const PAYMENT_POLL_SECONDS = 5; // views.POLL_INTERVAL (202 "pending" retry_after)
/** How long the UI keeps searching for a rider before offering alternatives.
 *  FRONTEND ONLY: no backend source. */
export const SEARCH_WINDOW_SECONDS = 600;

// ---------------------------------------------------------------------------
// API errors  (used by ./api.ts)
// ---------------------------------------------------------------------------
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "aborted"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payment_required"
  | "validation"
  | "rate_limited"
  | "server"
  | "bad_response"
  | "unknown";

export const ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Can't reach RYDNOW. Check your connection and try again.",
  timeout: "That took too long. Please try again.",
  aborted: "",
  auth: "Please sign in again.",
  forbidden: "You don't have access to that.",
  not_found: "We couldn't find that.",
  conflict: "That just changed. Please refresh and try again.",
  payment_required: "Payment is needed to continue.",
  validation: "Please check your details and try again.",
  rate_limited: "Too many tries. Please wait a moment.",
  server: "Something went wrong on our side. Please try again.",
  bad_response: "We got an unexpected response. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * `code` values the backend sets in its own error bodies or exceptions
 * (booking_services.py, booking_views._error, pricing.QuoteError).
 * They reach the client only if api/exception_handler.py passes them through.
 */
export const BACKEND_ERROR_CODES = [
  "quote_expired", "quote_invalid", "quote_used", "quote_mismatch", "quote_rejected",
  "promo_rejected", "trip_too_long", "too_many_active_bookings", "customer_blocked",
  "insufficient_wallet_balance", "invalid_transition", "booking_conflict", "rider_busy",
  "payment_mismatch", "no_rider_profile", "invalid_state", "unavailable",
] as const;
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

