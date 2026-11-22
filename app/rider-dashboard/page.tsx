'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * RYDNOW — Rider dashboard (mobile-first, Tailwind only, no custom CSS)
 *
 * Setup (once):   npm i leaflet && npm i -D @types/leaflet
 *   .env.local:   NEXT_PUBLIC_API_URL=https://your-backend/api
 *                 NEXT_PUBLIC_SUPPORT_PHONE=0300000000   (optional)
 *                 NEXT_PUBLIC_SEARCH_AREA="Accra, Ghana" (optional, used when geocoding addresses)
 *   app/layout.tsx: export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }
 *                   (needed so the safe-area padding works on notched phones)
 *
 * Backend contracts (NEW ones are optional and fail silently if missing):
 *   GET   PROFILE_PATH (/auth/me/)     -> { rider_id, name, email, phone, rating, completed_jobs, status, referral_code,
 *                                          vehicle_plate, photo_url, member_since?, acceptance_rate?, completion_rate?,
 *                                          // status in RESTRICTED_STATUSES blocks access; status in UNVERIFIED_STATUSES = still being reviewed
 *                                          services: [{ key, approved, active }] }
 *   PATCH PROFILE_PATH                 -> { online } | { active_services: [...] } | { name, phone, email }
 *   GET   /get-rider-wallet/?rider_id=     /rider-transactions/?rider_id=
 *   POST  /request-withdrawal/         -> { rider_id, amount, mobile_money_number, network }
 *   POST  /rider-deposit/              -> Mobile Money: { rider_id, amount, method: 'mobile_money', mobile_money_number, network }
 *                                         Card: { rider_id, amount, method: 'card', callback_url } -> must answer { authorization_url }
 *                                         (hosted checkout, so card numbers never touch this app)
 *   GET   /list-bookings/
 *   POST  /accept-booking/  /arrive-ride/  /start-ride/  /complete-ride/   -> { booking_id, rider_id }
 *   POST  /decline-booking/            -> { booking_id, rider_id, reason }   (also sent on timeout)
 *   POST  /update-rider-location/      -> { rider_id, latitude, longitude, is_online, booking_id? }
 *   GET   /rider-notifications/        -> { notifications: [{ id, type, title, message, created_at, is_read }] }
 *   GET   /rider-referrals/?rider_id=  -> { total, pending, earned }
 *   POST  /rider-service-request/      -> { rider_id, service }
 *
 * IMPORTANT: the wallet rule, verification check and service eligibility are enforced here for UX only.
 * accept-booking MUST enforce all of them on the server too.
 * Session: the token is read from sessionStorage first (legacy localStorage is still read so current logins keep working).
 */

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import 'leaflet/dist/leaflet.css';

const bodyFont = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });
const displayFont = Sora({ subsets: ['latin'], display: 'swap' });
const DISPLAY = displayFont.className;

// ─── CONFIG ───
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://rydnow-backend.onrender.com';
const AUTH_SCHEME = 'Token'; // use 'Bearer' if your backend uses JWT
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '';
const SEARCH_AREA = process.env.NEXT_PUBLIC_SEARCH_AREA || 'Accra, Ghana';
const PROFILE_PATH = '/auth/me/';
const DEFAULT_CENTER = { lat: 5.6037, lon: -0.187 }; // Accra
const LOGIN_PATH = '/login';
const RIDER_SIGNUP_PATH = '/rider-signup';
const CUSTOMER_SIGNUP_PATH = '/signup';
const PRIVACY_PATH = '/privacy';
const TERMS_PATH = '/terms';
const REQUEST_TIMEOUT_MS = 30_000; // generous: free-tier hosts can take a while to wake up

// ─── BUSINESS RULES — EDIT ANYTIME ───
const MIN_WALLET_BALANCE = 50; // ₵ that must stay in the wallet to accept jobs
const DEFAULT_COMMISSION = 0.15; // used only if the backend sends no commission_rate
const ALERT_SECONDS = 20;
const MAX_PICKUP_KM = 10;
const DEFAULT_DAILY_GOAL = 150;
const MAX_RATING = 6; // 6-star rating system
const RESTRICTED_STATUSES = ['restricted', 'suspended', 'banned', 'blocked', 'deactivated', 'disabled']; // set by admin
// Riders whose documents are still being checked. Remove entries here if your backend uses these words for approved riders.
const UNVERIFIED_STATUSES = ['pending', 'pending_review', 'under_review', 'unverified', 'incomplete', 'rejected'];
const LOCATION_STALE_MS = 60_000;
const GPS_IDLE_MS = 20_000; // location refresh while online
const GPS_TRIP_MS = 7_000; // location refresh during a trip
const RIDER_INVITE_REWARD = 20;
const CUSTOMER_INVITE_REWARD = 5;
const CUSTOMER_FRIEND_DISCOUNT = 10;

// ─── SERVICES ───
type ServiceKey = 'okada' | 'parcel' | 'waste-bin';
const ALL_SERVICE_KEYS: ServiceKey[] = ['okada', 'parcel', 'waste-bin'];
const SERVICE_META: Record<ServiceKey, { label: string; tagline: string; icon: string }> = {
  okada: { label: 'Okada Ride', tagline: 'Carry passengers', icon: '/okada-one.png' },
  parcel: { label: 'Delivery', tagline: 'Parcels, food, documents', icon: '/d.png' },
  'waste-bin': { label: 'Waste Collection', tagline: 'Pickup & disposal', icon: '/binman.png' },
};
const normalizeService = (raw: unknown): ServiceKey => {
  const k = String(raw || '').toLowerCase();
  if (k.includes('parcel') || k.includes('deliver')) return 'parcel';
  if (k.includes('waste')) return 'waste-bin';
  return 'okada';
};

// ─── TYPES ───
type LatLon = { lat: number; lon: number };
type DepositMethod = 'mobile_money' | 'card';
type TabType = 'home' | 'trips' | 'wallet' | 'alerts' | 'profile';
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
type ProfileState = 'loading' | 'ready' | 'unlinked' | 'unauth';
type ToastType = 'success' | 'error' | 'info';
type Network = 'MTN' | 'Telecel' | 'AirtelTigo' | '';
type Period = 'today' | 'week' | 'month' | 'all';
type NoteKind = 'job' | 'cancelled' | 'payment' | 'account' | 'system';

type Booking = {
  id: string | number;
  service_type: string;
  pickup: string;
  destination: string;
  pickup_lat?: number | string;
  pickup_lng?: number | string;
  destination_lat?: number | string;
  destination_lng?: number | string;
  status: string;
  total_amount?: number | string;
  price?: number | string;
  payment_method?: string;
  delivery_category?: string | null;
  parcel_details?: string;
  customer_name?: string;
  customer_phone?: string;
  created_at?: string;
  rider?: number | string | { id: number } | null;
};
type RiderService = { key: ServiceKey; approved: boolean; active: boolean };
type RiderProfile = {
  rider_id?: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  completed_jobs: number;
  status?: string;
  referral_code?: string;
  vehicle_plate?: string;
  photo_url?: string;
  member_since?: string;
  acceptance_rate?: number;
  completion_rate?: number;
  services: RiderService[];
};
type WalletData = { balance: number; total_earned: number; total_withdrawn: number; commission_rate: string };
type Transaction = {
  id: string;
  type: string;
  amount?: number;
  commission?: number;
  rider_amount?: number;
  status?: string;
  description?: string;
  created_at: string;
};
type Note = { id: string; kind: NoteKind; title: string; body: string; created_at: string; read: boolean; tab?: TabType };
type Prefs = { sound: boolean; vibration: boolean; jobAlerts: boolean };
type Summary = { service: string; pickup: string; destination: string; km?: number; min?: number; fare: number; earn: number };

const EMPTY_PROFILE: RiderProfile = {
  name: 'Rydnow Rider',
  email: '',
  phone: '',
  rating: 0,
  completed_jobs: 0,
  services: [],
};
const NO_NOTES: Note[] = [];
const LANGUAGES = ['English', 'Twi', 'Ga', 'Ewe', 'Hausa'];
const DEFAULT_COMMISSION_LABEL = `${Math.round(DEFAULT_COMMISSION * 100)}%`;

// ─── HELPERS ───
const money = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-critical */
  }
};

const toLatLon = (lat: unknown, lon: unknown): LatLon | null => {
  const a = Number(lat);
  const b = Number(lon);
  return lat !== undefined && lat !== null && lat !== '' && Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lon: b } : null;
};

const distanceKm = (a: LatLon, b: LatLon) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const TOKEN_KEYS = ['rydnow_token', 'authToken'];
const getToken = () => {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = sessionStorage.getItem(k) || localStorage.getItem(k);
    if (v) return v;
  }
  return '';
};
const clearSession = () => {
  TOKEN_KEYS.forEach(k => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
  localStorage.removeItem('rydn_rider');
  localStorage.removeItem('rydn_notes');
};

// Every request has a timeout so a dead connection never leaves a button spinning forever
const api = async (path: string, init: RequestInit = {}) => {
  const token = getToken();
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init.signal ?? ctrl.signal,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `${AUTH_SCHEME} ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

const riderOf = (j: Booking) => String(typeof j.rider === 'object' && j.rider ? (j.rider as any).id : j.rider ?? '');

const fareOf = (j: Booking) => Number(j.total_amount || j.price || 0) || 0;

const normalizeGhPhone = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('233')) return `0${d.slice(3)}`;
  if (d.length === 9) return `0${d}`;
  return d;
};
const isValidMomo = (raw: string) => /^0\d{9}$/.test(normalizeGhPhone(raw));
const detectNetwork = (raw: string): Network => {
  const p = normalizeGhPhone(raw).slice(0, 3);
  if (['024', '054', '055', '059', '053', '025'].includes(p)) return 'MTN';
  if (['020', '050'].includes(p)) return 'Telecel';
  if (['026', '056', '027', '057'].includes(p)) return 'AirtelTigo';
  return '';
};
const whatsappLink = (raw: string) => `https://wa.me/233${normalizeGhPhone(raw).slice(1)}`;
const googleNav = (t: LatLon | null, address: string) =>
  t
    ? `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lon}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${SEARCH_AREA}`)}&travelmode=driving`;
const wazeNav = (t: LatLon) => `https://waze.com/ul?ll=${t.lat},${t.lon}&navigate=yes`;

// Fallback only. Prefer the server-issued referral_code: this hash can collide and is guessable.
const makeReferralCode = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `RYD-${h.toString(36).toUpperCase().padStart(5, '0').slice(-5)}`;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const periodStart = (p: Period) => {
  if (p === 'today') return startOfToday();
  if (p === 'week') return Date.now() - 7 * 86400000;
  if (p === 'month') {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  return 0;
};
const PERIOD_LABEL: Record<Period, string> = { today: 'Today', week: 'This week', month: 'This month', all: 'All time' };
const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : '');
const timeAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return shortDate(iso);
};

// NOTE: public Nominatim / OSRM / OSM tiles are for light use only. Move to a paid provider before launch.
const geocode = async (address: string): Promise<LatLon | null> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${address}, ${SEARCH_AREA}`)}&limit=1&countrycodes=GH`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] ? toLatLon(data[0].lat, data[0].lon) : null;
  } catch {
    return null;
  }
};

const getRoute = async (from: LatLon, to: LatLon) => {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
    );
    if (!res.ok) return null;
    const r = (await res.json()).routes?.[0];
    if (!r) return null;
    return {
      km: Math.round((r.distance / 1000) * 10) / 10,
      min: Math.max(1, Math.round(r.duration / 60)),
      coords: (r.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]) as [number, number][],
    };
  } catch {
    return null;
  }
};

const mapRiderProfile = (d: any, prev: Partial<RiderProfile>): RiderProfile => {
  const services: RiderService[] = Array.isArray(d.services)
    ? d.services.map((s: any) =>
        typeof s === 'string'
          ? { key: normalizeService(s), approved: true, active: true }
          : {
              key: normalizeService(s.key ?? s.service ?? s.slug ?? s.name),
              approved: s.approved ?? s.is_approved ?? true,
              active: s.active ?? s.is_active ?? true,
            }
      )
    : prev.services || [];
  return {
    rider_id: String(d.rider_id ?? d.id ?? '') || undefined,
    name: d.name ?? d.full_name ?? prev.name ?? 'Rydnow Rider',
    email: d.email ?? prev.email ?? '',
    phone: d.phone ?? d.phone_number ?? prev.phone ?? '',
    rating: Number(d.rating ?? prev.rating ?? 0) || 0,
    completed_jobs: Number(d.completed_jobs ?? prev.completed_jobs ?? 0),
    status: d.status ?? d.verification_status ?? prev.status,
    referral_code: d.referral_code ?? d.rider_code ?? prev.referral_code,
    vehicle_plate: d.vehicle_plate ?? d.plate_number ?? prev.vehicle_plate,
    photo_url: d.photo_url ?? d.profile_photo ?? d.photo ?? prev.photo_url,
    member_since: d.member_since ?? d.created_at ?? prev.member_since,
    acceptance_rate: d.acceptance_rate != null ? Number(d.acceptance_rate) : prev.acceptance_rate,
    completion_rate: d.completion_rate != null ? Number(d.completion_rate) : prev.completion_rate,
    services,
  };
};

