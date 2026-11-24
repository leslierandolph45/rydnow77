/**
 * lib/rydnow/constants.ts
 *
 * Shared constants, types and pure helpers for the RYDNOW frontend.
 *
 * This file imports NOTHING from api.ts or config.ts. Both of those import from here,
 * which is what removes the circular import between them.
 *
 * Values in the "backend mirror" sections are copied from the Django backend
 * (api/models.py, api/pricing.py, api/booking_serializers.py). Values marked
 * "frontend only" have no backend source. Values marked "UNVERIFIED" come from backend
 * files that were not available when this file was last reviewed.
 *
 * RULE: nothing in this file is used to calculate a price. Fares come only from
 *   POST /api/booking/calculate-price/   (via api.booking.quote in ./api.ts)
 * If you change pricing.RATES in Django, update SERVICE_HINTS to match.
 */


// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
/**
 * The Next.js proxy mount: /api/rydnow/<path> -> https://<backend>/api/<path>.
 * The proxy adds Django's "/api/" itself, so this base must NOT contain "/api/" twice.
 */
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
// Services  (pricing keys == models.ServiceType == models.SERVICE_CHOICES == pricing.RATES keys)
// ---------------------------------------------------------------------------
export const SERVICE_KEYS = ["okada", "parcel", "waste-bin"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];


/** Alias of SERVICE_KEYS for call sites that prefer the "types" naming. */
export const SERVICE_TYPES = SERVICE_KEYS;


/** Order in which services are listed in the UI (frontend only). */
export const SERVICE_ORDER = ["okada", "parcel", "waste-bin"] as const;


/** Same labels as models.Booking.ServiceType. */
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


/**
 * pricing.BOOKING_SERVICE_VALUES (the spelling the quote response returns as
 * `booking_service_type`). NOTE: models.Booking.ServiceType currently stores the pricing
 * keys ("okada", "parcel", "waste-bin"), not these values, so the two backend files
 * disagree. Always read a stored service through normalizeServiceKey(), never by
 * comparing raw strings.
 */
export const BOOKING_SERVICE_VALUES: Record<ServiceKey, string> = {
  okada: "ride",
  parcel: "delivery",
  "waste-bin": "waste_collection",
};


/** pricing.SERVICE_ALIASES (lower-cased). Identical to the backend map. */
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
  /** Waste collection is picked up at the pickup point: no destination
   *  (models.Booking.SERVICES_WITHOUT_DESTINATION). */
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


/** Every value below was checked against pricing.RATES. */
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
 * Tolerant spellings of a booking status (lower-cased). The backend only ever sends the
 * canonical Booking.Status values above. Two extra spellings are kept because the backend
 * itself uses them: "in_progress" (models.ACTIVE_BOOKING_STATUSES and the "trip underway"
 * note in booking_serializers._rider_status_choices) and "en_route" (the underscore form of
 * the canonical value).
 */
