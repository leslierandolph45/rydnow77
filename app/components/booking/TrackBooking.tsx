'use client';

/**
 * app/components/booking/TrackBooking.tsx
 *
 * Shows one booking live: status, progress, rider, route, payment and history.
 * Data comes from api.booking.detail() and refreshes every few seconds while the booking is active.
 * Nothing is calculated here: totals, statuses and rider details are exactly what the backend sends.
 * Tailwind only (no CSS module). Props are unchanged from the previous version.
 *
 * Usage:
 *   <TrackBooking reference={ref} onBack={...} onRebook={rebook} onCancelled={reload} onUnauthorized={signOut} />
 *
 * The parent must give this component a height (it fills its parent with h-full).
 */

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, friendlyError, isApiError, type Booking, type ServiceKey } from '@/lib/rydnow/api';
import {
  BOOKING_STATUS_LABELS,
  CUSTOMER_CANCELLABLE_STATUSES,
  ONLINE_PAYMENT_METHODS,
  PAYMENT_LABEL,
  SERVICE_HINTS,
  SERVICE_LABELS,
  money,
  normalizeServiceKey,
  normalizeStatus,
  type BookingStatus,
} from '@/lib/rydnow/config';

import { cancelMessage, isActive, statusUi } from '@/app/components/dashboard/activity-tab';
import { ConfirmDialog, Icon, RouteSummary, SERVICE_ICON, Spinner, type ConfirmState } from '@/app/components/dashboard/ui';

// ═══ 1. SETTINGS ═══

const POLL_MS = 5_000;
const STAGES = ['Requested', 'Accepted', 'On the way', 'Arrived', 'Done'] as const;
const LAST_STAGE = STAGES.length - 1;

export interface TrackBookingProps {
  /** Booking reference, e.g. Booking.reference. */
  reference: string;
  /** Shows a back button in the header when provided. */
  onBack?: () => void;
  /** Shown as "Book again" once the booking has finished or been cancelled. */
  onRebook?: (booking: Booking) => void;
  /** Called after a successful cancellation, so the parent can refresh its list. */
  onCancelled?: (booking: Booking) => void;
  /** Called when the API says the session is gone. Must be stable (useCallback). */
  onUnauthorized?: () => void;
}

const COPY: Record<ServiceKey, { provider: string; pickupLabel: string; dropoffLabel: string }> = {
  okada: { provider: 'rider', pickupLabel: 'Pickup', dropoffLabel: 'Drop-off' },
  parcel: { provider: 'rider', pickupLabel: 'Pickup', dropoffLabel: 'Deliver to' },
  'waste-bin': { provider: 'collector', pickupLabel: 'Collection point', dropoffLabel: '' },
};

// ═══ 2. HELPERS ═══

const serviceOf = (b: Booking): ServiceKey =>
  normalizeServiceKey(b.service_key) ?? normalizeServiceKey(b.service_type) ?? 'okada';

