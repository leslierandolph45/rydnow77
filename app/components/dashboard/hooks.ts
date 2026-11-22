'use client';


/**
 * Shared hooks and types for the customer dashboard.
 * Browser storage is only touched inside effects/handlers, so server rendering never crashes.
 */


import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, friendlyError, getToken } from '@/lib/rydnow/api';
import type { PaymentMethod, Place } from '@/lib/rydnow/config';
import { clearSession, readJSON } from '@/lib/rydnow/session';


// ─── storage helpers (SSR-safe) ───
const KEYS = {
  profile: 'rydnow_profile',
  saved: 'rydnow_saved_places',
  recent: 'rydnow_recent_places',
} as const;


function writeJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}


const str = (v: unknown) => (typeof v === 'string' ? v : '');


// ─── auth ───
/**
 * Who is signed in. `signOut` clears the session and sends the customer to /login.
 * `ready` is false until the first client render has read storage, so pages can avoid a flash of "signed out".
 * Pass { redirectIfSignedOut: true } on pages that need a signed-in customer.
 */
export function useAuth({ redirectIfSignedOut = false }: { redirectIfSignedOut?: boolean } = {}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    setToken(t);
    setUser(readJSON<Record<string, unknown> | null>('currentUser', null));
    setReady(true);
    if (!t && redirectIfSignedOut) router.replace('/login');
  }, [redirectIfSignedOut, router]);

  const signOut = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  return { token, user, isAuthenticated: !!token, ready, signOut, logout: signOut };
}


// ─── saved places ───
export type SavedPlaceId = 'home' | 'work';


export interface SavedPlaceMeta {
  id: SavedPlaceId;
  name: string;
  icon: string;
}


export const SAVED_PLACE_META: readonly SavedPlaceMeta[] = [
  { id: 'home', name: 'Home', icon: '🏠' },
  { id: 'work', name: 'Work', icon: '💼' },
];


export type SavedPlaces = Record<SavedPlaceId, Place | null>;


const EMPTY_SAVED: SavedPlaces = { home: null, work: null };
const MAX_RECENT = 5;


export function usePlaces() {
  const [saved, setSaved] = useState<SavedPlaces>(EMPTY_SAVED);
  const [recent, setRecent] = useState<Place[]>([]);


  useEffect(() => {
    setSaved({ ...EMPTY_SAVED, ...readJSON<Partial<SavedPlaces>>(KEYS.saved, {}) });
    setRecent(readJSON<Place[]>(KEYS.recent, []));
  }, []);


  /** Save (or clear, with null) one of the named places. */
  const saveOne = useCallback((id: SavedPlaceId, place: Place | null) => {
    setSaved((prev) => {
      const next = { ...prev, [id]: place };
      writeJSON(KEYS.saved, next);
      return next;
    });
  }, []);


  /** Remember a destination for the "Recent places" list (newest first, no duplicates). */
  const remember = useCallback((place: Place) => {
    setRecent((prev) => {
      const next = [place, ...prev.filter((p) => !(p.lat === place.lat && p.lng === place.lng))].slice(0, MAX_RECENT);
      writeJSON(KEYS.recent, next);
      return next;
    });
  }, []);


  return { saved, recent, saveOne, remember };
}


// ─── profile ───
export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  photoUrl: string;
}


const EMPTY_PROFILE: UserProfile = { fullName: '', email: '', phone: '', photoUrl: '' };


export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);


  useEffect(() => {
    const user = readJSON<Record<string, unknown>>('currentUser', {});
    const stored = readJSON<Partial<UserProfile>>(KEYS.profile, {});
    setProfile({
      ...EMPTY_PROFILE,
      fullName: str(user.full_name) || str(user.name),
      email: str(user.email),
      phone: str(user.phone),
      ...stored,
    });
  }, []);


  const update = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(KEYS.profile, next);
      return next;
    });
  }, []);


  return { profile, update };
}


// ─── countdown ───
/** Whole seconds left until `expiresAtMs`, ticking once a second. 0 when there is no deadline. */
export function useCountdown(expiresAtMs?: number) {
  const secondsLeft = () => (expiresAtMs ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(secondsLeft);


  useEffect(() => {
    const tick = () => setLeft(expiresAtMs ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)) : 0);
    tick();
    if (!expiresAtMs) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtMs]);


  return left;
}


// ─── page scroll lock ───
/** Stops the page itself from scrolling; the dashboard scrolls inside <main>. */
export function useLockPageScroll() {
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prev = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
    };
  }, []);
}


// ═══ WALLET ═══