const STATUS_ALIASES: Record<string, BookingStatus> = {
  draft: "draft",
  pending: "pending",
  accepted: "accepted",
  "en-route": "en-route",
  en_route: "en-route",
  in_progress: "en-route",
  arrived: "arrived",
  completed: "completed",
  cancelled: "cancelled",
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


/** Booking.TRANSITIONS (verified, identical). */
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


/** Booking.ACTIVE_STATUSES / TERMINAL_STATUSES (verified, identical). */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ["pending", "accepted", "en-route", "arrived"];
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = ["completed", "cancelled", "failed"];


/**
 * UNVERIFIED: booking_services.cancel_booking was not available. Booking.TRANSITIONS itself
 * would allow cancelling from draft, pending, accepted, en-route and arrived.
 */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly BookingStatus[] = ["pending", "accepted"];


/**
 * Statuses PATCH booking/<ref>/status/ accepts
 * (booking_serializers._rider_status_choices resolved on Booking.Status: ACCEPTED, EN_ROUTE,
 * COMPLETED, CANCELLED; IN_PROGRESS does not exist on the enum). "arrived" is NOT accepted.
 */
export const RIDER_PATCHABLE_STATUSES: readonly BookingStatus[] = ["accepted", "en-route", "completed", "cancelled"];


export const isActiveBooking = (s: string): boolean => (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(s);
export const isTerminalBooking = (s: string): boolean => (TERMINAL_BOOKING_STATUSES as readonly string[]).includes(s);


// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
/** Booking.PaymentMethod == booking_serializers.BOOKING_PAYMENT_METHODS */
export const PAYMENT_METHODS = ["cash", "momo", "card", "wallet"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Provider-paid methods (models.PROVIDER_METHODS). The Paystack flow itself is UNVERIFIED (views.py). */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = ["momo", "card"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  momo: "Mobile Money",
  card: "Card",
  wallet: "Wallet",
};

/** Short alias for PAYMENT_METHOD_LABELS. */
export const PAYMENT_LABEL = PAYMENT_METHOD_LABELS;

/** booking_serializers.PAYMENT_METHOD_ALIASES (verified, identical). */
export const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  mobile_money: "momo", "mobile-money": "momo", mtn: "momo", momo: "momo",
  visa: "card", visa_card: "card", debit: "card", debit_card: "card", credit_card: "card", card: "card",
  cash: "cash", wallet: "wallet",
};

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  return PAYMENT_METHOD_ALIASES[String(value ?? "").trim().toLowerCase()] ?? null;
}

/** Booking.PaymentStatus */
export type BookingPaymentStatus = "unpaid" | "paid" | "refunded";
/** Payment.Status (declared once; models.Payment.Status) */
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
/** RiderDocument.file FileExtensionValidator (verified). */
export const ALLOWED_DOCUMENT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;
export const MAX_DOCUMENT_SIZE_MB = 10; // UNVERIFIED: serializers.MAX_DOCUMENT_SIZE_MB not available
export const MAX_PHOTO_SIZE_MB = 5; // UNVERIFIED: serializers.MAX_PHOTO_SIZE_MB not available


// ---------------------------------------------------------------------------
// Limits and timings
// ---------------------------------------------------------------------------
export const COORD_DECIMALS = 6; // pricing.COORD (verified)
export const MAX_WAIT_INPUT_MINUTES = 240; // pricing.MAX_WAIT_INPUT_MINUTES (verified)
export const MAX_TRIP_KM = 100; // pricing.MAX_DISTANCE_KM (verified)
export const PROMO_CODE_MAX_LENGTH = 50; // QuoteRequestSerializer.promo_code (verified)
/** pricing.QUOTE_VALIDITY default (5 minutes, settings.PRICING_QUOTE_VALIDITY_MINUTES). Verified.
 *  Use quote.expires_in_seconds when present. */
export const QUOTE_FALLBACK_TTL_SECONDS = 300;
export const NEARBY_POLL_MS = 20_000; // UNVERIFIED: NearbyRidersView was not available
export const NEARBY_DEFAULT_RADIUS_KM = 5; // NearbyRidersQuerySerializer.radius_km default (verified)
export const PAGE_SIZE_DEFAULT = 20; // UNVERIFIED: StandardPagination was not available
export const PAGE_SIZE_MAX = 100; // UNVERIFIED: StandardPagination was not available
export const PAYMENT_POLL_SECONDS = 5; // UNVERIFIED: views.POLL_INTERVAL was not available
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
 * `code` values the Next.js proxy (app/api/rydnow/[...path]/route.ts) puts in its own JSON
 * error bodies. Verified against that file.
 */
export const PROXY_ERROR_CODES = [
  "route_not_found", // 404: nothing after /api/rydnow/
  "route_not_allowed", // 404: path is not in the proxy allow-list
  "upstream_404", // 404: Django (or Render) had no matching URL
  "bad_path", // 400
  "route_blocked", // 403: provider-only webhook
  "method_not_allowed", // 405
  "upstream_redirect", // 502
  "upstream_timeout", // 504
  "upstream_unreachable", // 502
] as const;
export type ProxyErrorCode = (typeof PROXY_ERROR_CODES)[number];


/**
 * A 404 with one of these codes means the URL itself matched no route. It is NOT an
 * ordinary "record not found" from a Django view, which returns a 404 without these codes.
 */
export const ROUTE_NOT_FOUND_CODES: readonly string[] = ["route_not_found", "route_not_allowed", "upstream_404"];

export function isRouteNotFoundCode(code: string | null | undefined): boolean {
  return typeof code === "string" && ROUTE_NOT_FOUND_CODES.includes(code);
}

/** Customer-safe text for a missing route (instead of "We couldn't find that."). */
export const ROUTE_UNAVAILABLE_MESSAGE = "This feature isn't available right now. Please try again later.";


/**
 * `code` values the backend sets in its own error bodies or exceptions
 * (booking_services.py, booking_views._error, pricing.QuoteError).
 * Verified from pricing.QuoteError: quote_expired, quote_invalid.
 * UNVERIFIED (booking_services.py / booking_views.py were not available): all others.
 * They reach the client only if api/exception_handler.py passes them through.
 */
export const BACKEND_ERROR_CODES = [
  "quote_expired", "quote_invalid", "quote_used", "quote_mismatch", "quote_rejected",
  "promo_rejected", "trip_too_long", "too_many_active_bookings", "customer_blocked",
  "insufficient_wallet_balance", "invalid_transition", "booking_conflict", "rider_busy",
  "payment_mismatch", "no_rider_profile", "invalid_state", "unavailable",
] as const;
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