const normalizeWallet = (d: any): WalletData => ({
  balance: Number(d.balance ?? d.available_balance ?? 0) || 0,
  total_earned: Number(d.total_earned ?? 0) || 0,
  total_withdrawn: Number(d.total_withdrawn ?? 0) || 0,
  commission_rate: String(d.commission_rate ?? DEFAULT_COMMISSION_LABEL),
});

const CREDIT_TYPES = ['deposit', 'job_payment', 'referral_bonus', 'bonus', 'tip', 'refund'];
const TX_LABEL: Record<string, string> = {
  deposit: 'Wallet deposit',
  job_payment: 'Trip earnings',
  withdrawal: 'Withdrawal',
  commission: 'Service fee',
  referral_bonus: 'Referral bonus',
  bonus: 'Bonus',
  tip: 'Tip',
  refund: 'Refund',
};
const txAmount = (tx: Transaction) => Math.abs(Number(tx.rider_amount || tx.amount || 0));
const txIsCredit = (tx: Transaction) => CREDIT_TYPES.includes(tx.type);

const alertRider = (prefs: Prefs) => {
  if (prefs.vibration) {
    try {
      navigator.vibrate?.([220, 100, 220, 100, 220]);
    } catch {
      /* ignore */
    }
  }
  if (!prefs.sound) return;
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new C();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 300);
  } catch {
    /* browsers may block sound until the first tap */
  }
};

// ─── DESIGN TOKENS (Tailwind class strings) ───
const CARD = 'rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl';
const BTN_PRIMARY =
  'rounded-full bg-gradient-to-b from-[#4AA3FF] to-[#1F6BFF] font-bold text-[#04122E] shadow-[0_10px_30px_rgba(31,107,255,0.5)] transition active:scale-[0.98] disabled:opacity-50';
const BTN_GOLD =
  'rounded-full bg-gradient-to-b from-[#FFD25E] to-[#F5B82E] font-bold text-[#2A1B00] shadow-[0_10px_30px_rgba(245,184,46,0.35)] transition active:scale-[0.98] disabled:opacity-50';
const BTN_GHOST = 'rounded-full border border-white/15 bg-white/5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40';
const BTN_GREEN = 'rounded-full bg-emerald-500 font-bold text-white shadow-[0_10px_30px_rgba(16,185,129,0.45)] transition active:scale-[0.98] disabled:opacity-50';
const INPUT =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#4AA3FF]';
const LABEL = 'mb-1 block text-xs font-semibold text-white/60';
const CHIP_ON = 'border-[#4AA3FF] bg-[#1F6BFF]/25 text-white';
const CHIP_OFF = 'border-white/10 bg-white/5 text-white/70';