// ─── Settings: edit anytime ───
const WALLET_BASE = process.env.NEXT_PUBLIC_RYDNOW_API_BASE ?? '/api/rydnow';
const WALLET_AUTH_SCHEME = process.env.NEXT_PUBLIC_RYDNOW_AUTH_SCHEME ?? 'Token';
const WALLET_PATHS = {
  summary: 'wallet/', // GET  -> { balance, currency } (also accepts { wallet: {...} })
  transactions: 'wallet/transactions/', // GET  -> [] | { results } | { transactions }
  topUp: 'wallet/topup/', // POST -> { payment_url? } (hosted checkout) or updated wallet
};
export const WALLET_MIN_TOP_UP = 5; // GH₵
export const WALLET_MAX_TOP_UP = 5000; // GH₵
export const WALLET_TOP_UP_PRESETS = [10, 20, 50, 100] as const;

export type WalletTopUpMethod = Extract<PaymentMethod, 'momo' | 'card'>;

export interface WalletTxn {
  id: string;
  kind: 'credit' | 'debit';
  /** Always positive. Use `kind` for the sign. */
  amount: number;
  label: string;
  status: string;
  createdAt: string;
}

export interface WalletTopUpInput {
  amount: number;
  method: WalletTopUpMethod;
  /** Required when method is "momo". */
  momoNumber?: string;
}

export interface WalletTopUpResult {
  ok: boolean;
  /** Hosted checkout link. If set, send the customer there: window.location.assign(paymentUrl). */
  paymentUrl: string | null;
  error: string;
}

// ─── tiny safe readers (same approach as api.ts) ───
type WalletJson = Record<string, unknown>;
const wIsObj = (v: unknown): v is WalletJson => typeof v === 'object' && v !== null && !Array.isArray(v);
const wNum = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const wStr = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

function wList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (wIsObj(v)) {
    for (const key of ['results', 'transactions']) {
      const inner = v[key];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

function normalizeSummary(raw: unknown): { balance: number; currency: string } {
  const root = wIsObj(raw) ? raw : {};
  const w = wIsObj(root.wallet) ? root.wallet : root;
  return {
    balance: wNum(w.balance ?? w.available_balance ?? w.amount) ?? 0,
    currency: wStr(w.currency, 'GHS'),
  };
}

function normalizeTxn(raw: unknown, index: number): WalletTxn {
  const t = wIsObj(raw) ? raw : {};
  const amount = wNum(t.amount) ?? 0;
  const typeText = `${wStr(t.type)} ${wStr(t.kind)} ${wStr(t.direction)} ${wStr(t.transaction_type)}`.toLowerCase();
  const isDebit = /debit|payment|charge|withdraw|spend|out/.test(typeText) || (!/credit|topup|top_up|refund|deposit|in/.test(typeText) && amount < 0);
  const label =
    wStr(t.description) ||
    wStr(t.label) ||
    wStr(t.reference) ||
    (isDebit ? 'Wallet payment' : 'Wallet top-up');
  return {
    id: wStr(t.id) || wStr(t.reference) || `txn-${index}`,
    kind: isDebit ? 'debit' : 'credit',
    amount: Math.abs(amount),
    label,
    status: wStr(t.status, 'completed'),
    createdAt: wStr(t.created_at) || wStr(t.createdAt),
  };
}

async function walletRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, signal } = opts;
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${WALLET_BASE}/${path}`, {
      method,
      signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `${WALLET_AUTH_SCHEME} ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'We couldn’t reach RYDNOW. Check your connection and try again.');
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.ok) return data as T;

  // Never show an HTML error page (for example the Next.js "Not Found" page) to a customer.
  let message = '';
  if (wIsObj(data)) {
    const first = data.error ?? data.detail ?? data.message ?? data.amount ?? data.momo_number;
    message = Array.isArray(first) ? first.map(String).join(' ') : typeof first === 'string' ? first : '';
  } else if (typeof data === 'string' && !data.trimStart().startsWith('<') && res.status < 500) {
    message = data.slice(0, 200);
  }
  throw new ApiError(res.status, message || (res.status >= 500 ? 'RYDNOW is having trouble right now. Please try again in a moment.' : 'Something went wrong.'));
}

/**
 * The customer's wallet: balance, recent transactions and top-up.
 * Nothing is calculated here. `balance` is exactly what the backend reports.
 *
 *   const { balance, available, canCover, topUp } = useWallet({ onUnauthorized: signOut });
 *
 * `onUnauthorized` must be stable (useCallback). Pass `enabled: false` to skip loading (for example on the Activity tab).
 */
