'use client';


import Image from 'next/image';
import { useState } from 'react';
import type { Booking } from '@/lib/rydnow/api';
import { SERVICE_HINTS, SERVICE_LABELS, isTerminalBooking, money, normalizeServiceKey, type ServiceKey } from '@/lib/rydnow/config';
import { Icon, Spinner } from '@/components/dashboard/ui';


// ═══ Helpers (also used by the dashboard page) ═══


const SERVICE_ICON_SRC: Record<ServiceKey, string> = {
  okada: '/okada.svg',
  parcel: '/parcel.svg',
  'waste-bin': '/waste-bin.svg',
};


const serviceKeyOf = (b: Booking): ServiceKey => normalizeServiceKey(b.service_key) ?? normalizeServiceKey(b.service_type) ?? 'okada';


const providerOf = (b: Booking) => (serviceKeyOf(b) === 'waste-bin' ? 'collector' : 'rider');


const statusKey = (b: Booking) => String(b.status ?? '').toLowerCase().replace(/[\s-]+/g, '_');


/** Reads a field that may be named differently across backend versions. */
function field(b: Booking, ...keys: string[]): unknown {
  const o = b as unknown as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}


const priceOf = (b: Booking): number | null => {
  const n = Number(field(b, 'total_price', 'price', 'amount', 'total'));
  return Number.isFinite(n) ? n : null;
};


const SEARCHING = new Set(['pending', 'requested', 'created', 'searching', 'finding', 'awaiting_rider', 'awaiting_payment', 'dispatching']);
const ACCEPTED = new Set(['accepted', 'assigned', 'confirmed']);
const ON_THE_WAY = new Set(['arriving', 'en_route', 'on_the_way', 'arrived', 'rider_arrived']);
const IN_PROGRESS = new Set(['picked_up', 'in_progress', 'started', 'ongoing', 'on_trip']);
const DONE = new Set(['completed', 'delivered', 'complete']);
const CANCELLED = new Set(['cancelled', 'canceled']);


export function isActive(b: Booking): boolean {
  return !isTerminalBooking(b.status);
}


/** Customer can still cancel until the trip has actually started. */
export function canCancel(b: Booking): boolean {
  return isActive(b) && !IN_PROGRESS.has(statusKey(b));
}


export interface StatusUi {
  label: string;
  /** Tailwind classes for the badge. */
  badge: string;
}


export function statusUi(b: Booking): StatusUi {
  const s = statusKey(b);
  const who = providerOf(b);
  if (SEARCHING.has(s)) return { label: `Finding your ${who}…`, badge: 'bg-blue-50 text-blue-700' };
  if (s === 'scheduled') return { label: 'Scheduled', badge: 'bg-purple-50 text-purple-700' };
  if (ACCEPTED.has(s)) return { label: `Your ${who} accepted`, badge: 'bg-blue-50 text-blue-700' };
  if (ON_THE_WAY.has(s)) return { label: `Your ${who} is on the way`, badge: 'bg-blue-50 text-blue-700' };
  if (IN_PROGRESS.has(s)) return { label: serviceKeyOf(b) === 'waste-bin' ? 'Collection in progress' : 'Trip in progress', badge: 'bg-indigo-50 text-indigo-700' };
  if (DONE.has(s)) return { label: 'Completed', badge: 'bg-green-50 text-green-700' };
  if (CANCELLED.has(s)) return { label: 'Cancelled', badge: 'bg-gray-100 text-gray-600' };
  if (!isActive(b)) return { label: 'Not completed', badge: 'bg-red-50 text-red-700' };
  const pretty = s.replace(/_/g, ' ');
  return { label: pretty.charAt(0).toUpperCase() + pretty.slice(1), badge: 'bg-gray-100 text-gray-700' };
}


/** Wording for the "Cancel this booking?" dialog, based on how far the booking has got. */
export function cancelMessage(b: Booking): string {
  const hints = SERVICE_HINTS[serviceKeyOf(b)];
  const who = providerOf(b);
  if (SEARCHING.has(statusKey(b)) || statusKey(b) === 'scheduled') {
    return `No ${who} has accepted yet, so cancelling is free. Any payment you made is refunded.`;
  }
  return `A ${who} has already accepted. Cancelling is free for ${hints.cancelGraceMinutes} minutes after they accept. After that a fee of ${money(hints.cancelFeeAccepted)} may apply.`;
}


const formatDate = (iso: unknown) => {
  const t = Date.parse(String(iso ?? ''));
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};


