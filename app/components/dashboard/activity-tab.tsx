'use client';

/**
 * app/components/dashboard/activity-tab.tsx
 *
 * Active and past bookings (data from GET booking/ via the dashboard).
 * Nothing here calculates a price: amounts are shown exactly as the backend sent them.
 *
 * Exports used by customer-dashboard/page.tsx: default ActivityTab, isActive, statusUi, cancelMessage.
 * Imports only names that exist in lib/rydnow/config.ts, lib/rydnow/api.ts and ./ui.
 */

import Image from 'next/image';
import { useState } from 'react';

import type { Booking, ServiceKey } from '@/lib/rydnow/api';
import {
  BOOKING_STATUS_LABELS,
  CUSTOMER_CANCELLABLE_STATUSES,
  PAYMENT_LABEL,
  SEARCH_WINDOW_SECONDS,
  SERVICE_HINTS,
  SERVICE_LABELS,
  isActiveBooking,
  money,
  normalizeServiceKey,
  normalizeStatus,
  type BookingStatus,
} from '@/lib/rydnow/config';
import { Icon, RouteSummary, SERVICE_ICON, Spinner } from './ui';

// ─── Static copy (frontend only) ───
interface ServiceCopy {
  provider: string;
  providers: string;
  pickupLabel: string;
  dropoffLabel: string;
}

const SERVICE_COPY: Record<ServiceKey, ServiceCopy> = {
  okada: { provider: 'rider', providers: 'riders', pickupLabel: 'Pickup', dropoffLabel: 'Drop-off' },
  parcel: { provider: 'rider', providers: 'riders', pickupLabel: 'Pickup', dropoffLabel: 'Deliver to' },
  'waste-bin': { provider: 'collector', providers: 'collectors', pickupLabel: 'Collection point', dropoffLabel: '' },
};