export function useWallet({ onUnauthorized, enabled = true }: { onUnauthorized?: () => void; enabled?: boolean } = {}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState('GHS');
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(true);
  const [toppingUp, setToppingUp] = useState(false);

  const requestId = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++requestId.current;
      try {
        const [summary, txns] = await Promise.all([
          walletRequest<unknown>(WALLET_PATHS.summary, { signal }),
          // Transactions are a nice-to-have: a failure here must not hide the balance.
          walletRequest<unknown>(WALLET_PATHS.transactions, { signal }).catch((e) => {
            if (e instanceof DOMException && e.name === 'AbortError') throw e;
            return [];
          }),
        ]);
        if (!alive.current || id !== requestId.current) return;
        const s = normalizeSummary(summary);
        setBalance(s.balance);
        setCurrency(s.currency);
        setTransactions(
          wList(txns)
            .map(normalizeTxn)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || 0),
        );
        setAvailable(true);
        setError('');
      } catch (e) {
        if (!alive.current || id !== requestId.current || (e instanceof DOMException && e.name === 'AbortError')) return;
        if (e instanceof ApiError && e.status === 401) return onUnauthorized?.();
        // Endpoint not live yet: hide the wallet quietly instead of showing an error.
        if (e instanceof ApiError && [404, 405, 501].includes(e.status)) {
          setAvailable(false);
          setError('');
          return;
        }
        setError(friendlyError(e));
      } finally {
        if (alive.current && id === requestId.current) setLoading(false);
      }
    },
    [onUnauthorized],
  );

  // Load on mount, and again whenever the customer comes back to the tab.
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setLoading(true);
    refresh(ctrl.signal);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ctrl.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  /** True when the wallet balance covers `amount`. Used only to enable or disable the "Wallet" pay option. */
  const canCover = useCallback((amount: number) => balance !== null && balance >= amount, [balance]);

  /**
   * Starts a top-up. Never throws. If `paymentUrl` comes back, redirect the customer to it.
   * Otherwise the balance is refreshed and `ok` tells you whether it worked.
   */
  const topUp = useCallback(
    async ({ amount, method, momoNumber }: WalletTopUpInput): Promise<WalletTopUpResult> => {
      const fail = (message: string): WalletTopUpResult => ({ ok: false, paymentUrl: null, error: message });
      if (!Number.isFinite(amount) || amount < WALLET_MIN_TOP_UP) return fail(`The smallest top-up is GH₵${WALLET_MIN_TOP_UP}.`);
      if (amount > WALLET_MAX_TOP_UP) return fail(`The largest top-up is GH₵${WALLET_MAX_TOP_UP}.`);
      if (method === 'momo' && !/^(\+233|233|0)\d{9}$/.test((momoNumber ?? '').replace(/[\s\-()]/g, ''))) {
        return fail('Enter a valid Mobile Money number.');
      }

      setToppingUp(true);
      try {
        const raw = await walletRequest<unknown>(WALLET_PATHS.topUp, {
          method: 'POST',
          body: {
            amount: Number(amount.toFixed(2)),
            payment_method: method,
            ...(method === 'momo' && momoNumber ? { momo_number: momoNumber.replace(/[\s\-()]/g, '') } : {}),
          },
        });
        const root = wIsObj(raw) ? raw : {};
        const url = wStr(root.payment_url) || wStr(root.authorization_url) || null;
        if (!url) await refresh();
        return { ok: true, paymentUrl: url, error: '' };
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        return fail(friendlyError(e));
      } finally {
        if (alive.current) setToppingUp(false);
      }
    },
    [refresh, onUnauthorized],
  );

  return {
    balance,
    currency,
    transactions,
    loading,
    error,
    /** False when the backend has no wallet endpoint yet. Hide wallet UI in that case. */
    available,
    toppingUp,
    canCover,
    topUp,
    refresh: useCallback(() => refresh(), [refresh]),
  };
}


// ═══ BOOKING ═══

// ─── Settings: edit anytime ───
const BOOKING_PATHS = {
  quote: 'quote/', // POST -> { quote_id, price|total|amount, currency, eta_minutes, expires_at }
  create: 'bookings/', // POST -> booking object (GUESS: check your Django urls.py)
};

export type BookingWhen = 'asap' | { scheduledFor: string }; // ISO string when scheduled

export interface BookingInput {
  pickup: Place;
  dropoff: Place;
  when: BookingWhen;
  promoCode?: string;
  paymentMethod?: PaymentMethod;
}

