'use client';


/**
 * RYDNOW customer dashboard (single file).
 *
 * Flow: pick service -> addresses (+ extra stops) -> signed quote (price lock) -> pay sheet -> booking.
 * Every number on screen comes from the backend quote via lib/rydnow/api.ts. Nothing is calculated here.
 *
 * Layout: a fixed-height app shell (100dvh). Only <main> scrolls; the booking button and the tab bar sit in
 * normal flow underneath it, so nothing can overlap and mobile browser bars cannot make the page jump.
 *
 * File map (top to bottom):
 *   1. Settings, types, constants
 *   2. Pure helpers
 *   3. Small presentational components
 *   4. Larger UI sections
 *   5. Data hooks (toast, quote, nearby riders, bookings, online status)
 *   6. CustomerDashboard (default export)
 */


import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';


import {
  api,
  friendlyError,
  isAbort,
  isApiError,
  needsNewQuote,
  type Booking,
  type BookingListItem,
  type NearbyRider,
  type Quote,
  type QuoteBreakdown,
  type TripInput,
} from '@/lib/rydnow/api';
import {
  NEARBY_DEFAULT_RADIUS_KM,
  NEARBY_POLL_MS,
  ONLINE_PAYMENT_METHODS,
  PAGE_SIZE_DEFAULT,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  QUOTE_FALLBACK_TTL_SECONDS,
  SERVICE_HINTS,
  SERVICE_LABELS,
  SERVICE_ORDER,
  SURGE_REASON_LABELS,
  isTerminalBooking,
  money,
  normalizeServiceKey,
  type PaymentMethod,
  type Place,
  type ServiceHints,
  type ServiceKey,
} from '@/lib/rydnow/config';
import { currentPosition, reversePlace, searchPlaces } from '@/lib/rydnow/geocode';
// FIX: the token helpers live in session.ts (getToken was not exported from api.ts)
import { clearSession, getAuthToken } from '@/lib/rydnow/session';


import AccountTab from '@/components/dashboard/AccountTab';
import ActivityTab, { cancelMessage, isActive, statusUi } from '@/components/dashboard/ActivityTab';
import {
  SAVED_PLACE_META,
  useCountdown,
  useLockPageScroll,
  usePlaces,
  useProfile,
  type SavedPlaceId,
} from '@/lib/rydnow/hooks';
import PlaceField from '@/components/PlaceField';
import { RiderMap, useRouteLine, type LatLng, type MapRider } from '@/components/RiderMap';
import {
  ConfirmDialog,
  Icon,
  RouteSummary,
  Sheet,
  Spinner,
  inputCls,
  type ConfirmState,
  type ToastType,
} from '@/components/dashboard/ui';


// ═══ 1. SETTINGS, TYPES, CONSTANTS ═══


// ─── Settings: edit anytime ───
const REFERRAL_REWARD = 10; // ₵ off for the friend AND the inviter
const REFERRAL_PATH = '/signup'; // page that reads ?ref=CODE
const DEFAULT_CENTER: LatLng = { lat: 5.6037, lng: -0.187 }; // Accra


const SUPPORT = {
  phoneLabel: '+233 59 411 6155',
  phoneHref: 'tel:+233594116155',
  whatsappHref: 'https://wa.me/233594116155',
  email: 'support@rydnow.app',
} as const;


// Ghana emergency numbers
const EMERGENCY = [
  { label: 'Emergency (all services)', number: '112', icon: '🚨' },
  { label: 'Police', number: '191', icon: '👮' },
  { label: 'Ambulance', number: '193', icon: '🚑' },
  { label: 'Fire service', number: '192', icon: '🚒' },
] as const;


// Service icons live in /public
const SERVICE_ICON_SRC: Record<ServiceKey, string> = {
  okada: '/Bike.png',
  parcel: '/Delivery rider.jpeg',
  'waste-bin': '/Bin collector.jpeg',
};


// ─── Timings ───
const QUOTE_DEBOUNCE_MS = 450;
const BOOKING_POLL_MS = 5_000;
const MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000;


// Circumference of the price-lock countdown ring (r = 24).
const RING = 2 * Math.PI * 24;


// ─── Types ───
type Tab = 'home' | 'activity' | 'account';


/** Display wording for a service. Static copy only: the backend does not send it. */
interface ServiceUi {
  name: string;
  blurb: string;
  /** Singular / plural noun for whoever does the job. */
  provider: string;
  providers: string;
  pickupLabel: string;
  dropoffLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
}


/** Everything the page needs to know about the selected service: wording + backend limits. */
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


// ─── Static option lists ───
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


// ═══ 2. HELPERS ═══


/** Pure helpers. No React, no browser-only globals at import time. */


// FIX: template literals had lost their "${ }" and printed raw text.
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;


const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;


const cleanPhone = (value: string) => value.replace(/[\s\-()]/g, '');


const isGhPhone = (value: string) => /^(\+233|233|0)\d{9}$/.test(cleanPhone(value));


const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);


/** Rough ETA at ~20 km/h in town traffic. */
const etaMinutes = (km: number) => Math.max(2, Math.round((km / 20) * 60) + 1);


function greetingFor(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}


/** Value for <input type="datetime-local"> in the user's local time. */
function localInputValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}


/** Fallback only. Prefer a server-issued code (currentUser.referral_code): this hash can collide and is guessable. */
function makeReferralCode(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `RYD-${h.toString(36).toUpperCase().padStart(5, '0').slice(-5)}`;
}


