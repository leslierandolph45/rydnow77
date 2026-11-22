'use client';

/**
 * RYDNOW booking flow (single file).
 *
 * A guided 4-step wizard that uses the same backend contract as CustomerDashboard:
 *   Trip -> Details -> Review (signed, price-locked quote) -> Pay -> booking created.
 *
 * Every number shown comes from the backend quote via lib/rydnow/api.ts. Nothing is calculated here.
 * The quote is only requested once the customer reaches Review, so browsing steps 1-2 costs no API calls.
 *
 * Usage:
 *   <BookingFlow
 *     onComplete={(booking) => { reload(); setTab('activity'); }}
 *     onUnauthorized={signOut}
 *   />
 *
 * File map: 1. Settings & types  2. Helpers  3. Small components  4. Quote hook  5. BookingFlow
 */

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  api,
  friendlyError,
  isAbort,
  isApiError,
  needsNewQuote,
  type Booking,
  type Quote,
  type QuoteBreakdown,
  type TripInput,
} from '@/lib/rydnow/api';
import {
  ONLINE_PAYMENT_METHODS,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  QUOTE_FALLBACK_TTL_SECONDS,
  SERVICE_HINTS,
  SERVICE_LABELS,
  SERVICE_ORDER,
  SURGE_REASON_LABELS,
  money,
  type PaymentMethod,
  type Place,
  type ServiceHints,
  type ServiceKey,
} from '@/lib/rydnow/config';
import { currentPosition, reversePlace } from '@/lib/rydnow/geocode';

import { useCountdown, usePlaces } from '@/app/components/dashboard/hooks';
import PlaceField from '@/app/components/dashboard/PlaceField';
import { Icon, RouteSummary, SERVICE_ICON, Spinner, inputCls } from '@/app/components/dashboard/ui';

// ═══ 1. SETTINGS & TYPES ═══

const QUOTE_DEBOUNCE_MS = 450;
const MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000;
const RING = 2 * Math.PI * 24; // price-lock countdown ring (r = 24)

type StepId = 'trip' | 'details' | 'review' | 'pay';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'trip', label: 'Trip' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
  { id: 'pay', label: 'Pay' },
];

/** Display wording for a service. Static copy only: the backend does not send it. */
interface ServiceUi {
  name: string;
  blurb: string;
  provider: string;
  providers: string;
  pickupLabel: string;
  dropoffLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
}

/** Wording + backend limits for the selected service. */
type ServiceView = ServiceUi & ServiceHints;

/** A quote plus the client-side clock values the price-lock countdown needs. */
interface LiveQuote {
  quote: Quote;
  receivedAtMs: number;
  expiresAtMs: number;
}

interface StopDraft {
  id: string;
  place: Place | null;
  wait: number;
}
interface ParcelDraft {
  category: string;
  recipientName: string;
  recipientPhone: string;
  item: string;
}
interface WasteDraft {
  type: string;
  bins: string;
}
interface OptionItem {
  id: string;
  label: string;
  desc: string;
}

const EMPTY_PARCEL: ParcelDraft = { category: '', recipientName: '', recipientPhone: '', item: '' };
const EMPTY_WASTE: WasteDraft = { type: '', bins: '' };

const SERVICE_UI: Record<ServiceKey, ServiceUi> = {
  okada: {
    name: SERVICE_LABELS.okada,
    blurb: 'Fast bike rides',
    provider: 'rider',
    providers: 'riders',
    pickupLabel: 'Pickup',
    dropoffLabel: 'Drop-off',
    notesLabel: 'Note for your rider',
    notesPlaceholder: 'e.g. I’m at the blue gate',
  },
  parcel: {
    name: SERVICE_LABELS.parcel,
    blurb: 'Send anything across town',
    provider: 'rider',
    providers: 'riders',
    pickupLabel: 'Pickup',
    dropoffLabel: 'Deliver to',
    notesLabel: 'Delivery notes',
    notesPlaceholder: 'e.g. Fragile, call the recipient on arrival',
  },
  'waste-bin': {
    name: SERVICE_LABELS['waste-bin'],
    blurb: 'Bin and waste pickups',
    provider: 'collector',
    providers: 'collectors',
    pickupLabel: 'Collection point',
    dropoffLabel: '',
    notesLabel: 'Access notes',
    notesPlaceholder: 'e.g. Bins are behind the gate',
  },
};

const DELIVERY_CATEGORIES: readonly OptionItem[] = [
  { id: 'Food', label: '🍔 Food delivery', desc: 'Hot meals & restaurant orders' },
  { id: 'Parcel', label: '📦 Parcel delivery', desc: 'Packages & items' },
  { id: 'Documents', label: '📄 Documents', desc: 'Letters & important papers' },
  { id: 'Other', label: '🎁 Other', desc: 'Anything else that needs delivering' },
];