export interface BookingQuote {
  id: string;
  price: number;
  discount: number;
  currency: string;
  etaMinutes: number | null;
  /** Epoch ms. Pass to useCountdown(). Undefined when the backend sends no expiry. */
  expiresAt?: number;
  /** True when a promo code was sent and the backend applied it. */
  promoApplied: boolean;
}

export interface BookingResult {
  ok: boolean;
  bookingId: string | null;
  /** Hosted checkout link, if the backend wants the customer to pay elsewhere. */
  paymentUrl: string | null;
  error: string;
}

/** The ONE place that maps our fields to the backend's field names. Adjust to match the serializer. */
function toBookingPayload(input: BookingInput, quoteId?: string) {
  const { pickup, dropoff, when, promoCode, paymentMethod } = input;
  return {
    pickup,
    dropoff,
    when: when === 'asap' ? 'asap' : when.scheduledFor,
    ...(promoCode?.trim() ? { promo_code: promoCode.trim() } : {}),
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    ...(quoteId ? { quote_id: quoteId } : {}),
  };
}

function normalizeQuote(raw: unknown, promoSent: boolean): BookingQuote {
  const q = wIsObj(raw) ? raw : {};
  const expires = Date.parse(wStr(q.expires_at));
  const discount = wNum(q.discount ?? q.discount_amount) ?? 0;
  return {
    id: wStr(q.quote_id) || wStr(q.id),
    price: wNum(q.price ?? q.total ?? q.amount ?? q.fare) ?? 0,
    discount,
    currency: wStr(q.currency, 'GHS'),
    etaMinutes: wNum(q.eta_minutes ?? q.eta),
    expiresAt: Number.isFinite(expires) ? expires : undefined,
    promoApplied: promoSent && (q.promo_applied === true || discount > 0),
  };
}

/**
 * Quote and book a ride.
 *
 *   const { quote, quoting, getQuote, book, booking } = useBooking({ onUnauthorized: signOut });
 *   const secondsLeft = useCountdown(quote?.expiresAt);
 *
 * Neither getQuote nor book ever throws. Check `ok` / read `error`.
 * `onUnauthorized` must be stable (useCallback).
 */
export function useBooking({ onUnauthorized }: { onUnauthorized?: () => void } = {}) {
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const quoteReq = useRef(0);
  const quoteCtrl = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      quoteCtrl.current?.abort();
    };
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
      return friendlyError(e);
    },
    [onUnauthorized],
  );

  /** Fetch a price. A newer call cancels the older one, so a slow reply can't overwrite a fresh quote. */
  const getQuote = useCallback(
    async (input: BookingInput): Promise<boolean> => {
      quoteCtrl.current?.abort();
      const ctrl = new AbortController();
      quoteCtrl.current = ctrl;
      const id = ++quoteReq.current;

      setQuoting(true);
      setQuoteError('');
      try {
        const raw = await walletRequest<unknown>(BOOKING_PATHS.quote, {
          method: 'POST',
          body: toBookingPayload(input),
          signal: ctrl.signal,
        });
        if (!alive.current || id !== quoteReq.current) return false;
        setQuote(normalizeQuote(raw, !!input.promoCode?.trim()));
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return false;
        if (!alive.current || id !== quoteReq.current) return false;
        setQuote(null);
        setQuoteError(handleError(e));
        return false;
      } finally {
        if (alive.current && id === quoteReq.current) setQuoting(false);
      }
    },
    [handleError],
  );

  /** Confirm the booking, tied to the current quote when there is one. */
  const book = useCallback(
    async (input: BookingInput): Promise<BookingResult> => {
      const fail = (error: string): BookingResult => ({ ok: false, bookingId: null, paymentUrl: null, error });
      setBooking(true);
      setBookingError('');
      try {
        const raw = await walletRequest<unknown>(BOOKING_PATHS.create, {
          method: 'POST',
          body: toBookingPayload(input, quote?.id || undefined),
        });
        const root = wIsObj(raw) ? raw : {};
        const b = wIsObj(root.booking) ? root.booking : root;
        return {
          ok: true,
          bookingId: wStr(b.id) || wStr(b.booking_id) || null,
          paymentUrl: wStr(root.payment_url) || wStr(root.authorization_url) || null,
          error: '',
        };
      } catch (e) {
        const message = handleError(e);
        if (alive.current) setBookingError(message);
        return fail(message);
      } finally {
        if (alive.current) setBooking(false);
      }
    },
    [quote?.id, handleError],
  );

  const clearQuote = useCallback(() => {
    quoteCtrl.current?.abort();
    setQuote(null);
    setQuoteError('');
  }, []);

  return { quote, quoting, quoteError, getQuote, clearQuote, booking, bookingError, book };
}