/** The login page saves the user object as plain JSON under "currentUser". */
function readStoredUser(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem('currentUser');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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


/** GET booking/ returns summaries only. Used when a booking's full detail could not be loaded. */
function fromListItem(item: BookingListItem): Booking {
  return {
    ...item,
    pickup_latitude: null,
    pickup_longitude: null,
    dropoff_latitude: null,
    dropoff_longitude: null,
    notes: '',
    accepted_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancellation_reason: '',
    stops: [],
    history: [],
    rider: null,
    payment: null,
  };
}


const vehicleLabel = (v: NearbyRider['vehicle']) => [v?.color, v?.model].filter(Boolean).join(' ');


/** Rider phone, if the backend included one. Field names vary, so read defensively. */
function riderPhoneOf(b: Booking): string {
  const r = b.rider as unknown as { phone?: string; phone_number?: string } | null;
  return (r?.phone || r?.phone_number || '').trim();
}


/** Plain-text trip summary a customer can send to family or friends. */
function tripShareText(b: Booking): string {
  const lines = [`I’m on a Rydnow trip (${b.reference}).`, `Status: ${statusUi(b).label}`, `From: ${b.pickup_address}`];
  if (b.dropoff_address && b.dropoff_address !== b.pickup_address) lines.push(`To: ${b.dropoff_address}`);
  return lines.join('\n');
}


// ═══ 3. PRESENTATIONAL COMPONENTS ═══


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
      className={`rounded-xl border p-3 text-left transition-colors ${on ? 'border-[#1E3FCE] bg-[#1E3FCE] text-white' : 'border-gray-100 bg-gray-50 text-gray-900'}`}
    >
      <p className="text-[13px] font-bold">{label}</p>
      <p className="mt-0.5 text-[11px] leading-snug opacity-70">{desc}</p>
    </button>
  );
}


/** One row of the pickup -> stops -> destination card. The dot is pinned to the input line, not the row centre. */
function TripRow({ kind, first, last, children }: { kind: 'pickup' | 'stop' | 'dest'; first: boolean; last: boolean; children: ReactNode }) {
  const line = first && last ? 'hidden' : first ? 'top-6 bottom-0' : last ? 'top-0 h-6' : 'inset-y-0';
  const dot =
    kind === 'pickup' ? 'rounded-full bg-[#1E3FCE]' : kind === 'dest' ? 'rounded-[2px] bg-gray-900' : 'rounded-full border-2 border-gray-400 bg-white';
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


interface PriceCardProps {
  live: LiveQuote | null;
  quoting: boolean;
  hasInput: boolean;
  error: string;
  onRetry: () => void;
}


/** The price-lock card. Owns its own 1 s ticker so the rest of the page does not re-render every second. */
function PriceCard({ live, quoting, hasInput, error, onRetry }: PriceCardProps) {
  const left = useCountdown(live?.expiresAtMs);
  const q = live?.quote ?? null;
  const surgeReason = q ? SURGE_REASON_LABELS[q.surge.reason] : '';


  return (
    <section aria-label="Your price" aria-live="polite" className="min-h-[7.5rem] rounded-2xl border-2 border-[#F5B82E] bg-white p-4">
      {!hasInput && !error && <p className="text-sm text-gray-500">Add your addresses and your exact price appears here.</p>}


      {hasInput && quoting && !q && !error && (
        <div className="space-y-2" aria-label="Getting your price">
          <div className="h-9 w-2/3 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-5 w-full animate-pulse rounded-lg bg-gray-100" />
        </div>
      )}


      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3" role="alert">
          <p className="min-w-0 flex-1 text-sm text-red-700">{error}</p>
          <button onClick={onRetry} className="shrink-0 py-1 text-sm font-bold text-red-700 underline">
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
                  strokeDashoffset={RING * (1 - left / Math.max(1, Math.round((live.expiresAtMs - live.receivedAtMs) / 1000)))}
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


          <ul className="space-y-1.5 text-sm">
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


function LockedTotal({ live, quoting, name }: { live: LiveQuote; quoting: boolean; name: string }) {
  const left = useCountdown(live.expiresAtMs);
  const discount = live.quote.breakdown.discount;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-600">{name}</span>
        <span className="text-lg font-extrabold text-[#1E3FCE]">{money(live.quote.total_price)}</span>
      </div>
      {discount > 0 && <p className="mt-1 text-xs font-bold text-green-700">You save {money(discount)}</p>}
      <p className="mt-1 text-xs text-gray-500">{quoting ? 'Refreshing your price…' : `Price locked for ${mmss(left)}`}</p>
    </div>
  );
}


function ShieldIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.500 7-10V6l-7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}


function SwapIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3" />
    </svg>
  );
}


// ═══ 4. UI SECTIONS ═══


function ParcelDetails({ value, onChange }: { value: ParcelDraft; onChange: (patch: Partial<ParcelDraft>) => void }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-bold text-gray-900">What are you sending?</h3>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {DELIVERY_CATEGORIES.map((c) => (
          <OptionButton key={c.id} on={value.category === c.id} label={c.label} desc={c.desc} onClick={() => onChange({ category: c.id })} />
        ))}
      </div>
      <div className="space-y-3">
        <Field label="Recipient name" id="rname">
          <input id="rname" className={inputCls} value={value.recipientName} onChange={(e) => onChange({ recipientName: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Recipient phone" id="rphone">
          <input
            id="rphone"
            className={inputCls}
            type="tel"
            inputMode="tel"
            placeholder="024 123 4567"
            value={value.recipientPhone}
            aria-invalid={!!value.recipientPhone && !isGhPhone(value.recipientPhone)}
            onChange={(e) => onChange({ recipientPhone: e.target.value })}
          />
        </Field>
        <Field label="Item description" id="item">
          <input id="item" className={inputCls} value={value.item} maxLength={120} placeholder="Describe what you’re sending" onChange={(e) => onChange({ item: e.target.value })} />
        </Field>
      </div>
    </Card>
  );
}


function WasteDetails({ value, onChange }: { value: WasteDraft; onChange: (patch: Partial<WasteDraft>) => void }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-bold text-gray-900">Type of waste</h3>
      <div className="mb-4 grid grid-cols-1 gap-2">
        {WASTE_TYPES.map((w) => (
          <OptionButton key={w.id} on={value.type === w.id} label={w.label} desc={w.desc} onClick={() => onChange({ type: w.id })} />
        ))}
      </div>
      <Field label="How many bins or bags?" id="bins">
        <input id="bins" className={inputCls} inputMode="numeric" value={value.bins} maxLength={40} onChange={(e) => onChange({ bins: e.target.value })} />
      </Field>
    </Card>
  );
}