const WASTE_TYPES: readonly OptionItem[] = [
  { id: 'Household waste', label: '🏠 Household waste', desc: 'General home rubbish' },
  { id: 'Recycling', label: '♻️ Recycling', desc: 'Paper, plastic, glass & metal' },
  { id: 'Bulk items', label: '🪑 Bulk items', desc: 'Furniture, appliances & large items' },
  { id: 'Garden waste', label: '🌿 Garden waste', desc: 'Leaves, branches & grass' },
];

const PAY_ICON: Record<PaymentMethod, string> = { cash: '💵', momo: '📱', card: '💳', wallet: '👛' };

const PAY_HINT: Record<PaymentMethod, string> = {
  cash: 'Pay your rider at the end of the trip',
  momo: 'Pay securely with Mobile Money',
  card: 'Pay securely with your card',
  wallet: 'Use your RYDNOW balance',
};

export interface BookingFlowProps {
  /** Called after the booking is created (and, for hosted checkout, never: the page redirects instead). */
  onComplete: (booking: Booking) => void;
  /** Called when the API says the session is gone. Must be stable (useCallback). */
  onUnauthorized?: () => void;
  /** Shows a close button in the header when provided. */
  onClose?: () => void;
  initialService?: ServiceKey;
  initialPickup?: Place | null;
  initialDropoff?: Place | null;
  /** Skip the device location lookup on mount. */
  disableAutoLocate?: boolean;
}

// ═══ 2. HELPERS ═══

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const cleanPhone = (v: string) => v.replace(/[\s\-()]/g, '');
const isGhPhone = (v: string) => /^(\+233|233|0)\d{9}$/.test(cleanPhone(v));

/** Value for <input type="datetime-local"> in the customer's local time. */
function localInputValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Wrap a quote with the local clock values the countdown needs. Uses the server's lifetime, not its clock. */
function toLiveQuote(quote: Quote): LiveQuote {
  const receivedAtMs = Date.now();
  const ttl = quote.expires_in_seconds > 0 ? quote.expires_in_seconds : QUOTE_FALLBACK_TTL_SECONDS;
  return { quote, receivedAtMs, expiresAtMs: receivedAtMs + ttl * 1000 };
}

/** Rows for the price breakdown, exactly as the backend itemised them. Display only. */
function priceLines(b: QuoteBreakdown): { label: string; amount: number }[] {
  const rows = [
    { label: 'Trip fare', amount: b.ride_fare },
    { label: 'Extra stops', amount: b.stop_fees },
    { label: 'Waiting time', amount: b.waiting_charge },
    { label: 'Booking fee', amount: b.booking_fee },
  ].filter((r) => r.amount > 0);
  if (b.discount > 0) rows.push({ label: b.promo_code ? `Promo ${b.promo_code}` : 'Discount', amount: -b.discount });
  return rows;
}

// ═══ 3. SMALL COMPONENTS ═══