const STEPS: ReadonlyArray<{ key: BookingStatus; label: string }> = [
  { key: 'pending', label: 'Finding' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'en-route', label: 'On the way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'completed', label: 'Done' },
];

const TONE = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-blue-200 bg-blue-50 text-[#1E3FCE]',
  green: 'border-green-200 bg-green-50 text-green-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-100 text-gray-700',
} as const;

// ─── Helpers ───
const serviceOf = (b: Booking): ServiceKey =>
  normalizeServiceKey(b.service_key) ?? normalizeServiceKey(b.service_type) ?? 'okada';

export const isActive = (b: Booking): boolean => isActiveBooking(normalizeStatus(b.status) ?? '');

export function statusUi(b: Booking): { label: string; tone: string; body: string } {
  const copy = SERVICE_COPY[serviceOf(b)];
  const name = b.rider?.name?.split(' ')[0] ?? `Your ${copy.provider}`;

  switch (normalizeStatus(b.status)) {
    case 'pending':
      return b.scheduled_for
        ? { label: 'Scheduled', tone: TONE.blue, body: `We’ll start looking for a ${copy.provider} before your pickup time.` }
        : {
            label: `Finding your ${copy.provider}`,
            tone: TONE.amber,
            body: `We’ve sent your booking to ${copy.providers} near you. This usually takes a few minutes.`,
          };
    case 'accepted':
      return { label: `${name} accepted`, tone: TONE.blue, body: 'They are getting ready to head to your pickup.' };
    case 'en-route':
      return { label: `${name} is on the way`, tone: TONE.blue, body: 'Keep your phone nearby in case they call.' };
    case 'arrived':
      return { label: `${name} has arrived`, tone: TONE.blue, body: 'They are at your pickup point now.' };
    case 'completed':
      return { label: 'Completed', tone: TONE.green, body: 'Thank you for using RYDNOW.' };
    case 'cancelled':
      return { label: 'Cancelled', tone: TONE.red, body: b.cancellation_reason || 'This booking was cancelled.' };
    case 'failed':
      return { label: 'Not completed', tone: TONE.red, body: 'You have not been charged for the trip. You can book again any time.' };
    default:
      return { label: 'Confirming', tone: TONE.gray, body: 'We’re confirming the details.' };
  }
}

/** Mirrors the backend cancellation terms: a fee applies only after a rider accepted and the grace window passed. */
export function cancelMessage(b: Booking): string {
  const key = serviceOf(b);
  const copy = SERVICE_COPY[key];
  const hints = SERVICE_HINTS[key];

  if (normalizeStatus(b.status) === 'pending') return `No ${copy.provider} has accepted yet, so cancelling is free.`;

  const minutes = b.accepted_at ? (Date.now() - Date.parse(b.accepted_at)) / 60_000 : 0;
  return minutes > hints.cancelGraceMinutes
    ? `Your ${copy.provider} accepted more than ${hints.cancelGraceMinutes} minutes ago, so a ${money(hints.cancelFeeAccepted)} fee applies. Anything you’ve already paid is refunded minus that fee.`
    : `Your ${copy.provider} accepted less than ${hints.cancelGraceMinutes} minutes ago, so cancelling is still free.`;
}

function payLine(b: Booking): string {
  const p = b.payment;
  if (!p) return '';
  const label = PAYMENT_LABEL[p.method] ?? p.method;
  if (p.method === 'cash') return 'Pay in cash when the trip ends';
  if (p.status === 'paid') return `Paid with ${label}`;
  if (p.status === 'pending') return `Waiting for your ${label} payment`;
  return `${label}: ${p.status.replace(/_/g, ' ')}`;
}

const vehicleLine = (v: NonNullable<Booking['rider']>['vehicle']): string =>
  v ? [v.color, v.model].filter(Boolean).join(' ') : '';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusName(raw: string): string {
  const s = normalizeStatus(raw);
  return s ? BOOKING_STATUS_LABELS[s] : raw;
}

// ─── Booking card ───
interface CardProps {
  booking: Booking;
  onCancel: (b: Booking) => void;
  onRebook: (b: Booking) => void;
}

function BookingCard({ booking: b, onCancel, onRebook }: CardProps) {
  const [open, setOpen] = useState(false);

  const key = serviceOf(b);
  const copy = SERVICE_COPY[key];
  const hints = SERVICE_HINTS[key];
  const ui = statusUi(b);
  const status = normalizeStatus(b.status);
  const live = isActive(b);
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === status));

  const searchingLong =
    status === 'pending' &&
    !b.scheduled_for &&
    Boolean(b.created_at) &&
    (Date.now() - Date.parse(b.created_at)) / 1000 > SEARCH_WINDOW_SECONDS;

  const points = [
    { label: copy.pickupLabel, text: b.pickup_address },
    ...b.stops.map((s, i) => ({ label: `Stop ${i + 1}`, text: s.address || 'Extra stop' })),
    ...(hints.requiresDestination ? [{ label: copy.dropoffLabel, text: b.dropoff_address }] : []),
  ];

  const pay = payLine(b);
  const canCancel = status !== null && CUSTOMER_CANCELLABLE_STATUSES.includes(status);
  const rider = b.rider;
  const vehicle = rider ? vehicleLine(rider.vehicle) : '';
  const detailsId = `details-${b.reference}`;

  return (
    <article className={`rounded-2xl border bg-white p-4 ${live ? 'border-blue-200 shadow-md' : 'border-gray-100 shadow-sm'}`}>
      <header className="mb-3 flex items-center gap-3">
        <Image src={SERVICE_ICON[key]} alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{SERVICE_LABELS[key]}</p>
          <p className="truncate text-xs text-gray-500">{formatDate(b.created_at)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${ui.tone}`}>{ui.label}</span>
      </header>

      {live && (
        <div className="mb-4">
          <ol className="grid grid-cols-5 gap-1.5" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s.key} className="grid justify-items-center gap-1.5 text-center" aria-current={i === stepIndex ? 'step' : undefined}>
                <span className={`h-1.5 w-full rounded-full ${i < stepIndex ? 'bg-[#1E3FCE]' : i === stepIndex ? 'bg-[#F5B82E]' : 'bg-gray-200'}`} />
                <span className={`text-[10px] leading-tight ${i <= stepIndex ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-gray-600">{ui.body}</p>
          {searchingLong && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
              It’s taking longer than usual to find a {copy.provider}. We’re still searching. You can keep waiting or cancel for free.
            </p>
          )}
        </div>
      )}

      <RouteSummary points={points} />

      {rider && live && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-50 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E3FCE] text-white">
            {rider.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rider.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="user" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[#1E3FCE]">Your {copy.provider}</p>
            <p className="truncate text-sm font-bold text-gray-900">{rider.name}</p>
            <p className="truncate text-xs text-gray-600">
              {[
                typeof rider.rating === 'number' ? `★ ${rider.rating.toFixed(1)}` : '',
                vehicle,
                rider.vehicle?.plate ?? '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {rider.phone && (
            <a
              href={`tel:${rider.phone}`}
              aria-label={`Call ${rider.name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-[#1E3FCE]"
            >
              <Icon name="phone" />
            </a>
          )}
        </div>
      )}

      {pay && <p className="mt-3 text-xs text-gray-500">{pay}</p>}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-lg font-extrabold text-[#1E3FCE]">{money(b.total_price)}</p>
          {b.discount_amount > 0 && <p className="text-[11px] font-bold text-green-700">You saved {money(b.discount_amount)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700"
          >
            {open ? 'Hide details' : 'Details'}
          </button>
          {canCancel && (
            <button type="button" onClick={() => onCancel(b)} className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600">
              Cancel
            </button>
          )}
          {!live && (
            <button type="button" onClick={() => onRebook(b)} className="rounded-lg bg-[#1E3FCE] px-4 py-2.5 text-xs font-bold text-white">
              Book again
            </button>
          )}
        </div>
      </footer>

      {open && (
        <div id={detailsId} className="mt-3 space-y-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
          <div>
            <p className="mb-1.5 font-bold text-gray-900">Booking {b.reference}</p>
            <dl className="space-y-1">
              <div className="flex justify-between gap-3">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(b.subtotal)}</dd>
              </div>
              {b.discount_amount > 0 && (
                <div className="flex justify-between gap-3 font-bold text-green-700">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">−{money(b.discount_amount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 font-bold text-gray-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(b.total_price)}</dd>
              </div>
            </dl>
          </div>

          {b.scheduled_for && <p>Scheduled for {formatDate(b.scheduled_for)}</p>}
          {b.notes && (
            <div>
              <p className="mb-1 font-bold text-gray-900">Your notes</p>
              <p className="whitespace-pre-line">{b.notes}</p>
            </div>
          )}

          {b.history.length > 0 && (
            <div>
              <p className="mb-1.5 font-bold text-gray-900">Timeline</p>
              <ol className="space-y-1.5 border-l border-gray-300 pl-3">
                {b.history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <span className="font-semibold text-gray-900">{statusName(h.status)}</span>
                    <span className="text-gray-500"> {formatDate(h.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Tab ───
type ActivityFilter = 'active' | 'history';

interface Props {
  bookings: Booking[];
  loading: boolean;
  filter: ActivityFilter;
  onFilter: (f: ActivityFilter) => void;
  onCancel: (b: Booking) => void;
  onRebook: (b: Booking) => void;
  onBookNow: () => void;
}

export default function ActivityTab({ bookings, loading, filter, onFilter, onCancel, onRebook, onBookNow }: Props) {
  const active = bookings.filter(isActive);
  const history = bookings.filter((b) => !isActive(b));
  const list = filter === 'active' ? active : history;

  return (
    <div className="px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h2 className="mb-4 text-xl font-extrabold text-gray-900">Your activity</h2>

      <div className="mb-5 grid grid-cols-2 rounded-xl bg-gray-200/70 p-1" role="tablist" aria-label="Booking filter">
        {(['active', 'history'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => onFilter(f)}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${filter === f ? 'bg-white text-[#1E3FCE] shadow-sm' : 'text-gray-600'}`}
          >
            {f === 'active' ? `Active${active.length ? ` (${active.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500" role="status">
          <Spinner /> Loading your bookings…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-14 text-center">
          <p className="mb-3 text-4xl" aria-hidden>
            {filter === 'active' ? '🛵' : '📋'}
          </p>
          <p className="font-bold text-gray-900">{filter === 'active' ? 'No active bookings' : 'No past bookings yet'}</p>
          <p className="mt-1 px-8 text-sm text-gray-500">
            {filter === 'active' ? 'Book a ride, delivery or waste pickup and track it here.' : 'Completed and cancelled bookings will appear here.'}
          </p>
          {filter === 'active' && (
            <button type="button" onClick={onBookNow} className="mt-5 rounded-xl bg-[#F5B82E] px-6 py-3 text-sm font-extrabold text-gray-900">
              Book now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((b) => (
            <BookingCard key={b.reference} booking={b} onCancel={onCancel} onRebook={onRebook} />
          ))}
        </div>
      )}
    </div>
  );
}