interface RidersCardProps {
  riders: NearbyRider[] | null;
  nearest: NearbyRider | null;
  error: boolean;
  cfg: ServiceView;
}


function RidersNearbyCard({ riders, nearest, error, cfg }: RidersCardProps) {
  const headline =
    riders === null
      ? error
        ? 'We couldn’t check right now'
        : `Checking ${cfg.providers} near you…`
      : riders.length
        ? `${riders.length} ${riders.length === 1 ? cfg.provider : cfg.providers} near your ${cfg.pickupLabel.toLowerCase()}`
        : `No ${cfg.providers} online nearby right now`;


  const detail =
    riders && nearest
      ? `Nearest is about ${etaMinutes(nearest.distance_km)} min away. Only ${cfg.providers} approved for ${cfg.name.toLowerCase()} are shown.`
      : riders && !riders.length
        ? `You can still book. We keep searching for a few minutes and tell you straight away if nobody is free. Cancelling is free until a ${cfg.provider} accepts.`
        : error
          ? 'You can still book. We match you automatically.'
          : '';


  return (
    <Card label="Riders nearby">
      <p className="text-sm font-bold text-gray-900">{headline}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
      {riders && riders.length > 0 && (
        <ul className="mt-3 space-y-2">
          {riders.slice(0, 3).map((r) => {
            const firstName = r.name.trim().split(' ')[0] || 'Rider';
            const vehicle = vehicleLabel(r.vehicle);
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-extrabold text-[#1E3FCE]" aria-hidden>
                  {firstName[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {firstName}
                    {r.tier && r.tier !== 'standard' && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold">{r.tier}</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    ★ {r.rating.toFixed(1)} · {r.distance_km.toFixed(1)} km away{vehicle ? ` · ${vehicle}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}


interface PromoCardProps {
  promo: string;
  input: string;
  error: string;
  /** Discount on the current quote (0 when none). */
  discount: number;
  quoting: boolean;
  onInputChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
}


function PromoCard({ promo, input, error, discount, quoting, onInputChange, onApply, onRemove }: PromoCardProps) {
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
          <button onClick={onRemove} className="py-2 pl-2 text-xs font-bold text-gray-500">
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
          <button onClick={onApply} disabled={!input.trim()} className="shrink-0 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white disabled:opacity-40">
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


function InviteBanner({ reward, onOpen }: { reward: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3FCE] to-[#13258a] p-5 text-left shadow-lg">
      <span className="absolute -right-3 -top-3 rotate-12 text-7xl opacity-20" aria-hidden>
        🎁
      </span>
      <p className="text-xs font-extrabold text-[#F5B82E]">INVITE FRIENDS</p>
      <h3 className="mt-1 text-xl font-extrabold leading-snug text-white">
        Give GH₵{reward}, get GH₵{reward}
      </h3>
      <p className="mt-1 pr-16 text-sm text-white/80">Share your code. When a friend takes their first booking, you both save.</p>
      <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#F5B82E] px-4 py-2.5 text-sm font-extrabold text-gray-900">
        <Icon name="gift" className="h-4 w-4" />
        Invite friends
      </span>
    </button>
  );
}


interface InviteSheetProps {
  open: boolean;
  reward: number;
  referral: string;
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
}


function InviteSheet({ open, reward, referral, onClose, onCopy, onShare }: InviteSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Invite friends">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">
            Give GH₵{reward}, get GH₵{reward}
          </h3>
          <p className="mt-1 text-sm text-gray-600">Your friend saves GH₵{reward} on their first booking, and so do you once they ride.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#F5B82E] bg-amber-50/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500">Your invite code</p>
          <p className="truncate text-xl font-extrabold tracking-widest text-gray-900">{referral}</p>
        </div>
        <button onClick={onCopy} className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800">
          <Icon name="copy" className="h-4 w-4" />
          Copy
        </button>
      </div>
      <button onClick={onShare} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E3FCE] py-4 text-[15px] font-extrabold text-white">
        <Icon name="share" className="h-5 w-5" />
        Share invite
      </button>
    </Sheet>
  );
}


interface SafetySheetProps {
  open: boolean;
  active: Booking | null;
  onClose: () => void;
  onShareTrip: () => void;
}


/** Safety & help: emergency numbers, trip sharing and support. Always one tap away from the home screen. */
function SafetySheet({ open, active, onClose, onShareTrip }: SafetySheetProps) {
  const riderPhone = active ? riderPhoneOf(active) : '';
  return (
    <Sheet open={open} onClose={onClose} label="Safety and help">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">Safety & help</h3>
          <p className="mt-1 text-sm text-gray-600">Quick access to emergency services and the Rydnow team.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>


      <div className="mt-4 grid grid-cols-2 gap-2">
        {EMERGENCY.map((e) => (
          <a
            key={e.number}
            href={`tel:${e.number}`}
            className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 active:bg-red-100"
          >
            <span className="text-xl" aria-hidden>
              {e.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold text-red-700">{e.number}</span>
              <span className="block truncate text-[11px] text-red-900/80">{e.label}</span>
            </span>
          </a>
        ))}
      </div>


      <div className="mt-4 space-y-2">
        <button
          onClick={onShareTrip}
          disabled={!active}
          className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1E3FCE]">
            <Icon name="share" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Share my trip</span>
            <span className="block text-xs text-gray-500">{active ? 'Send your trip details to someone you trust' : 'Available while you have an active booking'}</span>
          </span>
        </button>


        {riderPhone && (
          <a href={`tel:${riderPhone}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg">📞</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-900">Call my {active && normalizeServiceKey(active.service_key) === 'waste-bin' ? 'collector' : 'rider'}</span>
              <span className="block text-xs text-gray-500">{riderPhone}</span>
            </span>
          </a>
        )}


        <a href={SUPPORT.phoneHref} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg">☎️</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Call Rydnow support</span>
            <span className="block text-xs text-gray-500">{SUPPORT.phoneLabel}</span>
          </span>
        </a>


        <a href={SUPPORT.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg">💬</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Chat on WhatsApp</span>
            <span className="block text-xs text-gray-500">Fast help with a booking or payment</span>
          </span>
        </a>


        <a href={`mailto:${SUPPORT.email}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">✉️</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Email us</span>
            <span className="block truncate text-xs text-gray-500">{SUPPORT.email}</span>
          </span>
        </a>
      </div>


      <ul className="mt-4 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <li>✓ Check the rider’s name and photo before you start.</li>
        <li>✓ Wear a helmet and never ride with more than one passenger.</li>
        <li>✓ Share your trip with a friend for late-night rides.</li>
      </ul>
    </Sheet>
  );
}


// ═══ 5. DATA HOOKS ═══


interface ToastState {
  message: string;
  type: ToastType;
}


function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const notify = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);


  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );


  return { toast, notify };
}


/** True while the browser has no connection. */
function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}


interface QuoteOptions {
  /** null while the form is incomplete. Must be memoised by the caller. */
  input: TripInput | null;
  /** Pause the auto-refresh while a booking is being submitted. */
  paused: boolean;
  /** Both callbacks must be stable (useCallback). */
  onUnauthorized: () => void;
  onPromoRejected: (message: string) => void;
}


/**
 * Fetches a signed, price-locked quote from the backend and refreshes it when the lock expires.
 * Nothing is calculated on the client.
 */
function useQuote({ input, paused, onUnauthorized, onPromoRejected }: QuoteOptions) {
  const [live, setLive] = useState<LiveQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [priceChanged, setPriceChanged] = useState('');
  const [tick, setTick] = useState(0);


  const requestId = useRef(0);
  const lastTotal = useRef<number | null>(null);
  const autoRefresh = useRef(false); // true only when WE re-requested an expired quote


  /** `auto` = true when the app (not the customer) asked, so we can tell them if the price moved. */
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
          onPromoRejected(e.fieldErrors.promo_code?.[0] ?? e.userMessage); // parent clears the code, which re-quotes without it
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


/** Polls riders near `origin` for the chosen service. `riders === null` means "still loading". */
function useNearbyRiders(origin: { lat: number; lng: number } | null, service: ServiceKey) {
  const lat = origin?.lat;
  const lng = origin?.lng;
  const [riders, setRiders] = useState<NearbyRider[] | null>(null);
  const [error, setError] = useState(false);


  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setRiders(null);
      return;
    }


    let alive = true;
    const ctrl = new AbortController();
    setRiders(null);
    setError(false);


    const load = async () => {
      try {
        const result = await api.riders.nearby({ lat, lng, service_type: service, radius_km: NEARBY_DEFAULT_RADIUS_KM }, ctrl.signal);
        if (!alive) return;
        setRiders(result.results);
        setError(false);
      } catch (e) {
        if (alive && !isAbort(e)) setError(true);
      }
    };


    load();
    const interval = setInterval(load, NEARBY_POLL_MS);
    return () => {
      alive = false;
      ctrl.abort();
      clearInterval(interval);
    };
  }, [lat, lng, service]);


  const mapRiders = useMemo<MapRider[]>(
    () => (riders ?? []).map((r) => ({ id: r.id, lat: r.latitude, lng: r.longitude })),
    [riders],
  );


  const nearest = useMemo(
    () => (riders && riders.length ? [...riders].sort((a, b) => a.distance_km - b.distance_km)[0] : null),
    [riders],
  );


  return { riders, error, mapRiders, nearest };
}


/**
 * Loads the customer's bookings and polls while one is in progress. `onUnauthorized` must be stable.
 *
 * GET booking/ returns summaries, so each booking's detail is fetched too (stops, rider, payment).
 * Finished bookings never change, so their detail is cached and fetched only once.
 */
function useBookings(onUnauthorized: () => void) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const finished = useRef(new Map<string, Booking>());


  const reload = useCallback(async () => {
    try {
      const page = await api.booking.list({ page_size: PAGE_SIZE_DEFAULT });
      const detailed = await Promise.all(
        page.results.map(async (item): Promise<Booking> => {
          const cached = finished.current.get(item.reference);
          if (cached) return cached;
          try {
            const detail = await api.booking.detail(item.reference);
            if (isTerminalBooking(detail.status)) finished.current.set(item.reference, detail);
            return detail;
          } catch (e) {
            if (isApiError(e) && e.status === 401) throw e;
            return fromListItem(item);
          }
        }),
      );
      setBookings(detailed.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || 0));
    } catch (e) {
      if (isApiError(e) && e.status === 401) onUnauthorized();
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);


  useEffect(() => {
    reload();
  }, [reload]);


  const active = useMemo(() => bookings.find(isActive) ?? null, [bookings]);
  const hasActive = active !== null;


  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, BOOKING_POLL_MS);
    return () => clearInterval(id);
  }, [hasActive, reload]);


  return { bookings, loading, active, hasActive, reload };
}


// ═══ 6. CUSTOMER DASHBOARD ═══


const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'account', label: 'Account', icon: 'user' },
];


export default function CustomerDashboard() {
  useLockPageScroll();
  const router = useRouter();
  const { profile, update: updateProfile } = useProfile();
  const places = usePlaces();
  const { toast, notify } = useToast();
  const offline = useOffline();
  const scrollRef = useRef<HTMLElement>(null);


  // ---- navigation / ui ----
  const [tab, setTab] = useState<Tab>('home');
  const [greeting, setGreeting] = useState('Hello');
  const [payOpen, setPayOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [editingSaved, setEditingSaved] = useState<SavedPlaceId | null>(null);
  const [activityFilter, setActivityFilter] = useState<'active' | 'history'>('active');
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [referral, setReferral] = useState('RYD-GUEST');


  // ---- trip form ----
  const [service, setService] = useState<ServiceKey>('okada');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
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


  // ---- submit state ----
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);


  /**
   * Wording + backend limits for the selected service. `service` always holds a valid key
   * (it starts as 'okada'), so this is never undefined. Both maps are keyed by ServiceKey.
   */
  const cfg = useMemo<ServiceView>(() => ({ ...SERVICE_UI[service], ...SERVICE_HINTS[service] }), [service]);


  // ─── auth ───
  const signOut = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);


  useEffect(() => {
    if (!getAuthToken()) router.replace('/login');
  }, [router]);


  useEffect(() => {
    setGreeting(greetingFor());
    const u = readStoredUser();
    const code = typeof u.referral_code === 'string' ? u.referral_code : '';
    const seed = String(u.email || u.phone || u.username || u.full_name || 'guest');
    setReferral(code || makeReferralCode(seed));
  }, []);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);


  // ─── location ───
  const locate = useCallback(
    async (silent = false) => {
      setLocating(true);
      try {
        const pos = await currentPosition();
        const place = await reversePlace(pos.lat, pos.lng);
        setUserLoc({ lat: pos.lat, lng: pos.lng });
        setPickup((prev) => (silent ? (prev ?? place) : place));
      } catch (e) {
        if (!silent) {
          const denied = typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 1;
          notify(denied ? 'Location is turned off for this site. Type your address instead.' : 'We couldn’t find your location. Type your address instead.', 'error');
        }
      } finally {
        setLocating(false);
      }
    },
    [notify],
  );


  // If the customer already allowed location, pick it up automatically.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((s) => s.state === 'granted' && locate(true))
      .catch(() => undefined);
  }, [locate]);


  // ─── quote ───
  const sameSpot = cfg.requiresDestination && !!pickup && !!dropoff && pickup.lat === dropoff.lat && pickup.lng === dropoff.lng;
  const stopPlaces = useMemo(() => stops.map((s) => s.place).filter((p): p is Place => !!p), [stops]);


  /**
   * The ONE trip description. The quote and the booking are both built from it, because the
   * quote token signs the route and Booking creation rejects it if anything differs.
   * Null while the form is incomplete.
   */
  const trip = useMemo<TripInput | null>(() => {
    if (!pickup) return null;
    if (cfg.requiresDestination && (!dropoff || sameSpot)) return null;
    if (stops.some((s) => !s.place)) return null;
    return {
      service,
      pickup,
      destination: cfg.requiresDestination ? (dropoff ?? undefined) : undefined,
      stops: stops.map((s) => ({ ...(s.place as Place), waitMinutes: s.wait })),
      promoCode: promo || undefined,
    };
  }, [service, pickup, dropoff, stops, promo, cfg.requiresDestination, sameSpot]);


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
  } = useQuote({ input: trip, paused: submitting, onUnauthorized: signOut, onPromoRejected: rejectPromo });


  // ─── riders, route, bookings ───
  const riderOrigin = pickup ?? userLoc;
  const { riders, error: ridersError, mapRiders, nearest } = useNearbyRiders(riderOrigin, service);


  const routePoints = useMemo<LatLng[]>(
    () => (pickup && dropoff && cfg.requiresDestination ? [pickup, ...stopPlaces, dropoff] : []),
    [pickup, dropoff, stopPlaces, cfg.requiresDestination],
  );
  const routeCoords = useRouteLine(routePoints);
  const mapCenter = pickup ?? userLoc ?? DEFAULT_CENTER;


  const { bookings, loading: loadingBookings, active: activeBooking, hasActive, reload: loadBookings } = useBookings(signOut);


  // ─── service / stops ───
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
  const swapPlaces = () => {
    setPickup(dropoff);
    setDropoff(pickup);
  };


  // ─── what still blocks the Book button ───
  const minLater = useMemo(() => localInputValue(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS)), [when]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocker = (() => {
    if (offline) return 'You’re offline. Reconnect to book';
    if (!pickup) return `Add your ${cfg.pickupLabel.toLowerCase()}`;
    if (cfg.requiresDestination && !dropoff) return `Add your ${cfg.dropoffLabel.toLowerCase()}`;
    if (sameSpot) return 'Pickup and drop-off are the same place';
    if (stops.some((s) => !s.place)) return 'Finish or remove the extra stop';
    if (service === 'parcel' && !parcel.category) return 'Choose what you’re sending';
    if (service === 'parcel' && !parcel.recipientName.trim()) return 'Add the recipient’s name';
    if (service === 'parcel' && !isGhPhone(parcel.recipientPhone)) return 'Add a valid recipient phone number';
    if (service === 'waste-bin' && !waste.type) return 'Choose the type of waste';
    if (when === 'later' && (!scheduled || scheduled < minLater)) return 'Choose a pickup time at least 15 minutes ahead';
    if (quoting || !live) return quoteError ? 'Price unavailable. Tap Retry above' : 'Getting your price…';
    return '';
  })();


  const totalLabel = live ? money(live.quote.total_price) : '';
  const ctaLabel = blocker || `Book ${cfg.name} · ${totalLabel}`;


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


  function resetForm() {
    setPickup(null);
    setDropoff(null);
    setStops([]);
    setParcel(EMPTY_PARCEL);
    setWaste(EMPTY_WASTE);
    setNotes('');
    setWhen('now');
    setScheduled('');
    setPromo('');
    setPromoInput('');
    setPromoError('');
    setPayment(null);
    resetQuote();
  }


  // ─── create the booking ───
  async function confirm() {
    if (blocker || !live || !trip || submitting) return;
    if (!payment) return setSubmitError('Choose how you want to pay.');


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


      await loadBookings();
      setPayOpen(false);
      resetForm();
      setActivityFilter('active');
      setTab('activity');
      notify(when === 'later' ? 'Booking scheduled' : `Booking placed. Finding your ${cfg.provider}…`, 'success', 4500);
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


  // ─── cancel / rebook / logout ───
  function askCancel(b: Booking) {
    setConfirmDialog({
      title: 'Cancel this booking?',
      message: cancelMessage(b),
      confirmLabel: 'Cancel booking',
      danger: true,
      onConfirm: async () => {
        try {
          await api.booking.cancel(b.reference, 'Cancelled by customer');
          notify('Booking cancelled', 'success');
          await loadBookings();
        } catch (e) {
          if (isApiError(e) && e.status === 401) return signOut();
          notify(friendlyError(e), 'error');
        }
      },
    });
  }


  async function rebook(b: Booking) {
    const key = normalizeServiceKey(b.service_key) ?? normalizeServiceKey(b.service_type) ?? 'okada';
    const resolve = async (lat: number | null, lng: number | null, address: string): Promise<Place | null> => {
      if (lat !== null && lng !== null) return { address, lat, lng };
      try {
        return (await searchPlaces(address))[0] ?? null;
      } catch {
        return null;
      }
    };
    const needsDest = SERVICE_HINTS[key].requiresDestination;
    const [p, d] = await Promise.all([
      resolve(b.pickup_latitude, b.pickup_longitude, b.pickup_address),
      needsDest ? resolve(b.dropoff_latitude, b.dropoff_longitude, b.dropoff_address) : Promise.resolve(null),
    ]);
    setService(key);
    setPickup(p);
    setDropoff(d);
    setStops([]);
    setTab('home');
    notify('Trip details filled in. Check them and continue.', 'info');
  }


  function handleLogout() {
    setConfirmDialog({
      title: 'Log out of Rydnow?',
      message: 'You’ll need to sign in again to book.',
      confirmLabel: 'Log out',
      danger: true,
      onConfirm: () => {
        clearSession();
        notify('You have been logged out', 'success');
        setTimeout(() => router.push('/login'), 600);
      },
    });
  }


  // ─── invite ───
  const inviteLink = () => `${typeof window !== 'undefined' ? window.location.origin : ''}${REFERRAL_PATH}?ref=${referral}`;
  const inviteMessage = () =>
    `Ride, send parcels and book pickups with Rydnow. Use my code ${referral} to get GH₵${REFERRAL_REWARD} off your first booking: ${inviteLink()}`;


  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(referral);
      notify('Code copied', 'success');
    } catch {
      notify(`Your code is ${referral}`, 'info');
    }
  };


  const shareInvite = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Rydnow', text: inviteMessage() });
      } catch {
        /* share sheet closed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteMessage());
      notify('Invite message copied. Paste it to a friend.', 'success');
    } catch {
      notify('Sharing isn’t available on this device', 'error');
    }
  };


  // ─── share trip (safety) ───
  const shareTrip = async () => {
    if (!activeBooking) return;
    const text = tripShareText(activeBooking);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'My Rydnow trip', text });
      } catch {
        /* share sheet closed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify('Trip details copied. Paste them to someone you trust.', 'success');
    } catch {
      notify('Sharing isn’t available on this device', 'error');
    }
  };


  // ─── promo ───
  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return setPromoError('Enter a promo code');
    setPromoError('');
    setPromo(code);
    setPromoInput('');
  };


  // ─── derived display ───
  const firstName = profile.fullName.trim().split(' ')[0];
  const summaryPoints = [
    ...(pickup ? [{ label: cfg.pickupLabel, text: pickup.address }] : []),
    ...stopPlaces.map((p, i) => ({ label: `Stop ${i + 1}`, text: p.address })),
    ...(cfg.requiresDestination && dropoff ? [{ label: cfg.dropoffLabel, text: dropoff.address }] : []),
  ];
  const payLabel = !payment
    ? 'Choose a payment method'
    : submitting
      ? 'Placing booking…'
      : payment === 'cash'
        ? 'Confirm booking'
        : `Pay ${totalLabel}`;
  const chipText =
    riderOrigin === null
      ? 'Set your pickup to see riders nearby'
      : riders === null
        ? ridersError
          ? `${capitalise(cfg.providers)} nearby`
          : `Checking ${cfg.providers}…`
        : riders.length
          ? `${riders.length} ${riders.length === 1 ? cfg.provider : cfg.providers} nearby${nearest ? ` · ${etaMinutes(nearest.distance_km)} min` : ''}`
          : `No ${cfg.providers} online nearby`;


  // ─── HOME ───
  const home = (
    <>
      <div className="relative">
        <RiderMap
          center={mapCenter}
          user={userLoc}
          pickup={pickup}
          stops={stopPlaces}
          destination={cfg.requiresDestination ? dropoff : null}
          riders={mapRiders}
          routeCoords={routeCoords}
          height={300}
          bottomInset={28}
        />


        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white py-2 pl-3 pr-4 shadow-lg">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5B82E]" />
            <span className="text-sm font-extrabold tracking-wide text-[#1E3FCE]">RYDNOW</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button onClick={() => setSafetyOpen(true)} aria-label="Safety and help" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-green-700 shadow-lg">
              <ShieldIcon />
            </button>
            <button onClick={() => notify('You’re all caught up. No new notifications.', 'info')} aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg">
              <Icon name="bell" />
            </button>
            <button onClick={() => setTab('account')} aria-label="Open account" className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white text-gray-800 shadow-lg">
              {profile.photoUrl ? <Image src={profile.photoUrl} alt="" width={44} height={44} unoptimized className="h-11 w-11 object-cover" /> : <Icon name="user" />}
            </button>
          </div>
        </div>


        <div className="pointer-events-none absolute inset-x-4 bottom-14 z-10 flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex min-w-0 max-w-[calc(100%-3.5rem)] items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-lg" aria-live="polite">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {riders && riders.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${riders && riders.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
            </span>
            <span className="truncate">{chipText}</span>
          </div>
          <button
            onClick={() => locate(false)}
            disabled={locating}
            aria-label="Use my current location"
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5B82E] text-gray-900 shadow-lg disabled:opacity-60"
          >
            {locating ? <Spinner className="h-4 w-4" /> : <Icon name="locate" />}
          </button>
        </div>
      </div>


      <div className="relative z-20 -mt-5 space-y-5 rounded-t-3xl bg-gray-50 px-4 pb-8 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />


        <div>
          <h2 className="text-2xl font-extrabold leading-tight text-gray-900">
            {greeting}
            {firstName ? `, ${firstName}` : ''} 👋
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">Where would you like to go today?</p>
        </div>


        {activeBooking && (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-md">
            <button
              onClick={() => {
                setActivityFilter('active');
                setTab('activity');
              }}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{statusUi(activeBooking).label}</span>
                <span className="block truncate text-xs text-gray-500">
                  {activeBooking.pickup_address}
                  {activeBooking.dropoff_address && activeBooking.dropoff_address !== activeBooking.pickup_address ? ` → ${activeBooking.dropoff_address}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-[#1E3FCE]">Track</span>
            </button>
            <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 text-xs font-bold">
              <button onClick={shareTrip} className="flex items-center justify-center gap-1.5 py-3 text-[#1E3FCE]">
                <Icon name="share" className="h-4 w-4" />
                Share trip
              </button>
              {riderPhoneOf(activeBooking) ? (
                <a href={`tel:${riderPhoneOf(activeBooking)}`} className="flex items-center justify-center gap-1.5 py-3 text-green-700">
                  📞 Call {normalizeServiceKey(activeBooking.service_key) === 'waste-bin' ? 'collector' : 'rider'}
                </a>
              ) : (
                <button onClick={() => setSafetyOpen(true)} className="flex items-center justify-center gap-1.5 py-3 text-green-700">
                  <ShieldIcon className="h-4 w-4" />
                  Safety & help
                </button>
              )}
            </div>
          </div>
        )}


        {/* Trip card: pickup, extra stops, destination */}
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
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            {stops.length < cfg.maxStops && (
              <button type="button" onClick={addStop} className="flex items-center gap-1.5 py-2 text-sm font-semibold text-[#1E3FCE]">
                <Icon name="plus" className="h-4 w-4" />
                Add a stop ({cfg.maxStops - stops.length} left)
              </button>
            )}
            {cfg.requiresDestination && pickup && dropoff && (
              <button type="button" onClick={swapPlaces} className="flex items-center gap-1.5 py-2 text-sm font-semibold text-gray-600">
                <SwapIcon />
                Swap
              </button>
            )}
          </div>
        </Card>


        {/* Saved places */}
        <section aria-label="Saved places" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {SAVED_PLACE_META.map((meta) => {
            const place = places.saved[meta.id];
            return (
              <button
                key={meta.id}
                onClick={() => {
                  if (place) {
                    if (cfg.requiresDestination) setDropoff(place);
                    else setPickup(place);
                  } else {
                    setEditingSaved(meta.id);
                    setTab('account');
                    notify(`Add your ${meta.name} address to use it here`, 'info');
                  }
                }}
                className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white py-2 pl-3 pr-4 active:bg-gray-50"
              >
                <span className="text-base">{meta.icon}</span>
                <span className="text-left">
                  <span className="block text-xs font-bold text-gray-800">{meta.name}</span>
                  <span className="block max-w-[110px] truncate text-[11px] text-gray-500">{place ? place.address : 'Set address'}</span>
                </span>
              </button>
            );
          })}
        </section>


        {/* Services */}
        <section>
          <h2 className="mb-3 text-base font-extrabold text-gray-900">Choose a service</h2>
          <div className="grid grid-cols-3 items-stretch gap-2" role="radiogroup" aria-label="Service">
            {SERVICE_ORDER.map((key) => {
              const s = SERVICE_UI[key];
              const on = key === service;
              // Prices come only from the backend quote, so only the selected service shows one.
              const price = on ? (live ? money(live.quote.total_price) : quoting ? 'Pricing…' : 'Selected') : '';
              return (
                <button
                  key={key}
                  role="radio"
                  aria-checked={on}
                  onClick={() => chooseService(key)}
                  className={`relative flex min-w-0 flex-col items-center rounded-2xl border-2 px-1.5 py-3 text-center transition-colors ${on ? 'border-[#1E3FCE] bg-blue-50 shadow-md' : 'border-gray-200 bg-white'}`}
                >
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1E3FCE] text-white">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                  )}
                  <Image src={SERVICE_ICON_SRC[key]} alt="" width={44} height={44} unoptimized className="mb-2 h-11 w-11 object-contain" />
                  <span className="text-[13px] font-bold leading-tight text-gray-900">{s.name}</span>
                  <span className="mt-0.5 text-[11px] leading-tight text-gray-500">{s.blurb}</span>
                  <span className={`mt-auto min-h-[1.75rem] pt-2 text-xs font-extrabold ${on && live ? 'text-[#1E3FCE]' : 'text-gray-500'}`}>{price}</span>
                </button>
              );
            })}
          </div>
        </section>


        {/* Service details */}
        {service === 'parcel' && <ParcelDetails value={parcel} onChange={patchParcel} />}
        {service === 'waste-bin' && <WasteDetails value={waste} onChange={patchWaste} />}


        <Card>
          <div className="space-y-4">
            <Field label={cfg.notesLabel} id="notes">
              <textarea id="notes" className={`${inputCls} min-h-[84px] resize-y`} placeholder={cfg.notesPlaceholder} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
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


        {pickup && <RidersNearbyCard riders={riders} nearest={nearest} error={ridersError} cfg={cfg} />}


        <PromoCard
          promo={promo}
          input={promoInput}
          error={promoError}
          discount={live?.quote.breakdown.discount ?? 0}
          quoting={quoting}
          onInputChange={(value) => {
            setPromoInput(value);
            setPromoError('');
          }}
          onApply={applyPromo}
          onRemove={() => {
            setPromo('');
            setPromoError('');
          }}
        />


        <PriceCard live={live} quoting={quoting} hasInput={!!trip} error={quoteError} onRetry={() => refreshQuote(false)} />
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


        <InviteBanner reward={REFERRAL_REWARD} onOpen={() => setInviteOpen(true)} />


        <button
          onClick={() => setSafetyOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-green-100 bg-white p-4 text-left shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            <ShieldIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">Safety & help</span>
            <span className="block text-xs text-gray-500">Emergency numbers, trip sharing and support</span>
          </span>
        </button>


        {/* Recent places */}
        {!dropoff && cfg.requiresDestination && places.recent.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-gray-900">Recent places</h2>
            <div className="divide-y divide-gray-50 rounded-2xl border border-gray-100 bg-white">
              {places.recent.map((p) => (
                <button key={`${p.lat},${p.lng}`} onClick={() => setDropoff(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <Icon name="clock" className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-medium text-gray-900">{p.address}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );


  return (
    <div className="bg-gray-100 text-gray-900" style={{ height: '100dvh' }}>
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-gray-50 shadow-xl">
        {offline && (
          <div role="status" className="shrink-0 bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-900">
            You’re offline. Some features are unavailable until you reconnect.
          </div>
        )}


        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {tab === 'home' && home}
          {tab === 'activity' && (
            <ActivityTab
              bookings={bookings}
              loading={loadingBookings}
              filter={activityFilter}
              onFilter={setActivityFilter}
              onCancel={askCancel}
              onRebook={rebook}
              onBookNow={() => setTab('home')}
            />
          )}
          {tab === 'account' && (
            <AccountTab
              profile={profile}
              onProfileUpdate={updateProfile}
              saved={places.saved}
              onSavePlace={places.saveOne}
              editing={editingSaved}
              onEditing={setEditingSaved}
              notify={notify}
              onInvite={() => setInviteOpen(true)}
              onLogout={handleLogout}
              onUnauthorized={signOut}
            />
          )}
        </main>


        {/* Book button: part of the layout, so it can never cover content or the tab bar */}
        {tab === 'home' && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <button
              disabled={!!blocker || submitting}
              onClick={() => {
                setSubmitError('');
                setNeedsSignIn(false);
                setPayOpen(true);
              }}
              className="w-full truncate rounded-2xl bg-[#1E3FCE] px-4 py-4 text-[15px] font-extrabold text-white shadow-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
            >
              {ctaLabel}
            </button>
          </div>
        )}


        <nav aria-label="Main" className="shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${on ? 'text-[#1E3FCE]' : 'text-gray-400'}`}
                >
                  <Icon name={t.icon} className="h-6 w-6" />
                  {t.label}
                  {t.id === 'activity' && hasActive && <span className="absolute right-[34%] top-2 h-2 w-2 rounded-full bg-[#F5B82E]" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>


      {/* Pay sheet */}
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} dismissible={!submitting} label="Choose how to pay">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-gray-900">Choose how to pay</h3>
          <button onClick={() => setPayOpen(false)} disabled={submitting} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-50">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>


        {live && (
          <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <RouteSummary points={summaryPoints} />
            {when === 'later' && scheduled && (
              <p className="mt-3 text-xs text-gray-600">Scheduled for {new Date(scheduled).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            )}
            <div className="mt-4 border-t border-gray-200 pt-3">
              <LockedTotal live={live} quoting={quoting} name={cfg.name} />
            </div>
          </div>
        )}


        <div className="space-y-2" role="radiogroup" aria-label="Payment method">
          {PAYMENT_METHODS.map((m) => {
            const on = payment === m;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={on}
                disabled={submitting}
                onClick={() => {
                  setPayment(m);
                  setSubmitError('');
                }}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${on ? 'border-[#1E3FCE] bg-blue-50' : 'border-gray-200 bg-white'}`}
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
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">
            You’ll finish your {PAYMENT_LABEL[payment]} payment on a secure page. Your {cfg.provider} is contacted once it goes through.
          </p>
        )}
        {payment === 'cash' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">Pay the {cfg.provider} in cash at the end of your trip. Please keep small change ready.</p>}
        {payment === 'wallet' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-gray-700">The amount is taken from your wallet now and refunded if you cancel before a {cfg.provider} accepts.</p>}


        {submitError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {submitError}{' '}
            {needsSignIn && (
              <Link href="/login" className="font-bold underline">
                Sign in
              </Link>
            )}
          </p>
        )}


        <button
          onClick={confirm}
          disabled={submitting || !payment || !!blocker}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E3FCE] py-4 text-[15px] font-extrabold text-white disabled:opacity-50"
        >
          {submitting && <Spinner tone="white" />}
          {payLabel}
        </button>
      </Sheet>


      <InviteSheet open={inviteOpen} reward={REFERRAL_REWARD} referral={referral} onClose={() => setInviteOpen(false)} onCopy={copyCode} onShare={shareInvite} />


      <SafetySheet open={safetyOpen} active={activeBooking} onClose={() => setSafetyOpen(false)} onShareTrip={shareTrip} />


      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />


      {toast && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className={`w-full max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}