function Card({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function OptionButton({ on, label, desc, onClick }: { on: boolean; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3FCE] ${
        on ? 'border-[#1E3FCE] bg-[#1E3FCE] text-white' : 'border-gray-100 bg-gray-50 text-gray-900'
      }`}
    >
      <p className="text-[13px] font-bold">{label}</p>
      <p className="mt-0.5 text-[11px] leading-snug opacity-70">{desc}</p>
    </button>
  );
}

function TripRow({ kind, first, last, children }: { kind: 'pickup' | 'stop' | 'dest'; first: boolean; last: boolean; children: ReactNode }) {
  const line = first && last ? 'hidden' : first ? 'top-6 bottom-0' : last ? 'top-0 h-6' : 'inset-y-0';
  const dot =
    kind === 'pickup'
      ? 'rounded-full bg-[#1E3FCE]'
      : kind === 'dest'
        ? 'rounded-[2px] bg-gray-900'
        : 'rounded-full border-2 border-gray-400 bg-white';
  return (
    <div className="flex gap-3">
      <div className="relative w-3 shrink-0" aria-hidden>
        <span className={`absolute left-1/2 w-px -translate-x-1/2 bg-gray-300 ${line}`} />
        <span className={`absolute left-1/2 top-6 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 ${dot}`} />
      </div>
      <div className={`min-w-0 flex-1 ${last ? '' : 'border-b border-gray-100'}`}>{children}</div>
    </div>
  );
}

/** Progress header. Completed steps are tappable so the customer can go back and edit. */
function Stepper({ current, onJump }: { current: StepId; onJump: (id: StepId) => void }) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Booking progress" className="px-4 pb-3 pt-1">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < index;
          const on = i === index;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(s.id)}
                aria-current={on ? 'step' : undefined}
                aria-label={`${s.label}${done ? ', completed. Tap to edit' : on ? ', current step' : ''}`}
                className="group text-left disabled:cursor-default"
              >
                <span className={`block h-1.5 rounded-full transition-colors ${done ? 'bg-[#1E3FCE]' : on ? 'bg-[#F5B82E]' : 'bg-gray-200'}`} />
                <span className={`mt-1.5 block truncate text-[11px] font-bold ${on ? 'text-gray-900' : done ? 'text-[#1E3FCE]' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PriceCard({ live, quoting, error, onRetry }: { live: LiveQuote | null; quoting: boolean; error: string; onRetry: () => void }) {
  const left = useCountdown(live?.expiresAtMs);
  const q = live?.quote ?? null;
  const total = live ? Math.max(1, Math.round((live.expiresAtMs - live.receivedAtMs) / 1000)) : 1;
  const surgeReason = q ? SURGE_REASON_LABELS[q.surge.reason] : '';

  return (
    <section aria-label="Your price" aria-live="polite" className="min-h-[7.5rem] rounded-2xl border-2 border-[#F5B82E] bg-white p-4">
      {quoting && !q && !error && (
        <div className="space-y-2" aria-label="Getting your price">
          <div className="h-9 w-2/3 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-5 w-full animate-pulse rounded-lg bg-gray-100" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3" role="alert">
          <p className="min-w-0 flex-1 text-sm text-red-700">{error}</p>
          <button type="button" onClick={onRetry} className="shrink-0 py-1 text-sm font-bold text-red-700 underline">
            Retry
          </button>
        </div>
      )}

      {live && q && !error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Your price</p>
              <p className="text-3xl font-extrabold leading-tight tracking-tight text-[#1E3FCE]">{money(q.total_price)}</p>
            </div>
            <div className="relative h-14 w-14 shrink-0" title="Price held for you">
              <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90" aria-hidden>
                <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="#F5B82E"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - left / total)}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[11px] font-extrabold tabular-nums">{mmss(left)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {quoting ? 'Refreshing your price…' : `Locked for you for ${mmss(left)}. If it runs out we refresh it automatically.`}
          </p>

          {q.surge.active && q.surge.multiplier > 1 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {surgeReason ? `${surgeReason}: ` : ''}fares are ×{q.surge.multiplier.toFixed(1)} right now. This is already included in your price.
            </p>
          )}

          {q.distance_km > 0 && <p className="text-xs text-gray-500">{q.distance_km.toFixed(1)} km</p>}

          <ul className="space-y-1.5 border-t border-gray-100 pt-3 text-sm">
            {priceLines(q.breakdown).map((l) => (
              <li key={l.label} className={`flex justify-between gap-3 ${l.amount < 0 ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                <span>{l.label}</span>
                <span className="tabular-nums">
                  {l.amount < 0 ? '−' : ''}
                  {money(Math.abs(l.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PromoCard(props: {
  promo: string;
  input: string;
  error: string;
  discount: number;
  quoting: boolean;
  onInputChange: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const { promo, input, error, discount, quoting, onInputChange, onApply, onRemove } = props;
  return (
    <section className="rounded-2xl border-2 border-dashed border-[#F5B82E] bg-amber-50/60 p-4" aria-label="Promo code">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5B82E] text-gray-900">
          <Icon name="tag" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-gray-900">Promo code</h3>
          <p className="text-[11px] text-gray-600">Got a code or a friend’s invite? Save on your booking.</p>
        </div>
      </div>

      {promo ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-white px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-900">{promo}</p>
            <p className="text-xs text-green-700">
              {discount > 0 ? `You save ${money(discount)}` : quoting ? 'Checking your code…' : 'Applied when your trip is priced'}
            </p>
          </div>
          <button type="button" onClick={onRemove} className="py-2 pl-2 text-xs font-bold text-gray-500">
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Promo code"
            placeholder="Enter code"
            autoCapitalize="characters"
            className={`${inputCls} min-w-0 flex-1 font-bold uppercase tracking-wider placeholder:font-normal placeholder:normal-case placeholder:tracking-normal`}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onApply()}
          />
          <button
            type="button"
            onClick={onApply}
            disabled={!input.trim()}
            className="shrink-0 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Own ticker so the page does not re-render every second. */
function LockNote({ live, quoting }: { live: LiveQuote; quoting: boolean }) {
  const left = useCountdown(live.expiresAtMs);
  return <p className="mt-1 text-xs text-gray-500">{quoting ? 'Refreshing your price…' : `Price locked for ${mmss(left)}`}</p>;
}

// ═══ 4. QUOTE HOOK ═══

interface QuoteOptions {
  /** null while the form is incomplete or the customer has not reached Review. Must be memoised. */
  input: TripInput | null;
  paused: boolean;
  /** Both callbacks must be stable (useCallback). */
  onUnauthorized: () => void;
  onPromoRejected: (message: string) => void;
}

/** Fetches a signed, price-locked quote and refreshes it automatically when the lock expires. */
function useQuote({ input, paused, onUnauthorized, onPromoRejected }: QuoteOptions) {
  const [live, setLive] = useState<LiveQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [priceChanged, setPriceChanged] = useState('');
  const [tick, setTick] = useState(0);

  const requestId = useRef(0);
  const lastTotal = useRef<number | null>(null);
  const autoRefresh = useRef(false);

  const refresh = useCallback((auto = false) => {
    autoRefresh.current = auto;
    setTick((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    setLive(null);
    setError('');
    setPriceChanged('');
    lastTotal.current = null;
  }, []);

  const clearPriceChanged = useCallback(() => setPriceChanged(''), []);

  useEffect(() => {
    if (!input) {
      setLive(null);
      setError('');
      setQuoting(false);
      return;
    }

    const id = ++requestId.current;
    const ctrl = new AbortController();
    setQuoting(true);
    setError('');
    if (!autoRefresh.current) setPriceChanged('');

    const timer = setTimeout(async () => {
      try {
        const q = await api.booking.quote(input, { signal: ctrl.signal });
        if (id !== requestId.current) return;

        if (autoRefresh.current && lastTotal.current !== null && Math.abs(lastTotal.current - q.total_price) >= 0.01) {
          setPriceChanged(`Your price was refreshed: ${money(lastTotal.current)} is now ${money(q.total_price)}.`);
        }
        autoRefresh.current = false;
        lastTotal.current = q.total_price;

        if (input.promoCode && q.breakdown.discount <= 0) onPromoRejected('This code can’t be applied to this trip.');
        setLive(toLiveQuote(q));
      } catch (e) {
        if (id !== requestId.current || isAbort(e)) return;
        setLive(null);
        if (isApiError(e) && e.status === 401) return onUnauthorized();
        if (input.promoCode && isApiError(e) && (e.code === 'promo_rejected' || e.fieldErrors.promo_code?.length)) {
          onPromoRejected(e.fieldErrors.promo_code?.[0] ?? e.userMessage);
          return;
        }
        setError(friendlyError(e));
      } finally {
        if (id === requestId.current) setQuoting(false);
      }
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [input, tick, onUnauthorized, onPromoRejected]);

  // Ask for a fresh price the moment the lock runs out.
  useEffect(() => {
    if (!live || !input || paused) return;
    const timer = setTimeout(() => refresh(true), Math.max(0, live.expiresAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [live, input, paused, refresh]);

  return { live, quoting, error, priceChanged, refresh, reset, clearPriceChanged };
}

// ═══ 5. BOOKING FLOW ═══

export default function BookingFlow({
  onComplete,
  onUnauthorized,
  onClose,
  initialService = 'okada',
  initialPickup = null,
  initialDropoff = null,
  disableAutoLocate = false,
}: BookingFlowProps) {
  const places = usePlaces();
  const bodyRef = useRef<HTMLDivElement>(null);

  // ---- wizard state ----
  const [step, setStep] = useState<StepId>('trip');
  // Never start on an unknown service key: cfg below must always exist.
  const [service, setService] = useState<ServiceKey>(SERVICE_UI[initialService] ? initialService : 'okada');
  const [pickup, setPickup] = useState<Place | null>(initialPickup);
  const [dropoff, setDropoff] = useState<Place | null>(initialDropoff);
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [parcel, setParcel] = useState<ParcelDraft>(EMPTY_PARCEL);
  const [waste, setWaste] = useState<WasteDraft>(EMPTY_WASTE);
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduled, setScheduled] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState('');
  const [promoError, setPromoError] = useState('');
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);

  /** Wording + backend limits for the selected service. Both maps are keyed by ServiceKey. */
  const cfg = useMemo<ServiceView>(() => ({ ...SERVICE_UI[service], ...SERVICE_HINTS[service] }), [service]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const handleUnauthorized = useCallback(() => onUnauthorized?.(), [onUnauthorized]);

  // Scroll to the top of the body whenever the step changes.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // ─── location ───
  const locate = useCallback(async (silent = false) => {
    setLocating(true);
    setLocationNote('');
    try {
      const pos = await currentPosition();
      const place = await reversePlace(pos.lat, pos.lng);
      setPickup((prev) => (silent ? (prev ?? place) : place));
    } catch (e) {
      if (!silent) {
        const denied = typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 1;
        setLocationNote(
          denied
            ? 'Location is turned off for this site. Type your address instead.'
            : 'We couldn’t find your location. Type your address instead.',
        );
      }
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (disableAutoLocate || initialPickup) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((s) => s.state === 'granted' && locate(true))
      .catch(() => undefined);
  }, [locate, disableAutoLocate, initialPickup]);

  // ─── validation, one blocker message per step ───
  const sameSpot = cfg.requiresDestination && !!pickup && !!dropoff && pickup.lat === dropoff.lat && pickup.lng === dropoff.lng;
  const stopPlaces = useMemo(() => stops.map((s) => s.place).filter((p): p is Place => !!p), [stops]);
  const minLater = useMemo(() => localInputValue(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS)), [when]); // eslint-disable-line react-hooks/exhaustive-deps

  const tripBlocker = (() => {
    if (!pickup) return `Add your ${cfg.pickupLabel.toLowerCase()}`;
    if (cfg.requiresDestination && !dropoff) return `Add your ${cfg.dropoffLabel.toLowerCase()}`;
    if (sameSpot) return 'Pickup and drop-off are the same place';
    if (stops.some((s) => !s.place)) return 'Finish or remove the extra stop';
    return '';
  })();

  const detailsBlocker = (() => {
    if (service === 'parcel' && !parcel.category) return 'Choose what you’re sending';
    if (service === 'parcel' && !parcel.recipientName.trim()) return 'Add the recipient’s name';
    if (service === 'parcel' && !isGhPhone(parcel.recipientPhone)) return 'Add a valid recipient phone number';
    if (service === 'waste-bin' && !waste.type) return 'Choose the type of waste';
    if (when === 'later' && (!scheduled || scheduled < minLater)) return 'Choose a pickup time at least 15 minutes ahead';
    return '';
  })();

  // ─── quote (only while the customer is on Review or Pay) ───
  // The ONE trip description: the quote and the booking are both built from it, because the
  // quote token signs the route and booking creation rejects it if anything differs.
  const trip = useMemo<TripInput | null>(() => {
    if (step !== 'review' && step !== 'pay') return null;
    if (tripBlocker || !pickup) return null;
    return {
      service,
      pickup,
      destination: cfg.requiresDestination ? (dropoff ?? undefined) : undefined,
      stops: stops.map((s) => ({ ...(s.place as Place), waitMinutes: s.wait })),
      promoCode: promo || undefined,
    };
  }, [step, tripBlocker, service, pickup, dropoff, stops, promo, cfg.requiresDestination]);

  const rejectPromo = useCallback((message: string) => {
    setPromo('');
    setPromoError(message);
  }, []);

  const {
    live,
    quoting,
    error: quoteError,
    priceChanged,
    refresh: refreshQuote,
    reset: resetQuote,
    clearPriceChanged,
  } = useQuote({ input: trip, paused: submitting, onUnauthorized: handleUnauthorized, onPromoRejected: rejectPromo });

  const reviewBlocker = quoting || !live ? (quoteError ? 'Price unavailable. Tap Retry above' : 'Getting your price…') : '';
  const payBlocker = !payment ? 'Choose how to pay' : reviewBlocker;

  const blocker = step === 'trip' ? tripBlocker : step === 'details' ? detailsBlocker : step === 'review' ? reviewBlocker : payBlocker;

  // ─── form handlers ───
  function chooseService(next: ServiceKey) {
    if (next === service) return;
    setService(next);
    setStops((s) => s.slice(0, SERVICE_HINTS[next].maxStops));
    resetQuote();
  }
  const addStop = () => setStops((s) => [...s, { id: uid(), place: null, wait: 0 }]);
  const patchStop = (id: string, patch: Partial<StopDraft>) => setStops((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeStop = (id: string) => setStops((s) => s.filter((x) => x.id !== id));
  const patchParcel = (patch: Partial<ParcelDraft>) => setParcel((p) => ({ ...p, ...patch }));
  const patchWaste = (patch: Partial<WasteDraft>) => setWaste((w) => ({ ...w, ...patch }));

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return setPromoError('Enter a promo code');
    setPromoError('');
    setPromo(code);
    setPromoInput('');
  };

  function composeNotes() {
    const parts: string[] = [];
    if (service === 'parcel') {
      parts.push(`Recipient: ${parcel.recipientName.trim()} (${parcel.recipientPhone.trim()})`);
      if (parcel.category) parts.push(`Type: ${parcel.category}`);
      if (parcel.item.trim()) parts.push(`Item: ${parcel.item.trim()}`);
    }
    if (service === 'waste-bin') {
      if (waste.type) parts.push(`Waste: ${waste.type}`);
      if (waste.bins.trim()) parts.push(`Bins/bags: ${waste.bins.trim()}`);
    }
    if (notes.trim()) parts.push(notes.trim());
    return parts.join('\n').slice(0, 1000);
  }

  // ─── navigation ───
  const goBack = () => {
    if (submitting) return;
    setSubmitError('');
    setNeedsSignIn(false);
    if (stepIndex === 0) return onClose?.();
    setStep(STEPS[stepIndex - 1].id);
  };

  const jumpTo = (id: StepId) => {
    if (submitting) return;
    setSubmitError('');
    setStep(id);
  };

  async function confirm() {
    if (blocker || !live || !trip || submitting || !payment) return;

    const quoteToken = live.quote.quote_token;
    if (!quoteToken) {
      setSubmitError('Please sign in to confirm your booking. Your trip details are saved on this screen.');
      setNeedsSignIn(true);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setNeedsSignIn(false);
    clearPriceChanged();
    let redirecting = false;
    try {
      // Replaying the same quote token returns the same booking, so retrying after a failed
      // payment start does not create a duplicate.
      const booking = await api.booking.create(
        {
          ...trip,
          notes: composeNotes(),
          paymentMethod: payment,
          scheduledFor: when === 'later' && scheduled ? new Date(scheduled) : null,
        },
        quoteToken,
      );
      if (cfg.requiresDestination && dropoff) places.remember(dropoff);

      if (ONLINE_PAYMENT_METHODS.includes(payment)) {
        // Mobile Money and card are paid on the hosted Paystack page before dispatch.
        const init = await api.payments.initialize({ purpose: 'booking', booking_ref: booking.reference });
        const url = init.authorization_url || init.payment_url;
        if (!url) {
          setSubmitError('We couldn’t open the payment page. Please try again.');
          return;
        }
        redirecting = true;
        window.location.assign(url);
        return;
      }

      onComplete(booking);
    } catch (e) {
      if (needsNewQuote(e)) {
        setSubmitError('Your price expired. We’re getting a fresh one. Nothing was booked or charged.');
        refreshQuote(true);
      } else if (isApiError(e) && e.status === 401) {
        setSubmitError('Please sign in to confirm your booking. Your trip details are saved on this screen.');
        setNeedsSignIn(true);
      } else {
        setSubmitError(friendlyError(e));
      }
    } finally {
      if (!redirecting) setSubmitting(false);
    }
  }

  const onPrimary = () => {
    if (blocker || submitting) return;
    if (step === 'pay') return void confirm();
    setStep(STEPS[stepIndex + 1].id);
  };

  // ─── derived display ───
  const totalLabel = live ? money(live.quote.total_price) : '';
  const summaryPoints = [
    ...(pickup ? [{ label: cfg.pickupLabel, text: pickup.address }] : []),
    ...stopPlaces.map((p, i) => ({ label: `Stop ${i + 1}`, text: p.address })),
    ...(cfg.requiresDestination && dropoff ? [{ label: cfg.dropoffLabel, text: dropoff.address }] : []),
  ];

  const primaryLabel =
    blocker ||
    (step === 'trip'
      ? 'Continue'
      : step === 'details'
        ? 'Review price'
        : step === 'review'
          ? `Continue to payment · ${totalLabel}`
          : submitting
            ? 'Placing booking…'
            : payment === 'cash'
              ? 'Confirm booking'
              : `Pay ${totalLabel}`);

  const stepTitle: Record<StepId, { title: string; hint: string }> = {
    trip: { title: 'Where to?', hint: 'Pick a service, then tell us where we’re going.' },
    details: { title: 'A few details', hint: `Help your ${cfg.provider} get it right.` },
    review: { title: 'Check your price', hint: 'Your price is locked while you review.' },
    pay: { title: 'How would you like to pay?', hint: 'You won’t be charged until the booking is placed.' },
  };

  // ─── step bodies ───
  const tripStep = (
    <>
      <section aria-label="Service">
        <div className="grid grid-cols-3 items-stretch gap-2" role="radiogroup" aria-label="Service">
          {SERVICE_ORDER.map((key) => {
            const s = SERVICE_UI[key];
            const on = key === service;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseService(key)}
                className={`relative flex min-w-0 flex-col items-center rounded-2xl border-2 px-1.5 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3FCE] ${
                  on ? 'border-[#1E3FCE] bg-blue-50 shadow-md' : 'border-gray-200 bg-white'
                }`}
              >
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1E3FCE] text-white">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                )}
                <Image src={SERVICE_ICON[key]} alt="" width={44} height={44} className="mb-2 h-11 w-11 object-contain" />
                <span className="text-[13px] font-bold leading-tight text-gray-900">{s.name}</span>
                <span className="mt-0.5 text-[11px] leading-tight text-gray-500">{s.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Card label="Trip" className="shadow-md">
        <TripRow kind="pickup" first last={!cfg.requiresDestination && stops.length === 0}>
          <PlaceField
            label={cfg.pickupLabel}
            placeholder={cfg.requiresDestination ? cfg.pickupLabel : 'Where should we collect from?'}
            value={pickup}
            onChange={setPickup}
            trailing={
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => locate(false)}
                disabled={locating}
                aria-label="Use my current location as pickup"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1E3FCE] disabled:opacity-50"
              >
                {locating ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="locate" className="h-4 w-4" />}
              </button>
            }
          />
        </TripRow>

        {stops.map((s, i) => (
          <TripRow key={s.id} kind="stop" first={false} last={false}>
            <PlaceField label={`Extra stop ${i + 1}`} placeholder={`Extra stop ${i + 1}`} value={s.place} onChange={(place) => patchStop(s.id, { place })} />
            <div className="flex items-center justify-between gap-2 pb-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                Wait
                <button type="button" aria-label="Wait 5 minutes less" onClick={() => patchStop(s.id, { wait: Math.max(0, s.wait - 5) })} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white">
                  <Icon name="minus" className="h-3.5 w-3.5" />
                </button>
                <span className="w-12 text-center font-bold text-gray-900">{s.wait} min</span>
                <button type="button" aria-label="Wait 5 minutes more" onClick={() => patchStop(s.id, { wait: Math.min(cfg.maxWaitMinutes, s.wait + 5) })} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white">
                  <Icon name="plus" className="h-3.5 w-3.5" />
                </button>
              </span>
              <button type="button" onClick={() => removeStop(s.id)} className="py-2 font-semibold text-red-600">
                Remove
              </button>
            </div>
          </TripRow>
        ))}

        {cfg.requiresDestination && (
          <TripRow kind="dest" first={false} last>
            <PlaceField label={cfg.dropoffLabel} placeholder="Where to?" value={dropoff} onChange={setDropoff} invalid={sameSpot} />
          </TripRow>
        )}

        {sameSpot && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            Pickup and drop-off are the same place. Choose a different drop-off.
          </p>
        )}
        {locationNote && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
            {locationNote}
          </p>
        )}
        {stops.length < cfg.maxStops && (
          <button type="button" onClick={addStop} className="mt-2 flex items-center gap-1.5 py-2 text-sm font-semibold text-[#1E3FCE]">
            <Icon name="plus" className="h-4 w-4" />
            Add a stop ({cfg.maxStops - stops.length} left)
          </button>
        )}
      </Card>

      {cfg.requiresDestination && !dropoff && places.recent.length > 0 && (
        <section aria-label="Recent places">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Recent places</h3>
          <div className="divide-y divide-gray-50 rounded-2xl border border-gray-100 bg-white">
            {places.recent.map((p) => (
              <button type="button" key={`${p.lat},${p.lng}`} onClick={() => setDropoff(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Icon name="clock" className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-medium text-gray-900">{p.address}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );

  const detailsStep = (
    <>
      {service === 'parcel' && (
        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-900">What are you sending?</h3>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {DELIVERY_CATEGORIES.map((c) => (
              <OptionButton key={c.id} on={parcel.category === c.id} label={c.label} desc={c.desc} onClick={() => patchParcel({ category: c.id })} />
            ))}
          </div>
          <div className="space-y-3">
            <Field label="Recipient name" id="bf-rname">
              <input id="bf-rname" className={inputCls} value={parcel.recipientName} autoComplete="off" onChange={(e) => patchParcel({ recipientName: e.target.value })} />
            </Field>
            <Field label="Recipient phone" id="bf-rphone">
              <input
                id="bf-rphone"
                className={inputCls}
                type="tel"
                inputMode="tel"
                placeholder="024 123 4567"
                value={parcel.recipientPhone}
                aria-invalid={!!parcel.recipientPhone && !isGhPhone(parcel.recipientPhone)}
                onChange={(e) => patchParcel({ recipientPhone: e.target.value })}
              />
            </Field>
            <Field label="Item description" id="bf-item">
              <input id="bf-item" className={inputCls} value={parcel.item} maxLength={120} placeholder="Describe what you’re sending" onChange={(e) => patchParcel({ item: e.target.value })} />
            </Field>
          </div>
        </Card>
      )}

      {service === 'waste-bin' && (
        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-900">Type of waste</h3>
          <div className="mb-4 grid grid-cols-1 gap-2">
            {WASTE_TYPES.map((w) => (
              <OptionButton key={w.id} on={waste.type === w.id} label={w.label} desc={w.desc} onClick={() => patchWaste({ type: w.id })} />
            ))}
          </div>
          <Field label="How many bins or bags?" id="bf-bins">
            <input id="bf-bins" className={inputCls} inputMode="numeric" value={waste.bins} maxLength={40} onChange={(e) => patchWaste({ bins: e.target.value })} />
          </Field>
        </Card>
      )}

      <Card>
        <div className="space-y-4">
          <Field label={cfg.notesLabel} id="bf-notes">
            <textarea id="bf-notes" className={`${inputCls} min-h-[84px] resize-y`} placeholder={cfg.notesPlaceholder} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div>
            <span className="text-xs font-semibold text-gray-700">When</span>
            <div className="mt-1 grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="group" aria-label="When">
              {(['now', 'later'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={when === w}
                  onClick={() => setWhen(w)}
                  className={`rounded-lg py-2.5 text-sm font-semibold ${when === w ? 'bg-white text-[#1E3FCE] shadow-sm' : 'text-gray-600'}`}
                >
                  {w === 'now' ? 'As soon as possible' : 'Schedule'}
                </button>
              ))}
            </div>
            {when === 'later' && (
              <input className={`${inputCls} mt-2`} type="datetime-local" min={minLater} value={scheduled} onChange={(e) => setScheduled(e.target.value)} aria-label="Pickup date and time" />
            )}
          </div>
        </div>
      </Card>
    </>
  );

  const reviewStep = (
    <>
      <Card label="Trip summary">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src={SERVICE_ICON[service]} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
            <p className="truncate text-sm font-extrabold text-gray-900">{cfg.name}</p>
          </div>
          <button type="button" onClick={() => jumpTo('trip')} className="shrink-0 py-1 text-xs font-bold text-[#1E3FCE]">
            Edit
          </button>
        </div>
        <RouteSummary points={summaryPoints} />
        {when === 'later' && scheduled && (
          <p className="mt-3 text-xs text-gray-600">Scheduled for {new Date(scheduled).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        )}
      </Card>

      <PromoCard
        promo={promo}
        input={promoInput}
        error={promoError}
        discount={live?.quote.breakdown.discount ?? 0}
        quoting={quoting}
        onInputChange={(v) => {
          setPromoInput(v);
          setPromoError('');
        }}
        onApply={applyPromo}
        onRemove={() => {
          setPromo('');
          setPromoError('');
        }}
      />

      <PriceCard live={live} quoting={quoting} error={quoteError} onRetry={() => refreshQuote(false)} />
      {priceChanged && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          {priceChanged}
        </p>
      )}

      <ul className="space-y-2 px-1 text-xs text-gray-500">
        <li>✓ The price you see is the price you pay.</li>
        <li>
          ✓ Cancel free until a {cfg.provider} accepts. After that, free for {cfg.cancelGraceMinutes} minutes, then a small fee of {money(cfg.cancelFeeAccepted)}.
        </li>
        <li>✓ You’ll see your {cfg.provider}’s name, photo and number as soon as they accept.</li>
      </ul>
    </>
  );

  const payStep = (
    <>
      {live && (
        <Card label="Order total">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-600">{cfg.name}</span>
            <span className="text-lg font-extrabold text-[#1E3FCE]">{money(live.quote.total_price)}</span>
          </div>
          {live.quote.breakdown.discount > 0 && (
            <p className="mt-1 text-xs font-bold text-green-700">You save {money(live.quote.breakdown.discount)}</p>
          )}
          <LockNote live={live} quoting={quoting} />
        </Card>
      )}

      {priceChanged && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          {priceChanged}
        </p>
      )}

      <div className="space-y-2" role="radiogroup" aria-label="Payment method">
        {PAYMENT_METHODS.map((m) => {
          const on = payment === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={submitting}
              onClick={() => {
                setPayment(m);
                setSubmitError('');
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3FCE] ${
                on ? 'border-[#1E3FCE] bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-2xl">{PAY_ICON[m]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gray-900">{PAYMENT_LABEL[m]}</span>
                <span className="block text-xs text-gray-500">{PAY_HINT[m]}</span>
              </span>
              {on && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E3FCE] text-white">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {payment && ONLINE_PAYMENT_METHODS.includes(payment) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">
          You’ll finish your {PAYMENT_LABEL[payment]} payment on a secure page. Your {cfg.provider} is contacted once it goes through.
        </p>
      )}
      {payment === 'cash' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">Pay the {cfg.provider} in cash at the end of your trip. Please keep small change ready.</p>}
      {payment === 'wallet' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">The amount is taken from your wallet now and refunded if you cancel before a {cfg.provider} accepts.</p>}

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {submitError}{' '}
          {needsSignIn && (
            <Link href="/login" className="font-bold underline">
              Sign in
            </Link>
          )}
        </p>
      )}
    </>
  );

  // ─── render ───
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gray-50 text-gray-900">
      <header className="shrink-0 border-b border-gray-100 bg-white pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 px-4 pb-2">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting || (stepIndex === 0 && !onClose)}
            aria-label={stepIndex === 0 ? 'Close booking' : 'Back to previous step'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 disabled:opacity-0"
          >
            <Icon name={stepIndex === 0 ? 'close' : 'back'} className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold leading-tight text-gray-900">{stepTitle[step].title}</h2>
            <p className="truncate text-xs text-gray-500">{stepTitle[step].hint}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-gray-400" aria-hidden>
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
        <Stepper current={step} onJump={jumpTo} />
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
        {step === 'trip' && tripStep}
        {step === 'details' && detailsStep}
        {step === 'review' && reviewStep}
        {step === 'pay' && payStep}
      </div>

      {/* Footer is part of the layout, so it can never cover content */}
      <footer className="shrink-0 border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onPrimary}
          disabled={!!blocker || submitting}
          className="flex w-full items-center justify-center gap-2 truncate rounded-2xl bg-[#1E3FCE] px-4 py-4 text-[15px] font-extrabold text-white shadow-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          {submitting && <Spinner tone="white" />}
          <span className="truncate">{primaryLabel}</span>
        </button>
      </footer>
    </div>
  );
}