const riderName = (b: Booking): string => {
  const r = b.rider as unknown as { name?: string; full_name?: string } | null;
  return (r?.name || r?.full_name || '').trim();
};


// ═══ UI ═══


function BookingCard({ b, onCancel, onRebook }: { b: Booking; onCancel: (b: Booking) => void; onRebook: (b: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const key = serviceKeyOf(b);
  const ui = statusUi(b);
  const price = priceOf(b);
  const active = isActive(b);
  const name = riderName(b);
  const stops = Array.isArray(b.stops) ? b.stops.length : 0;
  const notes = typeof b.notes === 'string' ? b.notes.trim() : '';
  const showDrop = !!b.dropoff_address && b.dropoff_address !== b.pickup_address;


  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Image src={SERVICE_ICON_SRC[key]} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-gray-900">{SERVICE_LABELS[key]}</p>
          <p className="text-xs text-gray-500">{formatDate(field(b, 'scheduled_for', 'created_at'))}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${ui.badge}`}>{ui.label}</span>
      </div>


      <div className="mt-3 space-y-1.5 text-sm">
        <p className="flex gap-2 text-gray-900">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1E3FCE]" aria-hidden />
          <span className="min-w-0 break-words">{b.pickup_address}</span>
        </p>
        {showDrop && (
          <p className="flex gap-2 text-gray-900">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-gray-900" aria-hidden />
            <span className="min-w-0 break-words">{b.dropoff_address}</span>
          </p>
        )}
      </div>


      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <div className="min-w-0">
          {price !== null && <p className="text-base font-extrabold text-[#1E3FCE]">{money(price)}</p>}
          {name && active && <p className="truncate text-xs text-gray-500">{providerOf(b) === 'rider' ? 'Rider' : 'Collector'}: {name}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canCancel(b) && (
            <button onClick={() => onCancel(b)} className="rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-600 active:bg-red-50">
              Cancel
            </button>
          )}
          {!active && (
            <button onClick={() => onRebook(b)} className="rounded-full bg-[#1E3FCE] px-4 py-2 text-xs font-bold text-white">
              Book again
            </button>
          )}
        </div>
      </div>


      {(stops > 0 || notes || b.reference) && (
        <>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-500">
            {open ? 'Hide details' : 'Details'}
            <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <dl className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Reference</dt>
                <dd className="font-bold">{b.reference}</dd>
              </div>
              {stops > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Extra stops</dt>
                  <dd className="font-bold">{stops}</dd>
                </div>
              )}
              {notes && (
                <div>
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{notes}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}
    </article>
  );
}


interface ActivityTabProps {
  bookings: Booking[];
  loading: boolean;
  filter: 'active' | 'history';
  onFilter: (f: 'active' | 'history') => void;
  onCancel: (b: Booking) => void;
  onRebook: (b: Booking) => void;
  onBookNow: () => void;
}


export default function ActivityTab({ bookings, loading, filter, onFilter, onCancel, onRebook, onBookNow }: ActivityTabProps) {
  const activeList = bookings.filter(isActive);
  const historyList = bookings.filter((b) => !isActive(b));
  const list = filter === 'active' ? activeList : historyList;


  return (
    <div className="space-y-4 px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-extrabold text-gray-900">Activity</h1>


      <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Booking filter">
        {(
          [
            { id: 'active', label: 'Active', count: activeList.length },
            { id: 'history', label: 'History', count: historyList.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => onFilter(t.id)}
            className={`rounded-lg py-2.5 text-sm font-bold ${filter === t.id ? 'bg-white text-[#1E3FCE] shadow-sm' : 'text-gray-600'}`}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700">{t.count}</span>}
          </button>
        ))}
      </div>


      {loading && bookings.length === 0 ? (
        <div className="space-y-3" aria-label="Loading your bookings">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100" />
          ))}
          <div className="flex justify-center pt-1">
            <Spinner />
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            {filter === 'active' ? '🛵' : '🧾'}
          </p>
          <p className="mt-3 text-base font-extrabold text-gray-900">{filter === 'active' ? 'No active bookings' : 'No past bookings yet'}</p>
          <p className="mt-1 text-sm text-gray-500">{filter === 'active' ? 'Book a ride, send a parcel or schedule a pickup.' : 'Completed and cancelled bookings show up here.'}</p>
          <button onClick={onBookNow} className="mt-4 rounded-full bg-[#1E3FCE] px-6 py-3 text-sm font-extrabold text-white">
            Book now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <BookingCard key={b.reference} b={b} onCancel={onCancel} onRebook={onRebook} />
          ))}
        </div>
      )}
    </div>
  );
}