/** Progress step for a status, or 'ended' for cancelled / failed. */
function stageOf(status: BookingStatus | null): number | 'ended' {
  switch (status) {
    case 'cancelled':
    case 'failed':
      return 'ended';
    case 'accepted':
      return 1;
    case 'en-route':
      return 2;
    case 'arrived':
      return 3;
    case 'completed':
      return LAST_STAGE;
    default:
      return 0; // draft, pending, unknown
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

const humanize = (value: string) => {
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

const statusName = (raw: string) => {
  const s = normalizeStatus(raw);
  return s ? BOOKING_STATUS_LABELS[s] : humanize(raw);
};

function paymentTone(status: string): string {
  if (status === 'paid') return 'bg-green-100 text-green-800';
  if (status === 'failed' || status === 'cancelled') return 'bg-red-100 text-red-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

function heroCopy(b: Booking, stage: number | 'ended', provider: string): { title: string; sub: string } {
  if (stage === 'ended') {
    const cancelled = normalizeStatus(b.status) === 'cancelled';
    return {
      title: cancelled ? 'Booking cancelled' : 'Booking not completed',
      sub: b.cancellation_reason || 'This booking is closed. You can book again any time.',
    };
  }
  if (b.scheduled_for && stage === 0) {
    const when = formatWhen(b.scheduled_for);
    return { title: 'Booking scheduled', sub: when ? `We’ll find your ${provider} for ${when}.` : `We’ll find your ${provider} before your pickup time.` };
  }
  const first = b.rider?.name?.split(' ')[0];
  switch (stage) {
    case 0:
      return { title: `Finding your ${provider}`, sub: 'This usually takes a few minutes. You can cancel for free until someone accepts.' };
    case 1:
      return { title: `${first ?? `Your ${provider}`} accepted`, sub: 'They’re getting ready to head to your pickup.' };
    case 2:
      return { title: `Your ${provider} is on the way`, sub: 'Keep your phone nearby in case they call.' };
    case 3:
      return { title: `Your ${provider} has arrived`, sub: 'They’re at your pickup point now.' };
    default:
      return { title: 'All done', sub: 'Thanks for choosing RYDNOW.' };
  }
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

// ═══ 3. DATA HOOK ═══

/** Loads one booking and polls while it is active and the tab is visible. `onUnauthorized` must be stable. */
function useBooking(reference: string, onUnauthorized?: () => void) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await api.booking.detail(reference);
      if (!alive.current) return;
      setBooking(next);
      setError('');
      setNotFound(false);
    } catch (e) {
      if (!alive.current) return;
      if (isApiError(e) && e.status === 401) return onUnauthorized?.();
      if (isApiError(e) && e.status === 404) return setNotFound(true);
      setError(friendlyError(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [reference, onUnauthorized]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    setBooking(null);
    setNotFound(false);
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const active = booking ? isActive(booking) : false;

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, load]);

  return { booking, loading, error, notFound, active, reload: load };
}

// ═══ 4. TRACK BOOKING ═══

function Section({ label, title, aside, children }: { label: string; title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h3 className="text-sm font-extrabold text-gray-900">{title}</h3> : <span />}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export default function TrackBooking({ reference, onBack, onRebook, onCancelled, onUnauthorized }: TrackBookingProps) {
  const handleUnauthorized = useCallback(() => onUnauthorized?.(), [onUnauthorized]);
  const { booking, loading, error, notFound, active, reload } = useBooking(reference, handleUnauthorized);

  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const [paying, setPaying] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verified = useRef(false);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  // Back from the hosted Paystack page: Paystack appends ?reference=... (or ?trxref=...). Verify once, then refresh.
  useEffect(() => {
    if (verified.current || typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('reference') || q.get('trxref');
    if (!ref) return;
    verified.current = true;
    api.payments
      .verify(ref)
      .catch(() => undefined)
      .finally(() => void reload());
  }, [reload]);

  const key = booking ? serviceOf(booking) : null;
  const copy = key ? COPY[key] : null;
  const hints = key ? SERVICE_HINTS[key] : null;
  const status = booking ? normalizeStatus(booking.status) : null;
  const stage = stageOf(status);
  const canCancel = status !== null && CUSTOMER_CANCELLABLE_STATUSES.includes(status);

  const payment = booking?.payment ?? null;
  const needsPayment =
    !!booking && active && !!payment && ONLINE_PAYMENT_METHODS.includes(payment.method) && payment.status === 'pending';

  const points = useMemo(() => {
    if (!booking || !copy || !hints) return [];
    return [
      { label: copy.pickupLabel, text: booking.pickup_address },
      ...booking.stops.filter((s) => s.address).map((s, i) => ({ label: `Stop ${i + 1}`, text: s.address })),
      ...(hints.requiresDestination && booking.dropoff_address ? [{ label: copy.dropoffLabel, text: booking.dropoff_address }] : []),
    ].filter((p) => p.text);
  }, [booking, copy, hints]);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function askCancel() {
    if (!booking) return;
    setActionError('');
    setDialog({
      title: 'Cancel this booking?',
      message: cancelMessage(booking),
      confirmLabel: 'Cancel booking',
      danger: true,
      onConfirm: async () => {
        try {
          await api.booking.cancel(booking.reference, 'Cancelled by customer');
          await reload();
          onCancelled?.(booking);
        } catch (e) {
          if (isApiError(e) && e.status === 401) return handleUnauthorized();
          setActionError(friendlyError(e));
        }
      },
    });
  }

  async function payNow() {
    if (!booking || paying) return;
    setPaying(true);
    setActionError('');
    try {
      const init = await api.payments.initialize({ purpose: 'booking', booking_ref: booking.reference });
      const url = init.authorization_url || init.payment_url;
      if (!url) {
        setActionError('We couldn’t open the payment page. Please try again.');
        setPaying(false);
        return;
      }
      window.location.assign(url);
    } catch (e) {
      if (isApiError(e) && e.status === 401) return handleUnauthorized();
      setActionError(friendlyError(e));
      setPaying(false);
    }
  }

  // ─── header ───
  const header = (
    <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 disabled:opacity-0"
      >
        <BackIcon />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-extrabold leading-tight text-gray-900">Track booking</h2>
        <p className="truncate text-xs text-gray-500">{key ? SERVICE_LABELS[key] : 'Loading…'}</p>
      </div>
      <button
        type="button"
        onClick={copyReference}
        aria-label={`Copy booking reference ${reference}`}
        className="flex max-w-[44%] shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700"
      >
        <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{copied ? 'Copied' : reference}</span>
      </button>
    </header>
  );

  // ─── loading / not found / error ───
  if (loading && !booking) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-gray-50">
        {header}
        <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading your booking">
          <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!booking || !key || !copy || !hints) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-gray-50">
        {header}
        <div className="p-4">
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center" role={notFound ? undefined : 'alert'}>
            <h3 className="font-extrabold text-gray-900">{notFound ? 'We couldn’t find that booking' : 'We couldn’t load this booking'}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {notFound ? 'Check the reference, or open it from your Activity list.' : error || 'Check your connection and try again.'}
            </p>
            {notFound ? (
              onBack && (
                <button type="button" onClick={onBack} className="mt-5 rounded-xl bg-[#1E3FCE] px-6 py-3 text-sm font-extrabold text-white">
                  Go to Activity
                </button>
              )
            ) : (
              <button type="button" onClick={() => void reload()} className="mt-5 rounded-xl bg-[#1E3FCE] px-6 py-3 text-sm font-extrabold text-white">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── loaded ───
  const ui = statusUi(booking);
  const hero = heroCopy(booking, stage, copy.provider);
  const ended = stage === 'ended';
  const done = stage === LAST_STAGE;
  const rider = booking.rider;
  const history = [...booking.history].filter((h) => h.status).reverse();
  const vehicle = rider?.vehicle ? [rider.vehicle.color, rider.vehicle.model].filter(Boolean).join(' ') : '';
  const riderMeta = rider
    ? [
        typeof rider.rating === 'number' ? `★ ${rider.rating.toFixed(1)}` : '',
        rider.completed_trips ? `${rider.completed_trips} trips` : '',
        vehicle,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gray-50 text-gray-900">
      {header}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
        {/* Status + progress */}
        <section
          aria-live="polite"
          className={`rounded-2xl border p-5 ${ended ? 'border-red-200 bg-red-50' : done ? 'border-green-200 bg-green-50' : 'border-blue-100 bg-white shadow-md'}`}
        >
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold ${ui.tone}`}>
            {active && (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
            )}
            {ui.label}
          </span>
          <h3 className="mt-3 text-xl font-extrabold leading-snug text-gray-900">{hero.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{hero.sub}</p>

          {!ended && (
            <ol className="mt-5 grid grid-cols-5 gap-1.5" aria-label="Booking progress">
              {STAGES.map((label, i) => {
                const reached = typeof stage === 'number' && i < stage;
                const current = stage === i;
                return (
                  <li key={label} className="grid justify-items-center gap-1.5 text-center" aria-current={current ? 'step' : undefined}>
                    <span className={`h-1.5 w-full rounded-full ${reached || (done && current) ? 'bg-[#1E3FCE]' : current ? 'bg-[#F5B82E]' : 'bg-gray-200'}`} />
                    <span className={`text-[10px] leading-tight ${reached || current ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {error && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3" role="alert">
            <p className="min-w-0 flex-1 text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void reload()} className="shrink-0 py-1 text-sm font-bold text-red-700 underline">
              Retry
            </button>
          </div>
        )}
        {actionError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {actionError}
          </p>
        )}

        {/* Payment still needed */}
        {needsPayment && (
          <section className="rounded-2xl border-2 border-[#F5B82E] bg-amber-50/60 p-4" aria-label="Payment needed">
            <p className="text-sm font-extrabold text-gray-900">Finish your payment</p>
            <p className="mt-1 text-xs text-gray-600">
              Your {copy.provider} is contacted once your {payment ? PAYMENT_LABEL[payment.method] : ''} payment goes through.
            </p>
            <button
              type="button"
              onClick={payNow}
              disabled={paying}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3FCE] py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {paying && <Spinner tone="white" />}
              Pay {money(booking.total_price)}
            </button>
          </section>
        )}

        {/* Rider */}
        {!ended && (
          <Section label={`Your ${copy.provider}`}>
            {rider ? (
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E3FCE] text-lg font-extrabold text-white" aria-hidden>
                  {rider.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rider.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (rider.name[0] ?? '?').toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500">Your {copy.provider}</p>
                  <p className="truncate text-sm font-bold text-gray-900">{rider.name}</p>
                  {riderMeta && <p className="truncate text-xs text-gray-600">{riderMeta}</p>}
                  {rider.vehicle?.plate && (
                    <span className="mt-1 inline-block rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-gray-800">
                      {rider.vehicle.plate}
                    </span>
                  )}
                </div>
                {rider.phone && !done && (
                  <a
                    href={`tel:${rider.phone}`}
                    aria-label={`Call ${rider.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-lg"
                  >
                    <span aria-hidden>📞</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Spinner className="h-4 w-4" />
                </span>
                <span>You’ll see your {copy.provider}’s name, photo and number as soon as they accept.</span>
              </div>
            )}
          </Section>
        )}

        {/* Trip */}
        <Section
          label="Trip"
          aside={booking.created_at ? <span className="text-xs text-gray-500">{formatWhen(booking.created_at)}</span> : undefined}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <Image src={SERVICE_ICON[key]} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="text-sm font-bold text-gray-900">{SERVICE_LABELS[key]}</span>
          </div>
          <RouteSummary points={points} />
          {booking.scheduled_for && <p className="mt-3 text-xs text-gray-600">Scheduled for {formatWhen(booking.scheduled_for)}</p>}
          {booking.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{booking.notes}</p>}
        </Section>

        {/* Payment */}
        <Section
          label="Payment"
          title="Payment"
          aside={
            payment?.status ? (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paymentTone(payment.status)}`}>{humanize(payment.status)}</span>
            ) : undefined
          }
        >
          <dl className="space-y-1.5 text-sm">
            {payment?.method && (
              <div className="flex justify-between gap-3 text-gray-700">
                <dt>Method</dt>
                <dd>{PAYMENT_LABEL[payment.method] ?? humanize(payment.method)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-gray-700">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{money(booking.subtotal)}</dd>
            </div>
            {booking.discount_amount > 0 && (
              <div className="flex justify-between gap-3 font-bold text-green-700">
                <dt>Promo discount</dt>
                <dd className="tabular-nums">−{money(booking.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-gray-100 pt-2 text-base font-extrabold text-gray-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(booking.total_price)}</dd>
            </div>
          </dl>
        </Section>

        {/* History */}
        {history.length > 0 && (
          <Section label="Booking history" title="History">
            <ol className="space-y-3 border-l border-gray-200 pl-4">
              {history.map((h, i) => (
                <li key={`${h.status}-${h.at}-${i}`} className="relative">
                  <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-[#1E3FCE]' : 'bg-gray-300'}`} aria-hidden />
                  <p className="text-sm font-bold text-gray-900">{statusName(h.status)}</p>
                  {h.notes && <p className="text-xs text-gray-600">{h.notes}</p>}
                  {h.at && <p className="text-[11px] text-gray-500">{formatWhen(h.at)}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {canCancel && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-gray-700">
            Cancel free until a {copy.provider} accepts. After that, free for {hints.cancelGraceMinutes} minutes, then a small fee of {money(hints.cancelFeeAccepted)}.
          </p>
        )}
      </div>

      {/* Footer is part of the layout, so it can never cover content */}
      {(canCancel || (!active && onRebook)) && (
        <footer className="flex shrink-0 gap-3 border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {canCancel && (
            <button type="button" onClick={askCancel} className="flex-1 rounded-2xl border border-red-200 bg-white py-4 text-[15px] font-extrabold text-red-600">
              Cancel booking
            </button>
          )}
          {!active && onRebook && (
            <button type="button" onClick={() => onRebook(booking)} className="flex-1 rounded-2xl bg-[#1E3FCE] py-4 text-[15px] font-extrabold text-white shadow-xl">
              Book again
            </button>
          )}
        </footer>
      )}

      <ConfirmDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