// ─── ICONS ───
const ICONS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  trips: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  wallet: ['M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 7l2-3h12v3', 'M16 13h2'],
  bell: ['M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7', 'M10 20a2 2 0 0 0 4 0'],
  user: ['M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  chat: ['M4 5h16v11H8l-4 4z'],
  navigate: ['M3 11l18-8-8 18-2-8z'],
  check: ['M5 12l5 5L20 7'],
  close: ['M6 6l12 12M18 6L6 18'],
  copy: ['M9 9h11v11H9z', 'M5 15V4h11'],
  share: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 14v7h14v-7'],
  plus: ['M12 5v14M5 12h14'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  locate: ['M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', 'M12 2v3M12 19v3M2 12h3M19 12h3'],
  lock: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  logout: ['M9 4H5v16h4', 'M16 8l4 4-4 4', 'M20 12H9'],
  refresh: ['M20 11a8 8 0 1 0-2 6', 'M20 5v6h-6'],
  chevron: ['M9 6l6 6-6 6'],
  back: ['M15 6l-6 6 6 6'],
  power: ['M12 3v9', 'M6.3 6.3a8 8 0 1 0 11.4 0'],
  gift: ['M20 12v9H4v-9', 'M2 7h20v5H2z', 'M12 7v14', 'M12 7c-2-4-6-3-5 0 .5 1.5 5 0 5 0z', 'M12 7c2-4 6-3 5 0-.5 1.5-5 0-5 0z'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  doc: ['M7 3h8l4 4v14H7z', 'M15 3v4h4'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
};

const Icon = ({ name, className = 'h-5 w-5', fill = false }: { name: string; className?: string; fill?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill={fill ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {(ICONS[name] || []).map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <span className={`inline-block ${className} animate-spin rounded-full border-2 border-white/20 border-t-[#4AA3FF]`} role="status" aria-label="Loading" />
);

const Stars = ({ value, size = 'h-4 w-4' }: { value: number; size?: string }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of ${MAX_RATING} stars`}>
    {Array.from({ length: MAX_RATING }, (_, i) => (
      <Icon key={i} name="star" fill className={`${size} ${i < Math.round(value) ? 'text-[#FFC83D]' : 'text-white/15'}`} />
    ))}
  </span>
);

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-[#2F80FF]' : 'bg-white/15'}`}
  >
    <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

const Sheet = ({
  title,
  onClose,
  children,
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  locked?: boolean;
}) => {
  // Escape closes the sheet, and the page behind it stops scrolling while it is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [locked, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#0A1530] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`${DISPLAY} text-lg font-bold tracking-tight`}>{title}</h3>
          <button
            onClick={onClose}
            disabled={locked}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 disabled:opacity-40"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── NEW-REQUEST POPUP (owns its own countdown so the rest of the dashboard doesn't re-render 4x a second) ───
const JobAlert = ({
  booking,
  expiresAt,
  walletReady,
  earn,
  onDecline,
  onAccept,
  onExpire,
}: {
  booking: Booking;
  expiresAt: number;
  walletReady: boolean;
  earn: number;
  onDecline: () => void;
  onAccept: () => void;
  onExpire: () => void;
}) => {
  const [now, setNow] = useState(Date.now());
  const expireRef = useRef(onExpire);
  const firedRef = useRef(false);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    firedRef.current = false;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= expiresAt && !firedRef.current) {
        firedRef.current = true;
        expireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const svcLabel = SERVICE_META[normalizeService(booking.service_type)].label;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-4 pt-[calc(1rem+env(safe-area-inset-top))]" role="alertdialog" aria-label="New request">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#4AA3FF]/50 bg-[#0A1530]/95 p-4 shadow-[0_20px_60px_rgba(31,107,255,0.55)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="#F5B82E"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={100 - (remaining / ALERT_SECONDS) * 100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-bold">{remaining}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-[#6DB7FF]">NEW {svcLabel.toUpperCase()} REQUEST</p>
            <p className="truncate text-sm font-bold">
              {booking.pickup}
              {booking.destination !== booking.pickup ? ` → ${booking.destination}` : ''}
            </p>
            <p className="text-sm font-bold text-[#FFC83D]">
              GH₵ {money(fareOf(booking))} <span className="text-xs font-semibold text-emerald-400">· earn ~GH₵ {money(earn)}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <button onClick={onDecline} className={`${BTN_GHOST} flex-1 py-3 text-sm`}>
            Decline
          </button>
          <button onClick={onAccept} className={`${walletReady ? BTN_GREEN : BTN_GOLD} flex-[2] py-3 text-sm`}>
            {walletReady ? 'Accept' : 'Deposit to accept'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── LIVE MAP (Leaflet + OpenStreetMap, restyled dark with Tailwind arbitrary variants) ───
type LiveMapProps = {
  rider?: LatLon | null;
  pickup?: LatLon | null;
  destination?: LatLon | null;
  routeCoords?: [number, number][];
  height?: number;
  follow?: boolean;
};

const MAP_DARK =
  '[&_.leaflet-tile-pane]:[filter:invert(1)_hue-rotate(195deg)_brightness(0.8)_saturate(0.65)] [&_.leaflet-control-attribution]:!bg-black/40 [&_.leaflet-control-attribution]:!text-[9px] [&_.leaflet-control-attribution]:!text-white/50 [&_.leaflet-control-attribution_a]:!text-white/60';

const LiveMap = ({ rider, pickup, destination, routeCoords, height = 220, follow = false }: LiveMapProps) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layersRef = useRef<any>({});
  const ptsRef = useRef<LatLon[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const start = rider || pickup || DEFAULT_CENTER;
      const map = L.map(elRef.current, { zoomControl: false }).setView([start.lat, start.lon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 150);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      layersRef.current = {};
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const layers = layersRef.current;
    const mk = (html: string, size: number) => L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    const riderIcon = mk(
      '<div class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4AA3FF] bg-[#0A1530] text-xl shadow-[0_0_22px_rgba(74,163,255,0.9)]">🛵</div>',
      40
    );
    const pickupIcon = mk('<div class="h-4 w-4 rounded-full border-[3px] border-white bg-[#2F80FF] shadow-[0_0_14px_#2F80FF]"></div>', 16);
    const destIcon = mk('<div class="h-4 w-4 rounded-[3px] border-[3px] border-white bg-[#FFC83D] shadow-[0_0_14px_#FFC83D]"></div>', 16);
    const set = (key: string, pos: LatLon | null | undefined, icon: unknown, z: number) => {
      const cur = layers[key];
      if (!pos) {
        if (cur) {
          cur.remove();
          layers[key] = undefined;
        }
        return;
      }
      if (cur) cur.setLatLng([pos.lat, pos.lon]);
      else layers[key] = L.marker([pos.lat, pos.lon], { icon, zIndexOffset: z, interactive: false }).addTo(map);
    };
    set('rider', rider, riderIcon, 500);
    set('pickup', pickup, pickupIcon, 200);
    set('dest', destination, destIcon, 200);
    if (layers.route) {
      layers.route.remove();
      layers.route = undefined;
    }
    if (routeCoords && routeCoords.length > 1) {
      layers.route = L.layerGroup([
        L.polyline(routeCoords, { color: '#2F80FF', weight: 13, opacity: 0.22 }),
        L.polyline(routeCoords, { color: '#5CB0FF', weight: 5, opacity: 0.95 }),
      ]).addTo(map);
    }
    ptsRef.current = [rider, pickup, destination].filter(Boolean) as LatLon[];
  }, [ready, rider, pickup, destination, routeCoords]);

  const fit = useCallback((animate = true) => {
    const map = mapRef.current;
    const pts = ptsRef.current;
    if (!map || !pts.length) return;
    if (pts.length > 1) map.fitBounds(pts.map(p => [p.lat, p.lon]), { padding: [45, 45], animate, maxZoom: 16 });
    else map.setView([pts[0].lat, pts[0].lon], 15, { animate });
  }, []);

  useEffect(() => {
    if (ready) fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickup?.lat, pickup?.lon, destination?.lat, destination?.lon, !!rider]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map && follow && rider && !pickup && !destination) map.setView([rider.lat, rider.lon], map.getZoom(), { animate: true });
  }, [ready, follow, rider?.lat, rider?.lon, pickup, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <div ref={elRef} style={{ height }} className={`isolate w-full bg-[#0A1530] ${MAP_DARK}`} aria-label="Live map" />
      <div className="pointer-events-none absolute inset-0 z-[400] bg-gradient-to-t from-[#050B1A]/70 via-transparent to-[#050B1A]/30" />
      <button
        onClick={() => fit(true)}
        aria-label="Recenter map"
        className="absolute bottom-3 right-3 z-[500] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#0A1530]/90 text-[#4AA3FF] shadow-lg"
      >
        <Icon name="locate" />
      </button>
    </div>
  );
};

// ─── MAIN COMPONENT ───
export default function RiderDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [profile, setProfile] = useState<RiderProfile>(EMPTY_PROFILE);
  const [profileState, setProfileState] = useState<ProfileState>('loading');
  const [isOnline, setIsOnline] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<LatLon | null>(null);
  const [locStale, setLocStale] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Jobs
  const [availableJobs, setAvailableJobs] = useState<Booking[]>([]);
  const [activeJob, setActiveJob] = useState<Booking | null>(null);
  const [history, setHistory] = useState<Booking[]>([]);
  const [alertJob, setAlertJob] = useState<{ booking: Booking; expiresAt: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [jobGeo, setJobGeo] = useState<{ id: string; pickup: LatLon | null; dest: LatLon | null } | null>(null);
  const [tripRoute, setTripRoute] = useState<{ km: number; min: number; coords: [number, number][] } | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Wallet
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, total_earned: 0, total_withdrawn: 0, commission_rate: DEFAULT_COMMISSION_LABEL });
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [walletFailed, setWalletFailed] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txFilter, setTxFilter] = useState<'all' | 'today' | 'week'>('all');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetBusy, setSheetBusy] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [networkInput, setNetworkInput] = useState<Network>('');
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('mobile_money');
  const [depositWaitingUntil, setDepositWaitingUntil] = useState(0);
  const depositStartBalance = useRef(0);

  // Trips filters
  const [tripPeriod, setTripPeriod] = useState<Period>('all');
  const [tripService, setTripService] = useState<'all' | ServiceKey>('all');
  const [tripQuery, setTripQuery] = useState('');

  // Notifications, prefs, misc UI
  const [notes, setNotes] = useState<Note[]>(NO_NOTES);
  const [prefs, setPrefs] = useState<Prefs>({ sound: true, vibration: true, jobAlerts: true });
  const [language, setLanguage] = useState('English');
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_DAILY_GOAL);
  const [requestedServices, setRequestedServices] = useState<ServiceKey[]>([]);
  const [referralStats, setReferralStats] = useState({ total: 0, pending: 0, earned: 0 });
  const [inviteAudience, setInviteAudience] = useState<'riders' | 'customers'>('riders');
  const [showGoal, setShowGoal] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showLocPrompt, setShowLocPrompt] = useState(false);
  const [pendingOnline, setPendingOnline] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' });

  // Refs holding latest values for timers/watchers
  const profileRef = useRef(profile);
  const onlineRef = useRef(isOnline);
  const activeJobRef = useRef<Booking | null>(null);
  const locRef = useRef<LatLon | null>(null);
  const prefsRef = useRef(prefs);
  const activeKeysRef = useRef<ServiceKey[]>(ALL_SERVICE_KEYS);
  const declinedRef = useRef<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const resumedRef = useRef(false);
  const lastSentRef = useRef(0);
  const lastFixRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    onlineRef.current = isOnline;
  }, [isOnline]);
  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);
  useEffect(() => {
    locRef.current = currentLocation;
  }, [currentLocation]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Load local preferences once
  useEffect(() => {
    setNotes(readJSON<Note[]>('rydn_notes', []));
    setPrefs(readJSON<Prefs>('rydn_prefs', { sound: true, vibration: true, jobAlerts: true }));
    setLanguage(readJSON<string>('rydn_lang', 'English'));
    setDailyGoal(readJSON<number>('rydn_daily_goal', DEFAULT_DAILY_GOAL));
  }, []);
  useEffect(() => {
    if (notes !== NO_NOTES) writeJSON('rydn_notes', notes);
  }, [notes]);

  const persistOnline = (online: boolean) => writeJSON('rydn_rider', { ...readJSON<Record<string, unknown>>('rydn_rider', {}), online });

  // ─── DERIVED ───
  const statusKey = (profile.status || '').toLowerCase();
  const restricted = !!statusKey && RESTRICTED_STATUSES.includes(statusKey);
  const unverified = !!statusKey && UNVERIFIED_STATUSES.includes(statusKey);
  const blocked = restricted || unverified; // blocked riders can't go online or accept jobs
  const walletReady = wallet.balance >= MIN_WALLET_BALANCE;
  const shortfall = Math.max(MIN_WALLET_BALANCE - wallet.balance, 0);
  const withdrawable = Math.max(wallet.balance - MIN_WALLET_BALANCE, 0);
  const commissionRate = useMemo(() => {
    const n = parseFloat(wallet.commission_rate);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_COMMISSION;
    return n <= 1 ? n : n / 100; // accepts "0.15" and "15%"
  }, [wallet.commission_rate]);
  const earnOf = useCallback((j: Booking) => fareOf(j) * (1 - commissionRate), [commissionRate]);

  const services: RiderService[] = useMemo(
    () => (profile.services.length ? profile.services : ALL_SERVICE_KEYS.map(k => ({ key: k, approved: true, active: true }))),
    [profile.services]
  );
  const approvedServices = useMemo(() => services.filter(s => s.approved), [services]);
  const activeKeys = useMemo(() => services.filter(s => s.approved && s.active).map(s => s.key), [services]);
  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  const periodStats = useMemo(() => {
    const calc = (p: Period) => {
      const from = periodStart(p);
      const jobs = transactions.filter(tx => tx.type === 'job_payment' && new Date(tx.created_at).getTime() >= from);
      return { earned: jobs.reduce((s, tx) => s + txAmount(tx), 0), trips: jobs.length, fees: jobs.reduce((s, tx) => s + Number(tx.commission || 0), 0) };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month'), all: calc('all') };
  }, [transactions]);
  const todayStats = periodStats.today;
  const goalPct = Math.min(100, Math.round((todayStats.earned / Math.max(dailyGoal, 1)) * 100));

  const unread = notes.filter(n => !n.read).length;
  const myReferralCode = profile.referral_code || makeReferralCode(`rider-${profile.rider_id ?? profile.email ?? 'guest'}`);

  // ─── TOAST + NOTIFICATIONS ───
  const notify = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const pushNote = useCallback((kind: NoteKind, title: string, body: string, tab?: TabType) => {
    const n: Note = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, title, body, created_at: new Date().toISOString(), read: false, tab };
    setNotes(prev => [n, ...prev].slice(0, 50));
  }, []);

  // ─── API WRAPPER (auto-logout on 401) ───
  const handleUnauth = useCallback(() => {
    clearSession();
    setIsOnline(false);
    setProfileState('unauth');
  }, []);
  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await api(path, init);
      if (res.status === 401) handleUnauth();
      return res;
    },
    [handleUnauth]
  );

  useEffect(() => {
    if (profileState === 'unauth') router.replace(LOGIN_PATH);
  }, [profileState, router]);

  // ─── PROFILE ───
  const loadProfile = useCallback(async () => {
    const cached = readJSON<Partial<RiderProfile> & { online?: boolean }>('rydn_rider', {});
    if (!getToken()) {
      setProfileState('unauth');
      return;
    }
    try {
      const res = await call(PROFILE_PATH);
      if (res.ok) {
        const mapped = mapRiderProfile(await res.json(), cached);
        if (!mapped.rider_id) {
          setProfileState('unlinked');
          return;
        }
        setProfile(mapped);
        writeJSON('rydn_rider', { ...mapped, online: cached.online });
        setProfileState('ready');
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setProfileState('unauth');
        return;
      }
    } catch {
      /* offline: fall back to the cached profile */
    }
    if (cached.rider_id) {
      setProfile({ ...EMPTY_PROFILE, ...cached, services: cached.services || [] });
      setProfileState('ready');
    } else setProfileState('unlinked');
  }, [call]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Re-check profile (approval, restrictions) whenever the app returns to the foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadProfile();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadProfile]);

  const patchProfile = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        return await call(PROFILE_PATH, { method: 'PATCH', body: JSON.stringify(body) });
      } catch {
        return null;
      }
    },
    [call]
  );

  // ─── LOCATION ───
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      setError('This device does not support location services.');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      pos => {
        lastFixRef.current = Date.now();
        setCurrentLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus('granted');
        setError('');
      },
      err => {
        setLocationStatus(err.code === 1 ? 'denied' : 'error');
        setError(err.code === 1 ? 'Location is blocked. Allow it in your phone or browser settings to receive jobs.' : 'We couldn’t get your location. Check GPS and try again.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(s => {
        if (s.state === 'granted') requestLocation();
      })
      .catch(() => {});
  }, [requestLocation]);

  const sendLocation = useCallback(
    async (loc: LatLon) => {
      const id = profileRef.current.rider_id;
      if (!id) return;
      try {
        await call('/update-rider-location/', {
          method: 'POST',
          body: JSON.stringify({ rider_id: id, latitude: loc.lat, longitude: loc.lon, is_online: onlineRef.current, booking_id: activeJobRef.current?.id ?? null }),
        });
      } catch {
        /* best effort */
      }
    },
    [call]
  );

  // Live GPS: every ~20 s while online, every ~7 s during a trip
  useEffect(() => {
    if (locationStatus !== 'granted' || typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (!isOnline && !activeJob) return;
    const id = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const t = Date.now();
        lastFixRef.current = t;
        setLocStale(false);
        setCurrentLocation(loc);
        const gap = activeJobRef.current ? GPS_TRIP_MS : GPS_IDLE_MS;
        if (t - lastSentRef.current >= gap) {
          lastSentRef.current = t;
          sendLocation(loc);
        }
      },
      err => {
        if (err.code === 1) setLocationStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [locationStatus, isOnline, !!activeJob, sendLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn when location updates stop
  useEffect(() => {
    if (!isOnline && !activeJob) {
      setLocStale(false);
      return;
    }
    lastFixRef.current = lastFixRef.current || Date.now();
    const id = setInterval(() => setLocStale(Date.now() - lastFixRef.current > LOCATION_STALE_MS), 10000);
    return () => clearInterval(id);
  }, [isOnline, !!activeJob]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── WALLET / DATA ───
  const fetchWallet = useCallback(async () => {
    const id = profileRef.current.rider_id;
    if (!id) return;
    try {
      const res = await call(`/get-rider-wallet/?rider_id=${id}`);
      if (res.ok) {
        setWallet(normalizeWallet(await res.json()));
        setWalletLoaded(true);
        setWalletFailed(false);
      } else setWalletFailed(true);
    } catch {
      setWalletFailed(true); // keep the last known balance on screen
    }
  }, [call]);

  const fetchTransactions = useCallback(async () => {
    const id = profileRef.current.rider_id;
    if (!id) return;
    try {
      const res = await call(`/rider-transactions/?rider_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || data.results || []);
      }
    } catch {
      /* keep last known */
    }
  }, [call]);

  const fetchReferrals = useCallback(async () => {
    const id = profileRef.current.rider_id;
    if (!id) return;
    try {
      const res = await call(`/rider-referrals/?rider_id=${id}`);
      if (res.ok) {
        const d = await res.json();
        setReferralStats({ total: Number(d.total || 0), pending: Number(d.pending || 0), earned: Number(d.earned || 0) });
      }
    } catch {
      /* endpoint optional */
    }
  }, [call]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await call('/rider-notifications/');
      if (!res.ok) return;
      const data = await res.json();
      const incoming: Note[] = (data.notifications || data.results || []).map((n: any) => ({
        id: `srv-${n.id}`,
        kind: (['job', 'cancelled', 'payment', 'account', 'system'].includes(n.type) ? n.type : 'system') as NoteKind,
        title: n.title || 'Rydnow',
        body: n.message || n.body || '',
        created_at: n.created_at || new Date().toISOString(),
        read: !!(n.is_read ?? n.read),
        tab: n.type === 'payment' ? 'wallet' : n.type === 'account' ? 'profile' : undefined,
      }));
      if (!incoming.length) return;
      setNotes(prev => {
        const known = new Set(prev.map(p => p.id));
        const fresh = incoming.filter(n => !known.has(n.id));
        return fresh.length ? [...fresh, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50) : prev;
      });
    } catch {
      /* endpoint optional */
    }
  }, [call]);

  useEffect(() => {
    if (profileState !== 'ready') return;
    fetchWallet();
    fetchTransactions();
    fetchReferrals();
    fetchNotifications();
  }, [profileState, fetchWallet, fetchTransactions, fetchReferrals, fetchNotifications]);

  useEffect(() => {
    if (activeTab === 'wallet' || activeTab === 'home') {
      fetchWallet();
      fetchTransactions();
    }
    if (activeTab === 'alerts') fetchNotifications();
  }, [activeTab, fetchWallet, fetchTransactions, fetchNotifications]);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(fetchWallet, 30000);
    return () => clearInterval(id);
  }, [isOnline, fetchWallet]);

  // After a deposit request, poll until the balance rises (rider approves the MoMo prompt)
  useEffect(() => {
    if (!depositWaitingUntil) return;
    const id = setInterval(() => {
      if (Date.now() > depositWaitingUntil) setDepositWaitingUntil(0);
      else fetchWallet();
    }, 4000);
    return () => clearInterval(id);
  }, [depositWaitingUntil, fetchWallet]);

  useEffect(() => {
    if (depositWaitingUntil && wallet.balance > depositStartBalance.current) {
      setDepositWaitingUntil(0);
      notify(`Deposit received. Wallet: GH₵ ${money(wallet.balance)}`, 'success', 5000);
      pushNote('payment', 'Deposit received', `Your wallet now holds GH₵ ${money(wallet.balance)}.`, 'wallet');
      fetchTransactions();
    }
  }, [wallet.balance, depositWaitingUntil, notify, pushNote, fetchTransactions]);

  // Returning from the hosted card payment page (?reference=… / ?trxref=…): confirm the deposit
  const cardReturnRef = useRef(false);
  useEffect(() => {
    if (profileState !== 'ready' || cardReturnRef.current) return;
    const q = new URLSearchParams(window.location.search);
    if (!q.get('reference') && !q.get('trxref')) return;
    cardReturnRef.current = true;
    let start = 0;
    try {
      start = Number(sessionStorage.getItem('rydn_dep_start')) || 0;
      sessionStorage.removeItem('rydn_dep_start');
    } catch {
      /* ignore */
    }
    depositStartBalance.current = start;
    setDepositWaitingUntil(Date.now() + 120000);
    setActiveTab('wallet');
    notify('Confirming your card payment…', 'info', 4000);
    window.history.replaceState({}, '', window.location.pathname);
  }, [profileState, notify]);

  // Resume the "online" choice after a reload, but only once we know the rider is still allowed to work
  useEffect(() => {
    if (resumedRef.current || profileState !== 'ready' || locationStatus !== 'granted' || !walletLoaded) return;
    resumedRef.current = true;
    if (!readJSON<{ online?: boolean }>('rydn_rider', {}).online) return;
    if (blocked || !walletReady || activeKeys.length === 0) {
      persistOnline(false);
      return;
    }
    firstLoadRef.current = true;
    onlineRef.current = true;
    setIsOnline(true);
  }, [profileState, locationStatus, walletLoaded, blocked, walletReady, activeKeys.length]);

  // ─── JOBS ───
  const fetchBookings = useCallback(async () => {
    const p = profileRef.current;
    if (!p.rider_id) return;
    try {
      const res = await call('/list-bookings/');
      if (!res.ok) return;
      const data = await res.json();
      const list: Booking[] = data.bookings || data.results || (Array.isArray(data) ? data : []);

      const mine = list.find(j => riderOf(j) === p.rider_id && ['assigned', 'arrived', 'in_progress'].includes(j.status));
      const prev = activeJobRef.current;
      if (prev && !mine) {
        const upd = list.find(j => String(j.id) === String(prev.id));
        if (upd?.status === 'cancelled') {
          pushNote('cancelled', 'Trip cancelled', `The customer cancelled the trip from ${prev.pickup}.`, 'home');
          notify('The customer cancelled this trip.', 'error', 5000);
        }
      }
      setActiveJob(mine || null);
      setHistory(
        list
          .filter(j => riderOf(j) === p.rider_id && ['completed', 'cancelled'].includes(j.status))
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      );

      if (!onlineRef.current || mine) {
        setAvailableJobs([]);
        return;
      }

      const loc = locRef.current;
      const eligible = list
        .filter(j => j.status === 'searching_rider')
        .filter(j => activeKeysRef.current.includes(normalizeService(j.service_type)))
        .filter(j => !declinedRef.current.has(String(j.id)))
        .filter(j => {
          const pu = toLatLon(j.pickup_lat, j.pickup_lng);
          return !loc || !pu || distanceKm(loc, pu) <= MAX_PICKUP_KM;
        })
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const fresh = eligible.filter(j => !seenRef.current.has(String(j.id)));
      eligible.forEach(j => seenRef.current.add(String(j.id)));
      if (!firstLoadRef.current && fresh.length) {
        const j = fresh[0];
        pushNote('job', 'New request', `${SERVICE_META[normalizeService(j.service_type)].label} · ${j.pickup} · GH₵ ${money(fareOf(j))}`, 'home');
        if (prefsRef.current.jobAlerts) {
          setAlertJob({ booking: j, expiresAt: Date.now() + ALERT_SECONDS * 1000 });
          alertRider(prefsRef.current);
        }
      }
      firstLoadRef.current = false;
      setAvailableJobs(eligible);
      // Drop the popup if the request was taken or cancelled in the meantime
      setAlertJob(a => (a && eligible.some(j => String(j.id) === String(a.booking.id)) ? a : null));
    } catch {
      /* retry on the next tick */
    }
  }, [call, notify, pushNote]);

  useEffect(() => {
    if (profileState !== 'ready') return;
    fetchBookings(); // also resumes a trip in progress after a reload
    if (!isOnline && !activeJob) return;
    const id = setInterval(fetchBookings, 5000);
    return () => clearInterval(id);
  }, [profileState, isOnline, !!activeJob, fetchBookings]); // eslint-disable-line react-hooks/exhaustive-deps

  const declineJob = useCallback(
    (id: string | number, auto = false) => {
      declinedRef.current.add(String(id));
      setAvailableJobs(prev => prev.filter(j => String(j.id) !== String(id)));
      setAlertJob(a => (a && String(a.booking.id) === String(id) ? null : a));
      call('/decline-booking/', {
        method: 'POST',
        body: JSON.stringify({ booking_id: id, rider_id: profileRef.current.rider_id, reason: auto ? 'timeout' : 'declined' }),
      }).catch(() => {});
    },
    [call]
  );

  // Coordinates for the active trip (booking coordinates, otherwise geocode the addresses once)
  useEffect(() => {
    if (!activeJob) {
      setJobGeo(null);
      setTripRoute(null);
      return;
    }
    const id = String(activeJob.id);
    let cancelled = false;
    const p = toLatLon(activeJob.pickup_lat, activeJob.pickup_lng);
    const d = toLatLon(activeJob.destination_lat, activeJob.destination_lng);
    if (p) {
      setJobGeo({ id, pickup: p, dest: d || p });
      return;
    }
    (async () => {
      const pr = await geocode(activeJob.pickup);
      const dr = activeJob.destination === activeJob.pickup ? pr : await geocode(activeJob.destination);
      if (!cancelled) setJobGeo({ id, pickup: pr, dest: dr || pr });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh the ETA every 30 s during a trip
  useEffect(() => {
    if (!activeJob) return;
    const id = setInterval(() => setRouteTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [!!activeJob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeJob || !jobGeo) return;
    const inProgress = activeJob.status === 'in_progress';
    const from = inProgress ? jobGeo.pickup : locRef.current || jobGeo.pickup;
    const to = inProgress ? jobGeo.dest : jobGeo.pickup;
    if (!from || !to) return;
    let cancelled = false;
    getRoute(from, to).then(r => {
      if (!cancelled) setTripRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [jobGeo, activeJob?.status, !!currentLocation, routeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── ACTIONS ───
  const blockers = useMemo(() => {
    const b: string[] = [];
    if (restricted) b.push('Your account has been restricted by Rydnow. Contact support to get back online.');
    else if (unverified) b.push('Your account is still being verified. We’ll notify you as soon as you’re approved.');
    if (!walletLoaded) b.push(walletFailed ? 'We couldn’t check your wallet. Tap Retry on the home screen.' : 'Checking your wallet… try again in a moment.');
    else if (!walletReady) b.push(`Deposit GH₵ ${money(shortfall)} to unlock jobs.`);
    if (activeKeys.length === 0) b.push('Switch on at least one service you want to work on.');
    return b;
  }, [restricted, unverified, walletLoaded, walletFailed, walletReady, shortfall, activeKeys.length]);

  const toggleOnline = useCallback(() => {
    setError('');
    if (!isOnline) {
      if (blockers.length) {
        setError(blockers[0]);
        return;
      }
      if (locationStatus === 'denied') {
        setError('Location is required to receive ride requests. Allow it in your settings, then try again.');
        return;
      }
      if (locationStatus !== 'granted') {
        setShowLocPrompt(true);
        return;
      }
      firstLoadRef.current = true;
      seenRef.current = new Set();
      lastFixRef.current = Date.now();
      onlineRef.current = true; // set before sending so the first location update says is_online: true
      if (locRef.current) sendLocation(locRef.current);
      setIsOnline(true);
      persistOnline(true);
      patchProfile({ online: true });
    } else {
      if (activeJob) {
        setError('Finish your current trip before going offline.');
        return;
      }
      onlineRef.current = false;
      setIsOnline(false);
      setAvailableJobs([]);
      setAlertJob(null);
      persistOnline(false);
      patchProfile({ online: false });
      if (locRef.current) {
        call('/update-rider-location/', {
          method: 'POST',
          body: JSON.stringify({ rider_id: profileRef.current.rider_id, latitude: locRef.current.lat, longitude: locRef.current.lon, is_online: false }),
        }).catch(() => {});
      }
    }
  }, [isOnline, blockers, locationStatus, activeJob, patchProfile, sendLocation, call]);

  // After the rider allows location from the prompt, continue going online automatically
  useEffect(() => {
    if (!pendingOnline) return;
    if (locationStatus === 'granted') {
      setPendingOnline(false);
      toggleOnline();
    } else if (locationStatus === 'denied' || locationStatus === 'error') setPendingOnline(false);
  }, [pendingOnline, locationStatus, toggleOnline]);

  // If an admin restricts the rider while they are online, take them offline (a trip in progress is left to finish)
  useEffect(() => {
    if (blocked && isOnline && !activeJob) {
      onlineRef.current = false;
      setIsOnline(false);
      setAvailableJobs([]);
      setAlertJob(null);
      persistOnline(false);
    }
  }, [blocked, isOnline, activeJob]);

  const openDeposit = (reason = '') => {
    setSheetError(reason);
    setDepositMethod('mobile_money');
    setAmountInput(String(Math.max(Math.ceil(shortfall), 10) || 50));
    setPhoneInput(profile.phone || '');
    setNetworkInput(detectNetwork(profile.phone || ''));
    setShowDeposit(true);
  };
  const openWithdraw = () => {
    setSheetError('');
    setAmountInput('');
    setPhoneInput(profile.phone || '');
    setNetworkInput(detectNetwork(profile.phone || ''));
    setShowWithdraw(true);
  };

  const acceptJob = async (booking: Booking) => {
    setError('');
    if (blocked) return setError(restricted ? 'Your account has been restricted by Rydnow. Contact support.' : 'Your account is still being verified.');
    if (!isOnline || locationStatus !== 'granted') return setError('Go online with location enabled to accept jobs.');
    if (!walletReady) {
      setAlertJob(null);
      return openDeposit(`Add GH₵ ${money(shortfall)} to your wallet to start accepting jobs.`);
    }
    setBusyId(String(booking.id));
    try {
      const res = await call('/accept-booking/', { method: 'POST', body: JSON.stringify({ booking_id: booking.id, rider_id: profile.rider_id }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActiveJob(data.booking || { ...booking, status: 'assigned', rider: profile.rider_id });
        setAvailableJobs(prev => prev.filter(j => String(j.id) !== String(booking.id)));
        setAlertJob(null);
        setActiveTab('home');
        notify('Job accepted. Head to the pickup point.', 'success');
      } else if (res.status === 409) {
        setAvailableJobs(prev => prev.filter(j => String(j.id) !== String(booking.id)));
        setAlertJob(null);
        notify('Another rider took this job.', 'info');
      } else if (/wallet|deposit|balance/i.test(String(data.detail || data.message || ''))) {
        fetchWallet();
        setAlertJob(null);
        openDeposit(String(data.detail || data.message));
      } else setError(String(data.detail || data.message || 'Could not accept this job. Try again.'));
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  const tripAction = async (path: string, nextStatus: string, failMsg: string) => {
    if (!activeJob) return;
    setBusyId(String(activeJob.id));
    try {
      const res = await call(path, { method: 'POST', body: JSON.stringify({ booking_id: activeJob.id, rider_id: profile.rider_id }) });
      if (res.ok) {
        if (nextStatus === 'completed') {
          const earn = earnOf(activeJob);
          setSummary({
            service: SERVICE_META[normalizeService(activeJob.service_type)].label,
            pickup: activeJob.pickup,
            destination: activeJob.destination,
            km: tripRoute?.km,
            min: tripRoute?.min,
            fare: fareOf(activeJob),
            earn,
          });
          pushNote('payment', 'Trip completed', `About GH₵ ${money(earn)} was added to your wallet.`, 'wallet');
          setProfile(p => ({ ...p, completed_jobs: p.completed_jobs + 1 }));
          setActiveJob(null);
          fetchWallet();
          fetchTransactions();
          fetchBookings();
        } else setActiveJob(prev => (prev ? { ...prev, status: nextStatus } : prev));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(String(d.detail || d.message || failMsg));
      }
    } catch {
      setError(failMsg);
    } finally {
      setBusyId(null);
    }
  };

  const toggleService = (key: ServiceKey) => {
    if (activeJob) return notify('Complete your current trip first.', 'error');
    const next = services.map(s => (s.key === key ? { ...s, active: !s.active } : s));
    const nextActive = next.filter(s => s.approved && s.active);
    if (nextActive.length === 0) return notify('Keep at least one service on.', 'error');
    setProfile(p => ({ ...p, services: next }));
    writeJSON('rydn_rider', { ...readJSON<Record<string, unknown>>('rydn_rider', {}), services: next });
    patchProfile({ active_services: nextActive.map(s => s.key) });
  };

  const requestService = async (key: ServiceKey) => {
    try {
      const res = await call('/rider-service-request/', { method: 'POST', body: JSON.stringify({ rider_id: profile.rider_id, service: key }) });
      if (res.ok) {
        setRequestedServices(prev => [...prev, key]);
        notify(`Request sent for ${SERVICE_META[key].label}. We’ll review it soon.`, 'success');
      } else notify('Could not send your request. Try again.', 'error');
    } catch {
      notify('Network error. Try again.', 'error');
    }
  };

  const submitMoney = async (kind: 'deposit' | 'withdraw') => {
    const amount = round2(parseFloat(amountInput));
    const viaCard = kind === 'deposit' && depositMethod === 'card';
    if (kind === 'deposit') {
      const min = walletReady ? 10 : Math.max(shortfall, 1);
      if (!amount || amount < min) return setSheetError(`The minimum deposit is GH₵ ${money(min)}.`);
    } else {
      if (!amount || amount <= 0) return setSheetError('Enter the amount you want to withdraw.');
      if (amount > withdrawable)
        return setSheetError(`You can withdraw up to GH₵ ${money(withdrawable)}. GH₵ ${MIN_WALLET_BALANCE} stays in your wallet so you can keep accepting jobs.`);
    }
    if (!viaCard) {
      if (!isValidMomo(phoneInput)) return setSheetError('Enter a valid 10-digit Mobile Money number, e.g. 054 123 4567.');
      if (!networkInput) return setSheetError('Choose your Mobile Money network.');
    }
    setSheetBusy(true);
    setSheetError('');
    try {
      const payload = viaCard
        ? { rider_id: profile.rider_id, amount, method: 'card', callback_url: `${window.location.origin}${window.location.pathname}` }
        : {
            rider_id: profile.rider_id,
            amount,
            ...(kind === 'deposit' ? { method: 'mobile_money' } : {}),
            mobile_money_number: normalizeGhPhone(phoneInput),
            network: networkInput,
          };
      const res = await call(kind === 'deposit' ? '/rider-deposit/' : '/request-withdrawal/', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setSheetError(String(data.detail || data.message || 'Something went wrong. Try again.'));
      if (viaCard) {
        const url = data.authorization_url || data.payment_url || data.checkout_url || data.redirect_url;
        if (!url) return setSheetError('We couldn’t open the secure payment page. Try again.');
        try {
          sessionStorage.setItem('rydn_dep_start', String(wallet.balance));
        } catch {
          /* ignore */
        }
        window.location.assign(String(url));
        return;
      }
      if (kind === 'deposit') {
        depositStartBalance.current = wallet.balance;
        setDepositWaitingUntil(Date.now() + 120000);
        setShowDeposit(false);
        notify('Check your phone and approve the Mobile Money prompt.', 'info', 6000);
      } else {
        setShowWithdraw(false);
        notify(`Withdrawal of GH₵ ${money(amount)} requested. Status: pending.`, 'success', 5000);
        pushNote('payment', 'Withdrawal requested', `GH₵ ${money(amount)} to ${normalizeGhPhone(phoneInput)} is pending.`, 'wallet');
        fetchWallet();
        fetchTransactions();
      }
    } catch {
      setSheetError('Network error. Check your connection and try again.');
    } finally {
      setSheetBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!editForm.name.trim()) return setSheetError('Enter your full name.');
    if (editForm.phone && !isValidMomo(editForm.phone)) return setSheetError('Enter a valid 10-digit phone number.');
    setSheetBusy(true);
    setSheetError('');
    const res = await patchProfile({ name: editForm.name.trim(), phone: editForm.phone ? normalizeGhPhone(editForm.phone) : '', email: editForm.email.trim() });
    setSheetBusy(false);
    if (res && res.ok) {
      const next = { ...profile, name: editForm.name.trim(), phone: editForm.phone ? normalizeGhPhone(editForm.phone) : '', email: editForm.email.trim() };
      setProfile(next);
      writeJSON('rydn_rider', { ...readJSON<Record<string, unknown>>('rydn_rider', {}), ...next });
      setShowEdit(false);
      notify('Profile updated.', 'success');
    } else setSheetError('We couldn’t save your changes. Try again.');
  };

  const updatePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeJSON('rydn_prefs', next);
  };

  const shareText = async (title: string, text: string, okMsg: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        /* closed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify(okMsg, 'success');
    } catch {
      notify('Sharing isn’t available on this device.', 'error');
    }
  };

  const shareReceipt = (j: Booking) =>
    shareText(
      'Rydnow receipt',
      [
        `RYDNOW receipt #${j.id}`,
        SERVICE_META[normalizeService(j.service_type)].label,
        j.created_at ? new Date(j.created_at).toLocaleString('en-GH') : '',
        `${j.pickup}${j.destination !== j.pickup ? ` → ${j.destination}` : ''}`,
        `Fare: GH₵ ${money(fareOf(j))}`,
        `Earnings after fee: GH₵ ${money(earnOf(j))}`,
      ]
        .filter(Boolean)
        .join('\n'),
      'Receipt copied.'
    );

  const inviteLink = (path: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}${path}?ref=${myReferralCode}`;
  const inviteMessage = () =>
    inviteAudience === 'riders'
      ? `Earn money with Rydnow. Sign up as a rider with my code ${myReferralCode}: ${inviteLink(RIDER_SIGNUP_PATH)}`
      : `Ride, send parcels and book pickups with Rydnow. Use my code ${myReferralCode} to get GH₵ ${CUSTOMER_FRIEND_DISCOUNT} off your first booking: ${inviteLink(CUSTOMER_SIGNUP_PATH)}`;

  // One-time snapshot of the rider's position (a map link), not a continuously updating live share
  const safetyShareLink = () => {
    const where = currentLocation ? `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lon}` : 'location unavailable';
    const trip = activeJob ? ` Trip: ${activeJob.pickup} to ${activeJob.destination}.` : '';
    return `https://wa.me/?text=${encodeURIComponent(`I’m on a Rydnow job. My location: ${where}.${trip}`)}`;
  };

  const logout = () => {
    patchProfile({ online: false });
    clearSession();
    router.replace(LOGIN_PATH);
  };

  const openNote = (n: Note) => {
    setNotes(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.tab) setActiveTab(n.tab);
  };

  // ─── RENDER HELPERS (plain functions so inputs keep focus) ───
  const locationLabel =
    locationStatus === 'granted'
      ? { icon: '✅', text: locStale ? 'Location not updating' : 'Location shared' }
      : locationStatus === 'requesting'
      ? { icon: '⏳', text: 'Requesting location…' }
      : { icon: '⚠️', text: 'Location off — tap to enable' };

  const statusBadge = restricted
    ? { text: statusKey === 'suspended' ? 'Suspended' : 'Restricted', cls: 'bg-red-500/15 text-red-300', icon: 'lock' }
    : unverified
    ? { text: 'Verification pending', cls: 'bg-[#F5B82E]/15 text-[#F5B82E]', icon: 'clock' }
    : { text: 'Verified', cls: 'bg-emerald-500/15 text-emerald-300', icon: 'check' };

  const header = (title: string) => (
    <header className="flex items-center justify-between px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
      {activeTab === 'home' ? (
        <button onClick={() => setShowSafety(true)} aria-label="Safety and emergency" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80">
          <Icon name="shield" />
        </button>
      ) : (
        <button onClick={() => setActiveTab('home')} aria-label="Back to home" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80">
          <Icon name="back" />
        </button>
      )}
      <h1 className={`${DISPLAY} text-xl font-bold tracking-tight`}>{title}</h1>
      <button
        onClick={() => setActiveTab('profile')}
        aria-label="Open profile"
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#4AA3FF]/60 bg-white/10 text-white/80"
      >
        {profile.photo_url ? <Image src={profile.photo_url} alt="" width={40} height={40} unoptimized className="h-10 w-10 object-cover" /> : <Icon name="user" />}
      </button>
    </header>
  );

  const gateBanner = () => {
    if (!walletLoaded) {
      return (
        <div className={`${CARD} flex items-center gap-3 p-4`}>
          {walletFailed ? (
            <>
              <p className="flex-1 text-sm text-white/70">We couldn’t load your wallet.</p>
              <button onClick={fetchWallet} className={`${BTN_GHOST} inline-flex items-center gap-2 px-4 py-2 text-xs`}>
                <Icon name="refresh" className="h-3.5 w-3.5" /> Retry
              </button>
            </>
          ) : (
            <>
              <Spinner />
              <p className="text-sm text-white/60">Checking your wallet…</p>
            </>
          )}
        </div>
      );
    }
    if (walletReady) return null;
    const pct = Math.min(100, Math.round((wallet.balance / MIN_WALLET_BALANCE) * 100));
    return (
      <div className="rounded-3xl border border-[#F5B82E]/40 bg-[#F5B82E]/10 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5B82E] text-[#2A1B00]">
            <Icon name="lock" className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold">Deposit GH₵ {money(shortfall)} to start accepting jobs</p>
            <p className="mt-0.5 text-xs text-white/60">Riders keep at least GH₵ {MIN_WALLET_BALANCE} in their wallet. It covers service fees and stays yours.</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#F5B82E] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-white/50">
          <span>GH₵ {money(wallet.balance)}</span>
          <span>GH₵ {MIN_WALLET_BALANCE}</span>
        </div>
        <button onClick={() => openDeposit()} className={`${BTN_GOLD} mt-3 w-full py-3 text-sm`}>
          Deposit now
        </button>
      </div>
    );
  };

  const restrictedCard = () =>
    blocked ? (
      <div className={`rounded-3xl border p-4 ${restricted ? 'border-red-400/30 bg-red-500/10' : 'border-[#F5B82E]/40 bg-[#F5B82E]/10'}`} role="alert">
        <p className={`text-sm font-bold ${restricted ? 'text-red-200' : 'text-[#FFD25E]'}`}>{restricted ? 'Account restricted' : 'Verification in progress'}</p>
        <p className="mt-1 text-xs text-white/60">
          {restricted
            ? 'Rydnow has restricted your account, so you can’t go online or accept jobs right now. Contact support to find out why and how to get back online.'
            : 'We’re still checking your documents. You’ll be able to go online as soon as you’re approved, and we’ll send you a notification.'}
        </p>
        {SUPPORT_PHONE && (
          <a href={`tel:${SUPPORT_PHONE}`} className={`${BTN_GHOST} mt-3 block w-full py-2.5 text-center text-xs`}>
            Call support
          </a>
        )}
      </div>
    ) : null;

  const routeLine = (pickup: string, destination: string, light = false) => {
    const same = pickup === destination;
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4AA3FF]" />
          {!same && (
            <>
              <span className={`my-1 w-px flex-1 ${light ? 'bg-white/30' : 'bg-white/15'}`} />
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#FFC83D]" />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-sm font-semibold">{pickup}</p>
          {!same && <p className="truncate text-sm font-semibold">{destination}</p>}
        </div>
      </div>
    );
  };

  const jobCard = (job: Booking) => {
    const svc = SERVICE_META[normalizeService(job.service_type)];
    const pu = toLatLon(job.pickup_lat, job.pickup_lng);
    const away = currentLocation && pu ? distanceKm(currentLocation, pu) : null;
    const isWaste = normalizeService(job.service_type) === 'waste-bin' || job.pickup === job.destination;
    return (
      <div key={String(job.id)} className={`${CARD} p-4`}>
        <div className="mb-3 flex items-center gap-3">
          <Image src={svc.icon} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{svc.label}</p>
            <p className="text-xs text-white/50">{away !== null ? `${away.toFixed(1)} km to pickup` : 'New request'}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#6DB7FF]">GH₵ {money(fareOf(job))}</p>
            <p className="text-[11px] font-semibold text-emerald-400">You earn ~GH₵ {money(earnOf(job))}</p>
          </div>
        </div>
        {routeLine(job.pickup, isWaste ? job.pickup : job.destination)}
        {(job.parcel_details || job.delivery_category) && (
          <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
            {job.delivery_category ? `${job.delivery_category}: ` : ''}
            {job.parcel_details}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button onClick={() => declineJob(job.id)} className={`${BTN_GHOST} flex-1 py-3 text-sm`}>
            Decline
          </button>
          <button
            onClick={() => acceptJob(job)}
            disabled={busyId === String(job.id)}
            className={`${walletReady ? BTN_PRIMARY : BTN_GOLD} flex flex-[2] items-center justify-center gap-2 py-3 text-sm`}
          >
            {busyId === String(job.id) && <Spinner />}
            {walletReady ? 'Accept job' : 'Deposit to accept'}
          </button>
        </div>
      </div>
    );
  };

  const tripRow = (j: Booking, withReceipt = false) => {
    const svc = SERVICE_META[normalizeService(j.service_type)];
    const cancelled = j.status === 'cancelled';
    return (
      <div key={String(j.id)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#4AA3FF]/40 bg-[#1F6BFF]/15">
          <Image src={svc.icon} alt="" width={26} height={26} className="h-6 w-6 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {j.pickup}
            {j.destination !== j.pickup ? ` → ${j.destination}` : ''}
          </p>
          <p className="text-xs text-white/45">
            {shortDate(j.created_at)} · {svc.label}
            {cancelled ? ' · Cancelled' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${cancelled ? 'text-white/40 line-through' : 'text-white'}`}>GH₵ {money(fareOf(j))}</p>
          {withReceipt && !cancelled && (
            <button onClick={() => shareReceipt(j)} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#6DB7FF]">
              <Icon name="receipt" className="h-3 w-3" /> Receipt
            </button>
          )}
        </div>
      </div>
    );
  };

  const closeDeposit = useCallback(() => setShowDeposit(false), []);
  const closeWithdraw = useCallback(() => setShowWithdraw(false), []);

  const paySheet = (kind: 'deposit' | 'withdraw') => (
    <Sheet title={kind === 'deposit' ? 'Deposit to wallet' : 'Withdraw earnings'} onClose={kind === 'deposit' ? closeDeposit : closeWithdraw} locked={sheetBusy}>
      {kind === 'deposit' ? (
        <>
          <p className="mb-4 text-sm text-white/60">
            {walletReady ? 'Top up your wallet by Mobile Money or card.' : `You need GH₵ ${MIN_WALLET_BALANCE} in your wallet to accept jobs. Add at least GH₵ ${money(shortfall)}.`}
          </p>
          <p className={LABEL}>Pay with</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(
              [
                ['mobile_money', 'Mobile Money', 'MTN · Telecel · AT'],
                ['card', 'Visa / Debit card', 'Visa · Mastercard'],
              ] as const
            ).map(([id, label, sub]) => (
              <button
                key={id}
                onClick={() => {
                  setDepositMethod(id);
                  setSheetError('');
                }}
                aria-pressed={depositMethod === id}
                className={`rounded-2xl border-2 p-3 text-left transition ${depositMethod === id ? CHIP_ON : CHIP_OFF}`}
              >
                <span className="block text-sm font-bold">{label}</span>
                <span className="block text-[11px] text-white/50">{sub}</span>
              </button>
            ))}
          </div>
          <div className="mb-3 flex gap-2">
            {[50, 100, 200].map(v => (
              <button key={v} onClick={() => setAmountInput(String(v))} className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold ${amountInput === String(v) ? CHIP_ON : CHIP_OFF}`}>
                GH₵ {v}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm text-white/60">
            Available to withdraw: <span className="font-bold text-[#6DB7FF]">GH₵ {money(withdrawable)}</span>
          </p>
          <p className="mb-4 text-xs text-white/40">GH₵ {MIN_WALLET_BALANCE} stays in your wallet so you can keep accepting jobs.</p>
        </>
      )}
      <label htmlFor="pay-amount" className={LABEL}>
        Amount (GH₵)
      </label>
      <div className="mb-3 flex gap-2">
        <input id="pay-amount" type="number" inputMode="decimal" value={amountInput} onChange={e => setAmountInput(e.target.value)} placeholder="0.00" className={`${INPUT} text-lg font-bold`} />
        {kind === 'withdraw' && (
          <button onClick={() => setAmountInput(money(withdrawable))} className={`${BTN_GHOST} px-4 text-sm`}>
            Max
          </button>
        )}
      </div>
      {kind === 'deposit' && depositMethod === 'card' ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold italic text-[#1A1F71]">VISA</span>
            <span className="flex h-6 w-10 items-center justify-center rounded-md bg-white">
              <span className="-mr-1.5 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
              <span className="h-3.5 w-3.5 rounded-full bg-[#F79E1B] opacity-90" />
            </span>
            <span className="text-xs font-semibold text-white/70">Debit & credit cards</span>
          </div>
          <p className="text-xs text-white/60">You’ll be taken to a secure payment page to enter your card details. Rydnow never sees or stores your card number.</p>
        </div>
      ) : (
        <>
          <label htmlFor="pay-phone" className={LABEL}>
            Mobile Money number
          </label>
          <input
            id="pay-phone"
            type="tel"
            inputMode="tel"
            placeholder="e.g. 054 123 4567"
            value={phoneInput}
            onChange={e => {
              setPhoneInput(e.target.value);
              const n = detectNetwork(e.target.value);
              if (n) setNetworkInput(n);
            }}
            className={`${INPUT} mb-3`}
          />
          <p className={LABEL}>Network</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(['MTN', 'Telecel', 'AirtelTigo'] as const).map(n => (
              <button key={n} onClick={() => setNetworkInput(n)} className={`rounded-xl border-2 py-2.5 text-xs font-bold ${networkInput === n ? CHIP_ON : CHIP_OFF}`}>
                {n === 'AirtelTigo' ? 'AT Money' : n}
              </button>
            ))}
          </div>
        </>
      )}
      {sheetError && (
        <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {sheetError}
        </p>
      )}
      <button onClick={() => submitMoney(kind)} disabled={sheetBusy} className={`${kind === 'deposit' ? BTN_GOLD : BTN_PRIMARY} flex w-full items-center justify-center gap-2 py-3.5`}>
        {sheetBusy && <Spinner />}
        {kind === 'deposit'
          ? depositMethod === 'card'
            ? sheetBusy
              ? 'Opening secure page…'
              : 'Continue to secure payment'
            : sheetBusy
            ? 'Starting deposit…'
            : 'Deposit now'
          : sheetBusy
          ? 'Sending request…'
          : 'Request withdrawal'}
      </button>
      {kind === 'deposit' && depositMethod === 'mobile_money' && <p className="mt-3 text-center text-[11px] text-white/40">You’ll get a prompt on your phone. Approve it with your Mobile Money PIN.</p>}
    </Sheet>
  );

  // ─── HOME ───
  const renderHome = () => {
    const inProgress = activeJob?.status === 'in_progress';
    const svc = activeJob ? SERVICE_META[normalizeService(activeJob.service_type)] : null;
    const target = activeJob && jobGeo ? (inProgress ? jobGeo.dest : jobGeo.pickup) : null;
    const targetAddress = activeJob ? (inProgress ? activeJob.destination : activeJob.pickup) : '';
    const statusTitle = inProgress ? 'Trip in progress' : activeJob?.status === 'arrived' ? 'At pickup' : 'On the way';
    const statusSub = inProgress ? 'Heading to destination' : activeJob?.status === 'arrived' ? 'Waiting for your customer' : 'Heading to pickup';

    return (
      <>
        {header('RYDNOW')}
        <div className="space-y-4 px-4">
          {/* Rider identity */}
          <section className={`${CARD} p-4`}>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#4AA3FF]/60 bg-white/10 text-lg font-bold">
                {profile.photo_url ? (
                  <Image src={profile.photo_url} alt="" width={56} height={56} unoptimized className="h-14 w-14 object-cover" />
                ) : (
                  profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || <Icon name="user" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{profile.name}</p>
                <p className="truncate text-xs text-white/50">
                  {profile.rider_id ? `Rider ID RYD-${String(profile.rider_id).padStart(4, '0')}` : ''}
                  {profile.phone ? ` · ${profile.phone}` : ''}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={profile.rating} size="h-3.5 w-3.5" />
                  <span className="text-xs font-bold text-[#FFC83D]">{profile.rating ? profile.rating.toFixed(1) : 'New'}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${statusBadge.cls}`}>{statusBadge.text}</span>
            </div>
            {approvedServices.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {approvedServices.map(s => (
                  <span key={s.key} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1.5 pr-3 text-[11px] font-semibold text-white/80">
                    <Image src={SERVICE_META[s.key].icon} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                    {SERVICE_META[s.key].label}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Map */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <LiveMap
              rider={currentLocation}
              pickup={jobGeo?.pickup}
              destination={jobGeo && jobGeo.dest && jobGeo.dest !== jobGeo.pickup ? jobGeo.dest : null}
              routeCoords={tripRoute?.coords}
              height={activeJob ? 250 : 230}
              follow
            />
            <button
              onClick={() => setActiveTab('alerts')}
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              className="absolute right-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#0A1530]/85 text-white backdrop-blur"
            >
              <Icon name="bell" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{unread > 9 ? '9+' : unread}</span>
              )}
            </button>
            <button
              onClick={locationStatus === 'granted' ? undefined : requestLocation}
              className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full border border-white/15 bg-[#0A1530]/85 px-3 py-2 text-xs font-semibold backdrop-blur"
            >
              <span aria-hidden="true">{locationLabel.icon}</span>
              {locationLabel.text}
            </button>
            {!activeJob && (
              <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center justify-between rounded-2xl border border-white/10 bg-[#0A1530]/85 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-white/30'}`} />
                  </span>
                  <p className="text-sm font-bold">{isOnline ? 'Looking for requests…' : 'You’re offline'}</p>
                </div>
                {isOnline && availableJobs.length > 0 && <span className="rounded-full bg-[#F5B82E] px-2.5 py-0.5 text-xs font-bold text-[#2A1B00]">{availableJobs.length} waiting</span>}
              </div>
            )}
          </section>

          {locStale && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200" role="alert">
              Can’t access your location — check your settings.
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          {/* Active trip */}
          {activeJob && svc && (
            <>
              <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#2F7BFF] via-[#1A4FD6] to-[#0B2A8F] p-5 shadow-[0_20px_60px_rgba(31,107,255,0.45)]">
                <Image src={svc.icon} alt="" width={180} height={180} className="pointer-events-none absolute -bottom-4 -right-4 h-44 w-44 object-contain opacity-95 drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]" />
                <span className="mb-3 block h-1 w-10 rounded-full bg-[#7CC2FF]" />
                <h2 className={`${DISPLAY} text-3xl font-bold leading-tight tracking-tight`}>{statusTitle}</h2>
                <p className="mt-1 text-lg font-semibold text-[#A8D6FF]">{activeJob.customer_name || 'Customer'}</p>
                <p className="mt-1 text-sm text-white/80">{statusSub}</p>
                <div className="mt-5 flex items-end justify-between pr-2">
                  <div>
                    <p className="text-[11px] text-white/70">Estimated fare</p>
                    <p className={`${DISPLAY} text-2xl font-bold tracking-tight`}>GH₵ {money(fareOf(activeJob))}</p>
                  </div>
                  <p className="rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold">
                    {tripRoute ? `ETA ${tripRoute.min} min` : 'ETA —'}
                    {tripRoute ? ` · ${tripRoute.km} km` : ''}
                  </p>
                </div>
              </section>

              <section className={`${CARD} space-y-4 p-4`}>
                {routeLine(activeJob.pickup, activeJob.destination)}
                {(activeJob.parcel_details || activeJob.delivery_category) && (
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
                    {activeJob.delivery_category ? `${activeJob.delivery_category}: ` : ''}
                    {activeJob.parcel_details}
                  </p>
                )}
                {(activeJob.customer_name || activeJob.customer_phone) && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F6BFF] text-white">
                      <Icon name="user" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{activeJob.customer_name || 'Customer'}</p>
                      <p className="truncate text-xs text-white/50">{activeJob.customer_phone || 'No phone on file'}</p>
                    </div>
                    {activeJob.customer_phone && (
                      <>
                        <a href={`tel:${activeJob.customer_phone}`} aria-label="Call customer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#6DB7FF]">
                          <Icon name="phone" />
                        </a>
                        <a href={whatsappLink(activeJob.customer_phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp customer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-emerald-400">
                          <Icon name="chat" />
                        </a>
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <p className="text-xs text-white/50">After service fee</p>
                  <p className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300">You earn ~GH₵ {money(earnOf(activeJob))}</p>
                </div>
                <div className="flex gap-3">
                  <a href={googleNav(target, targetAddress)} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} flex flex-1 items-center justify-center gap-2 py-3 text-sm`}>
                    <Icon name="navigate" className="h-4 w-4" />
                    Navigate to {inProgress ? 'destination' : 'pickup'}
                  </a>
                  {target && (
                    <a href={wazeNav(target)} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} px-5 py-3 text-sm`}>
                      Waze
                    </a>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Earnings pill */}
          <button onClick={() => setActiveTab('wallet')} className="flex w-full items-center gap-3 rounded-full border border-[#4AA3FF]/40 bg-[#0E1E4A]/70 p-2 pr-5 text-left shadow-[0_0_30px_rgba(31,107,255,0.25)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#4AA3FF]/50 text-[#6DB7FF]">
              <Icon name="wallet" />
            </span>
            <span className="flex-1">
              <span className={`${DISPLAY} block text-xl font-bold tracking-tight`}>Today GH₵ {money(todayStats.earned)}</span>
              <span className="block text-[11px] text-white/50">
                {todayStats.trips} {todayStats.trips === 1 ? 'trip' : 'trips'} · {goalPct >= 100 ? 'Goal reached 🎉' : `${goalPct}% of GH₵ ${dailyGoal} goal`}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-[#6DB7FF]">
              Details <Icon name="chevron" className="h-4 w-4" />
            </span>
          </button>

          {restrictedCard()}
          {!activeJob && !blocked && gateBanner()}

          {/* Service switching (only when approved for more than one) */}
          {approvedServices.length > 1 && (
            <section>
              <h3 className="mb-2 text-sm font-bold">Working on</h3>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {approvedServices.map(s => {
                  const meta = SERVICE_META[s.key];
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleService(s.key)}
                      aria-pressed={s.active}
                      className={`flex shrink-0 items-center gap-2 rounded-full border-2 py-1.5 pl-2 pr-4 ${s.active ? CHIP_ON : CHIP_OFF}`}
                    >
                      <Image src={meta.icon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                      <span className="text-left">
                        <span className="block text-xs font-bold">{meta.label}</span>
                        <span className="block text-[10px] text-white/50">{s.active ? 'On' : 'Off'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Nearby requests */}
          {isOnline && !activeJob && availableJobs.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold">Requests near you</h3>
              {availableJobs.map(j => jobCard(j))}
            </section>
          )}

          {/* Recent trips */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`${DISPLAY} text-lg font-bold tracking-tight`}>Recent Trips</h3>
              <button onClick={() => setActiveTab('trips')} className="text-xs font-bold text-[#6DB7FF]">
                See all
              </button>
            </div>
            {history.length === 0 ? (
              <p className={`${CARD} p-5 text-center text-sm text-white/50`}>No trips yet. Go online to get your first request.</p>
            ) : (
              <div className="space-y-2">{history.slice(0, 4).map(j => tripRow(j))}</div>
            )}
          </section>
        </div>
      </>
    );
  };

  // ─── TRIPS ───
  const renderTrips = () => {
    const from = periodStart(tripPeriod);
    const q = tripQuery.trim().toLowerCase();
    const list = history.filter(
      j =>
        new Date(j.created_at || 0).getTime() >= from &&
        (tripService === 'all' || normalizeService(j.service_type) === tripService) &&
        (!q || `${j.pickup} ${j.destination}`.toLowerCase().includes(q))
    );
    const done = history.filter(j => j.status === 'completed').length;
    const cancelled = history.filter(j => j.status === 'cancelled').length;
    const completionRate = profile.completion_rate ?? (done + cancelled > 0 ? Math.round((done / (done + cancelled)) * 100) : undefined);
    const stats: [string, string][] = [
      ['Rating', profile.rating ? `${profile.rating.toFixed(1)} / ${MAX_RATING}` : '—'],
      ['Trips completed', String(Math.max(profile.completed_jobs, done))],
      ['Acceptance', profile.acceptance_rate != null ? `${Math.round(profile.acceptance_rate)}%` : '—'],
      ['Completion', completionRate != null ? `${Math.round(completionRate)}%` : '—'],
    ];
    return (
      <>
        {header('Trips')}
        <div className="space-y-4 px-4">
          <section className="grid grid-cols-2 gap-3">
            {stats.map(([label, value]) => (
              <div key={label} className={`${CARD} p-4`}>
                <p className={`${DISPLAY} text-xl font-bold tracking-tight`}>{value}</p>
                <p className="text-xs text-white/50">{label}</p>
              </div>
            ))}
            <p className="col-span-2 -mt-1 text-center text-[11px] text-white/40">
              Member since {profile.member_since ? new Date(profile.member_since).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) : '—'}
            </p>
          </section>

          <input value={tripQuery} onChange={e => setTripQuery(e.target.value)} placeholder="Search pickup or destination" aria-label="Search trips" className={INPUT} />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {(['all', 'today', 'week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setTripPeriod(p)} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${tripPeriod === p ? CHIP_ON : CHIP_OFF}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {(['all', ...ALL_SERVICE_KEYS] as ('all' | ServiceKey)[]).map(s => (
              <button key={s} onClick={() => setTripService(s)} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${tripService === s ? CHIP_ON : CHIP_OFF}`}>
                {s === 'all' ? 'All services' : SERVICE_META[s].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/50">
            {list.length} {list.length === 1 ? 'trip' : 'trips'} · GH₵ {money(list.filter(j => j.status === 'completed').reduce((s, j) => s + earnOf(j), 0))} earned
          </p>
          {list.length === 0 ? (
            <p className={`${CARD} p-6 text-center text-sm text-white/50`}>No trips match these filters.</p>
          ) : (
            <div className="space-y-2">{list.map(j => tripRow(j, true))}</div>
          )}
        </div>
      </>
    );
  };

  // ─── WALLET ───
  const renderWallet = () => {
    const from = txFilter === 'today' ? startOfToday() : txFilter === 'week' ? Date.now() - 7 * 86400000 : 0;
    const txs = transactions.filter(tx => new Date(tx.created_at).getTime() >= from);
    return (
      <>
        {header('Wallet')}
        <div className="space-y-4 px-4">
          {walletFailed && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200" role="alert">
              <span className="flex-1">Couldn’t refresh your wallet. The balance below may be out of date.</span>
              <button onClick={fetchWallet} className="text-xs font-bold underline">
                Retry
              </button>
            </div>
          )}
          {depositWaitingUntil > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#4AA3FF]/30 bg-[#1F6BFF]/10 p-3 text-sm text-[#9FD0FF]">
              <Spinner /> Waiting for your payment to confirm…
            </div>
          )}
          <section className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#2F7BFF] via-[#1A4FD6] to-[#0B2A8F] p-5 shadow-[0_20px_60px_rgba(31,107,255,0.4)]">
            <p className="text-sm text-white/75">Wallet balance</p>
            <p className={`${DISPLAY} mt-1 text-4xl font-bold tracking-tight`}>
              <span className="mr-1 text-xl font-bold">GH₵</span>
              {money(wallet.balance)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-[11px] text-white/70">You can withdraw</p>
                <p className="font-bold">GH₵ {money(withdrawable)}</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-[11px] text-white/70">Kept in wallet</p>
                <p className="font-bold">GH₵ {money(Math.min(wallet.balance, MIN_WALLET_BALANCE))}</p>
              </div>
            </div>
            <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${walletReady ? 'bg-emerald-400/25 text-emerald-100' : 'bg-[#F5B82E] text-[#2A1B00]'}`}>
              <Icon name={walletReady ? 'check' : 'lock'} className="h-3.5 w-3.5" />
              {walletReady ? `Deposit GH₵ ${MIN_WALLET_BALANCE} — Paid` : `Deposit GH₵ ${MIN_WALLET_BALANCE} — add GH₵ ${money(shortfall)} to accept jobs`}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openDeposit()} className={`${BTN_GOLD} flex items-center justify-center gap-2 py-3.5 text-sm`}>
              <Icon name="plus" className="h-4 w-4" /> Deposit
            </button>
            <button onClick={openWithdraw} disabled={withdrawable <= 0} className={`${BTN_GHOST} py-3.5 text-sm`}>
              Withdraw
            </button>
          </div>

          <section className={`${CARD} p-4`}>
            <h3 className="mb-3 text-sm font-bold">Earnings</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['today', 'week', 'month'] as const).map(p => (
                <div key={p} className="rounded-2xl bg-white/5 p-3">
                  <p className="text-base font-bold text-[#6DB7FF]">{money(periodStats[p].earned)}</p>
                  <p className="text-[11px] text-white/50">{PERIOD_LABEL[p]}</p>
                  <p className="text-[11px] text-white/35">{periodStats[p].trips} trips</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-white/60">
                  Daily goal · {goalPct}% of GH₵ {dailyGoal}
                </span>
                <button onClick={() => setShowGoal(true)} className="inline-flex items-center gap-1 font-bold text-[#6DB7FF]">
                  <Icon name="edit" className="h-3 w-3" /> Edit
                </button>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#2F80FF] to-[#F5B82E] transition-all" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/35">Service fee: {wallet.commission_rate} per trip</p>
          </section>

          <section className={`${CARD} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Transactions</h3>
              <div className="flex gap-1.5">
                {(['all', 'today', 'week'] as const).map(f => (
                  <button key={f} onClick={() => setTxFilter(f)} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${txFilter === f ? CHIP_ON : CHIP_OFF}`}>
                    {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This week'}
                  </button>
                ))}
              </div>
            </div>
            {txs.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">No transactions yet</p>
            ) : (
              <div className="divide-y divide-white/5">
                {txs.map(tx => {
                  const credit = txIsCredit(tx);
                  const pending = tx.status && !['completed', 'success'].includes(tx.status);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${credit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        <Icon name={tx.type === 'withdrawal' ? 'logout' : tx.type === 'referral_bonus' ? 'gift' : 'wallet'} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{TX_LABEL[tx.type] || tx.description || tx.type}</p>
                        <p className="text-xs text-white/40">
                          {shortDate(tx.created_at)}
                          {pending ? ` · ${tx.status}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${credit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {credit ? '+' : '−'} GH₵ {money(txAmount(tx))}
                        </p>
                        {Number(tx.commission) > 0 && <p className="text-[11px] text-white/35">Fee GH₵ {money(Number(tx.commission))}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </>
    );
  };

  // ─── ALERTS ───
  const NOTE_STYLE: Record<NoteKind, { icon: string; tone: string }> = {
    job: { icon: 'bell', tone: 'bg-[#1F6BFF]/20 text-[#6DB7FF]' },
    cancelled: { icon: 'close', tone: 'bg-red-500/15 text-red-400' },
    payment: { icon: 'wallet', tone: 'bg-emerald-500/15 text-emerald-400' },
    account: { icon: 'shield', tone: 'bg-[#F5B82E]/15 text-[#F5B82E]' },
    system: { icon: 'chat', tone: 'bg-white/10 text-white/70' },
  };
  const renderAlerts = () => (
    <>
      {header('Alerts')}
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/50">{unread ? `${unread} unread` : 'All caught up'}</p>
          <div className="flex gap-4 text-xs font-bold text-[#6DB7FF]">
            <button onClick={() => setNotes(prev => prev.map(n => ({ ...n, read: true })))} disabled={!unread} className="disabled:opacity-40">
              Mark all read
            </button>
            <button onClick={() => setNotes([])} disabled={!notes.length} className="disabled:opacity-40">
              Clear all
            </button>
          </div>
        </div>
        {notes.length === 0 ? (
          <div className={`${CARD} p-10 text-center`}>
            <p className="mb-2 text-4xl">🔔</p>
            <p className="font-bold">No notifications yet</p>
            <p className="mt-1 text-sm text-white/50">New requests, payments and account updates show up here.</p>
          </div>
        ) : (
          notes.map(n => (
            <button key={n.id} onClick={() => openNote(n)} className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${n.read ? 'border-white/5 bg-white/[0.03]' : 'border-[#4AA3FF]/30 bg-[#1F6BFF]/10'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${NOTE_STYLE[n.kind].tone}`}>
                <Icon name={NOTE_STYLE[n.kind].icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-white/40">{timeAgo(n.created_at)}</span>
                </span>
                <span className="mt-0.5 block text-xs text-white/60">{n.body}</span>
              </span>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#4AA3FF]" />}
            </button>
          ))
        )}
      </div>
    </>
  );

  // ─── PROFILE ───
  const renderProfile = () => {
    const initials = profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
      <>
        {header('Profile')}
        <div className="space-y-4 px-4">
          <section className={`${CARD} p-5 text-center`}>
            {profile.photo_url ? (
              <Image src={profile.photo_url} alt="" width={80} height={80} unoptimized className="mx-auto h-20 w-20 rounded-full border-2 border-[#4AA3FF]/60 object-cover" />
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1F6BFF] text-2xl font-bold">{initials || <Icon name="user" className="h-8 w-8" />}</div>
            )}
            <h2 className={`${DISPLAY} mt-3 text-lg font-bold tracking-tight`}>{profile.name}</h2>
            <div className="mt-1 flex justify-center">
              <Stars value={profile.rating} />
            </div>
            <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${statusBadge.cls}`}>
              <Icon name={statusBadge.icon} className="h-3 w-3" />
              {restricted ? 'Restricted' : unverified ? 'Verification pending' : 'Verified rider'}
            </span>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{profile.rating ? profile.rating.toFixed(1) : '—'}</p>
                <p className="text-[11px] text-white/50">Rating / {MAX_RATING}</p>
              </div>
              <div>
                <p className="text-lg font-bold">{profile.completed_jobs}</p>
                <p className="text-[11px] text-white/50">Trips</p>
              </div>
              <div>
                <p className="text-lg font-bold">{profile.vehicle_plate || '—'}</p>
                <p className="text-[11px] text-white/50">Plate</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditForm({ name: profile.name, phone: profile.phone, email: profile.email });
                setSheetError('');
                setShowEdit(true);
              }}
              className={`${BTN_GHOST} mt-4 inline-flex items-center gap-2 px-5 py-2 text-sm`}
            >
              <Icon name="edit" className="h-4 w-4" /> Edit profile
            </button>
          </section>

          <section className={`${CARD} p-4`}>
            <h3 className="text-sm font-bold">Services I work on</h3>
            <p className="mb-3 mt-0.5 text-xs text-white/50">Switch a service on to receive its requests. New services need Rydnow approval.</p>
            <div className="space-y-3">
              {services.map(s => {
                const meta = SERVICE_META[s.key];
                const requested = requestedServices.includes(s.key);
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <Image src={meta.icon} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{meta.label}</p>
                      <p className="text-xs text-white/50">{s.approved ? meta.tagline : requested ? 'Request sent' : 'Not approved yet'}</p>
                    </div>
                    {s.approved ? (
                      <Switch on={s.active} onChange={() => toggleService(s.key)} label={`${meta.label} ${s.active ? 'on' : 'off'}`} />
                    ) : (
                      <button onClick={() => requestService(s.key)} disabled={requested} className="rounded-full border border-[#4AA3FF] px-3 py-1.5 text-xs font-bold text-[#6DB7FF] disabled:opacity-40">
                        {requested ? 'Pending' : 'Request'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`${CARD} space-y-4 p-4`}>
            <h3 className="text-sm font-bold">Notifications</h3>
            {([
              ['Job alerts', 'jobAlerts'],
              ['Sound', 'sound'],
              ['Vibration', 'vibration'],
            ] as [string, keyof Prefs][]).map(([label, key]) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-sm text-white/80">{label}</p>
                <Switch on={prefs[key]} onChange={v => updatePrefs({ [key]: v })} label={label} />
              </div>
            ))}
            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-sm font-bold">Language</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l}
                    onClick={() => {
                      setLanguage(l);
                      writeJSON('rydn_lang', l);
                    }}
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold ${language === l ? CHIP_ON : CHIP_OFF}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={`${CARD} divide-y divide-white/5`}>
            {([
              ['gift', 'Invite & earn', () => setShowInvite(true)],
              ['shield', 'Safety & emergency', () => setShowSafety(true)],
              ['doc', 'Privacy policy', () => router.push(PRIVACY_PATH)],
              ['doc', 'Terms of service', () => router.push(TERMS_PATH)],
            ] as [string, string, () => void][]).map(([icon, label, run]) => (
              <button key={label} onClick={run} className="flex w-full items-center gap-3 px-4 py-4 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#6DB7FF]">
                  <Icon name={icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm font-semibold">{label}</span>
                <Icon name="chevron" className="h-4 w-4 text-white/30" />
              </button>
            ))}
            {SUPPORT_PHONE && (
              <a href={`tel:${SUPPORT_PHONE}`} className="flex w-full items-center gap-3 px-4 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#6DB7FF]">
                  <Icon name="phone" className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm font-semibold">Help & support · call admin</span>
                <Icon name="chevron" className="h-4 w-4 text-white/30" />
              </a>
            )}
          </section>

          <button
            onClick={() => (activeJob ? notify('Finish your current trip before signing out.', 'error') : setShowLogout(true))}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 py-3.5 text-sm font-bold text-red-300"
          >
            <Icon name="logout" className="h-[18px] w-[18px]" /> Sign out
          </button>
        </div>
      </>
    );
  };

  // ─── GATE SCREENS (after all hooks) ───
  const shell = `${bodyFont.className} antialiased mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center bg-[#050B1A] px-8 text-center text-white`;
  if (profileState === 'loading' || profileState === 'unauth') {
    return (
      <div className={`${shell} gap-3 text-sm text-white/60`}>
        <Spinner className="h-6 w-6" />
        {profileState === 'unauth' ? 'Taking you to sign in…' : 'Loading your rider account…'}
      </div>
    );
  }
  if (profileState === 'unlinked') {
    return (
      <div className={shell}>
        <p className="mb-4 text-5xl">🛵</p>
        <h1 className="text-xl font-bold">No rider profile found</h1>
        <p className="mt-2 text-sm text-white/60">This account isn’t linked to a rider yet. Sign up as a rider, or sign in with the account you registered with.</p>
        <div className="mt-6 flex w-full gap-3">
          <button onClick={() => router.push(LOGIN_PATH)} className={`${BTN_GHOST} flex-1 py-3.5 text-sm`}>
            Sign in
          </button>
          <button onClick={() => router.push(RIDER_SIGNUP_PATH)} className={`${BTN_GOLD} flex-1 py-3.5 text-sm`}>
            Become a rider
          </button>
        </div>
      </div>
    );
  }

  const goOnlineBtn = (
    <button
      onClick={toggleOnline}
      aria-pressed={isOnline}
      disabled={locationStatus === 'requesting'}
      className={`relative flex h-16 w-full items-center rounded-full p-1.5 transition-all duration-300 ${
        isOnline ? 'bg-gradient-to-r from-[#1F6BFF] to-[#4AA3FF] shadow-[0_10px_40px_rgba(31,107,255,0.6)]' : 'border border-white/15 bg-white/10 backdrop-blur'
      }`}
    >
      <span className={`absolute flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[#04122E] shadow-lg transition-all duration-300 ${isOnline ? 'left-[calc(100%-58px)]' : 'left-1.5'}`}>
        {locationStatus === 'requesting' ? <Spinner /> : <Icon name="power" />}
      </span>
      <span className={`w-full text-center text-base font-bold ${isOnline ? 'pr-14 text-[#04122E]' : 'pl-14 text-white/80'}`}>{isOnline ? 'Go Offline' : 'Go Online'}</span>
    </button>
  );
  const busy = activeJob ? busyId === String(activeJob.id) : false;
  const tripBtn = (label: string, run: () => void, cls = BTN_PRIMARY) => (
    <button onClick={run} disabled={busy} className={`${cls} flex h-16 w-full items-center justify-center gap-2 text-base`}>
      {busy && <Spinner />}
      {label}
    </button>
  );

  return (
    <div
      className={`${bodyFont.className} antialiased relative mx-auto flex min-h-[100dvh] max-w-lg flex-col overflow-x-hidden bg-[#050B1A] bg-[radial-gradient(70%_32%_at_50%_-4%,rgba(31,107,255,0.5),transparent_70%),radial-gradient(45%_28%_at_100%_62%,rgba(31,107,255,0.2),transparent_70%),radial-gradient(40%_25%_at_0%_85%,rgba(31,107,255,0.14),transparent_70%)] text-white`}
    >
      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[70] w-[90%] max-w-sm -translate-x-1/2" role="status" aria-live="polite">
          <div className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-[#1F6BFF]'}`}>{toast.message}</div>
        </div>
      )}

      {/* Incoming job alert */}
      {alertJob && (
        <JobAlert
          booking={alertJob.booking}
          expiresAt={alertJob.expiresAt}
          walletReady={walletReady}
          earn={earnOf(alertJob.booking)}
          onDecline={() => declineJob(alertJob.booking.id)}
          onAccept={() => acceptJob(alertJob.booking)}
          onExpire={() => declineJob(alertJob.booking.id, true)}
        />
      )}

      <main className={`flex-1 ${activeTab === 'home' ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]'}`}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'trips' && renderTrips()}
        {activeTab === 'wallet' && renderWallet()}
        {activeTab === 'alerts' && renderAlerts()}
        {activeTab === 'profile' && renderProfile()}
      </main>

      {/* Primary action dock (home only) */}
      {activeTab === 'home' && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4">
          {!activeJob && goOnlineBtn}
          {activeJob?.status === 'assigned' && tripBtn('I’ve Arrived', () => tripAction('/arrive-ride/', 'arrived', 'Could not confirm arrival.'))}
          {activeJob?.status === 'arrived' && tripBtn('Start Trip', () => tripAction('/start-ride/', 'in_progress', 'Could not start the trip.'))}
          {activeJob?.status === 'in_progress' && tripBtn('Complete Trip', () => setConfirmComplete(true), BTN_GREEN)}
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-white/10 bg-[#071027]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Main">
        <div className="flex justify-around px-2 py-2">
          {(
            [
              { id: 'home', label: 'Home', icon: 'home' },
              { id: 'trips', label: 'Trips', icon: 'trips' },
              { id: 'wallet', label: 'Wallet', icon: 'wallet' },
              { id: 'alerts', label: 'Alerts', icon: 'bell' },
              { id: 'profile', label: 'Profile', icon: 'user' },
            ] as { id: TabType; label: string; icon: string }[]
          ).map(tab => {
            const active = activeTab === tab.id;
            const badge = tab.id === 'alerts' ? unread : 0;
            const dot = tab.id === 'wallet' && walletLoaded && !walletReady;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition ${active ? 'bg-[#1F6BFF]/20 text-[#6DB7FF]' : 'text-white/40'}`}
              >
                <span className="relative">
                  <Icon name={tab.icon} className="h-6 w-6" />
                  {badge > 0 && <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>}
                  {dot && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071027] bg-[#F5B82E]" />}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sheets */}
      {showDeposit && paySheet('deposit')}
      {showWithdraw && paySheet('withdraw')}

      {showLocPrompt && (
        <Sheet title="Allow location access?" onClose={() => setShowLocPrompt(false)}>
          <p className="mb-5 text-sm text-white/60">Allow location access to see nearby rides. Your position is shared with customers only while you’re online or on a trip.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLocPrompt(false)} className={`${BTN_GHOST} flex-1 py-3.5`}>
              Not now
            </button>
            <button
              onClick={() => {
                setShowLocPrompt(false);
                setPendingOnline(true);
                requestLocation();
              }}
              className={`${BTN_PRIMARY} flex-[2] py-3.5`}
            >
              Allow location
            </button>
          </div>
        </Sheet>
      )}

      {showGoal && (
        <Sheet title="Daily earnings goal" onClose={() => setShowGoal(false)}>
          <p className="mb-4 text-sm text-white/60">Pick a goal and track your progress on the home screen.</p>
          <div className="grid grid-cols-4 gap-2">
            {[100, 150, 200, 300].map(v => (
              <button
                key={v}
                onClick={() => {
                  setDailyGoal(v);
                  writeJSON('rydn_daily_goal', v);
                  setShowGoal(false);
                }}
                className={`rounded-xl border-2 py-3 text-sm font-bold ${dailyGoal === v ? CHIP_ON : CHIP_OFF}`}
              >
                {v}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {showEdit && (
        <Sheet title="Edit profile" onClose={() => setShowEdit(false)} locked={sheetBusy}>
          {(
            [
              ['Full name', 'name', 'text'],
              ['Phone', 'phone', 'tel'],
              ['Email', 'email', 'email'],
            ] as [string, 'name' | 'phone' | 'email', string][]
          ).map(([label, key, type]) => (
            <div key={key} className="mb-3">
              <label htmlFor={`edit-${key}`} className={LABEL}>
                {label}
              </label>
              <input id={`edit-${key}`} type={type} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} className={INPUT} />
            </div>
          ))}
          {sheetError && (
            <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
              {sheetError}
            </p>
          )}
          <button onClick={saveProfile} disabled={sheetBusy} className={`${BTN_PRIMARY} flex w-full items-center justify-center gap-2 py-3.5`}>
            {sheetBusy && <Spinner />} Save changes
          </button>
        </Sheet>
      )}

      {showLogout && (
        <Sheet title="Sign out?" onClose={() => setShowLogout(false)}>
          <p className="mb-5 text-sm text-white/60">You’ll go offline and stop receiving requests.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLogout(false)} className={`${BTN_GHOST} flex-1 py-3.5`}>
              Stay signed in
            </button>
            <button onClick={logout} className="flex-[1.4] rounded-full bg-red-500 py-3.5 font-bold text-white">
              Sign out
            </button>
          </div>
        </Sheet>
      )}

      {showInvite && (
        <Sheet title="Invite & earn" onClose={() => setShowInvite(false)}>
          <div className="mb-4 grid grid-cols-2 rounded-2xl bg-white/5 p-1" role="tablist">
            {(['riders', 'customers'] as const).map(a => (
              <button key={a} role="tab" aria-selected={inviteAudience === a} onClick={() => setInviteAudience(a)} className={`rounded-xl py-2 text-sm font-bold ${inviteAudience === a ? 'bg-[#1F6BFF] text-white' : 'text-white/60'}`}>
                {a === 'riders' ? 'Invite a rider' : 'Invite a customer'}
              </button>
            ))}
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-[#2F7BFF] to-[#0B2A8F] p-5 text-center">
            <p className="text-xs font-bold text-[#FFD25E]">Earn GH₵ {inviteAudience === 'riders' ? RIDER_INVITE_REWARD : CUSTOMER_INVITE_REWARD} per friend</p>
            <p className={`${DISPLAY} mt-2 text-3xl font-bold tracking-widest`}>{myReferralCode}</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(myReferralCode);
                  notify('Code copied', 'success');
                } catch {
                  notify(`Your code is ${myReferralCode}`, 'info');
                }
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-2 text-sm font-bold"
            >
              <Icon name="copy" className="h-4 w-4" /> Copy code
            </button>
          </div>
          <p className="mt-3 text-xs text-white/50">
            {inviteAudience === 'riders'
              ? `GH₵ ${RIDER_INVITE_REWARD} lands in your wallet once your friend is approved and completes their first trips.`
              : `Your friend gets GH₵ ${CUSTOMER_FRIEND_DISCOUNT} off their first booking. You earn GH₵ ${CUSTOMER_INVITE_REWARD} after it.`}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Invited', String(referralStats.total)],
              ['Pending', String(referralStats.pending)],
              ['Earned', `GH₵ ${money(referralStats.earned)}`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white/5 p-3">
                <p className="text-base font-bold">{v}</p>
                <p className="text-[11px] text-white/50">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => shareText('Join Rydnow', inviteMessage(), 'Invite message copied.')} className={`${BTN_GOLD} col-span-2 flex items-center justify-center gap-2 py-3.5 text-sm`}>
              <Icon name="share" className="h-5 w-5" /> Share invite
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage())}`} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} py-3 text-center text-sm`}>
              WhatsApp
            </a>
            <a href={`sms:?&body=${encodeURIComponent(inviteMessage())}`} className={`${BTN_GHOST} py-3 text-center text-sm`}>
              Text message
            </a>
          </div>
        </Sheet>
      )}

      {showSafety && (
        <Sheet title="Safety & emergency" onClose={() => setShowSafety(false)}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              ['Police', '191'],
              ['Ambulance', '193'],
              ['Emergency', '112'],
            ].map(([label, num]) => (
              <a key={num} href={`tel:${num}`} className="rounded-2xl bg-red-600 py-3 text-center">
                <span className="block text-lg font-bold">{num}</span>
                <span className="block text-[11px]">{label}</span>
              </a>
            ))}
          </div>
          {SUPPORT_PHONE && (
            <a href={`tel:${SUPPORT_PHONE}`} className={`${BTN_GHOST} mb-3 block w-full py-3 text-center text-sm`}>
              Call Rydnow support
            </a>
          )}
          <a href={safetyShareLink()} target="_blank" rel="noopener noreferrer" className={`${BTN_GOLD} block w-full py-3 text-center text-sm`}>
            Send my location on WhatsApp
          </a>
          <p className="mt-3 text-center text-[11px] text-white/40">Check that these numbers are correct for your area.</p>
        </Sheet>
      )}

      {confirmComplete && activeJob && (
        <Sheet title="Complete this trip?" onClose={() => setConfirmComplete(false)}>
          <p className="mb-5 text-sm text-white/60">
            Confirm you’ve finished the {SERVICE_META[normalizeService(activeJob.service_type)].label.toLowerCase()} at <span className="font-bold text-white">{activeJob.destination}</span>. About{' '}
            <span className="font-bold text-emerald-400">GH₵ {money(earnOf(activeJob))}</span> goes to your wallet.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmComplete(false)} className={`${BTN_GHOST} flex-1 py-3.5`}>
              Not yet
            </button>
            <button
              onClick={() => {
                setConfirmComplete(false);
                tripAction('/complete-ride/', 'completed', 'Could not complete the trip.');
              }}
              className="flex-[2] rounded-full bg-emerald-500 py-3.5 font-bold text-white"
            >
              Yes, complete
            </button>
          </div>
        </Sheet>
      )}

      {summary && (
        <Sheet title="Trip complete" onClose={() => setSummary(null)}>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs text-white/50">{summary.service}</p>
            {routeLine(summary.pickup, summary.destination)}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-bold">{summary.km != null ? `${summary.km} km` : '—'}</p>
                <p className="text-[11px] text-white/50">Distance{summary.min ? ` · ${summary.min} min` : ''}</p>
              </div>
              <div>
                <p className="text-lg font-bold">GH₵ {money(summary.fare)}</p>
                <p className="text-[11px] text-white/50">Total fare</p>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-emerald-500/15 py-3 text-center text-sm font-bold text-emerald-300">Your earnings after fee: GH₵ {money(summary.earn)}</p>
          </div>
          <button onClick={() => setSummary(null)} className={`${BTN_PRIMARY} mt-4 w-full py-3.5`}>
            Done — Back to Online
          </button>
        </Sheet>
      )}
    </div>
  );
}

