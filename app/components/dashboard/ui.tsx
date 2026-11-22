'use client';

// components/dashboard/ui.tsx
// Shared presentational pieces for the customer dashboard.
// Inputs use text-base (16px) on purpose: iOS Safari zooms the page on focus for anything smaller,
// which is the main cause of the "screen shaking" on phones.

import { useEffect, type ReactNode } from 'react';
import type { ServiceKey } from '@/lib/rydnow/config';

export type ToastType = 'success' | 'error' | 'info';

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export const SERVICE_ICON: Record<ServiceKey, string> = {
  okada: '/okada-one.png',
  parcel: '/d.png',
  'waste-bin': '/binman.png',
};

export const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white p-3 text-base text-gray-900 outline-none focus:border-[#1E3FCE]';

const ICONS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  activity: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  user: ['M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  bell: ['M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7z', 'M10 20a2 2 0 0 0 4 0'],
  locate: ['M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', 'M12 2v3M12 19v3M2 12h3M19 12h3'],
  close: ['M6 6l12 12M18 6L6 18'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  chevron: ['M9 6l6 6-6 6'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 11a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z'],
  card: ['M3 6h18v12H3z', 'M3 10h18'],
  help: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7', 'M12 17h.01'],
  settings: ['M4 7h10M18 7h2M4 17h2M10 17h10', 'M16 5v4M8 15v4'],
  check: ['M5 12l5 5L20 7'],
  logout: ['M9 4H5v16h4', 'M16 8l4 4-4 4', 'M20 12H9'],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  gift: ['M20 12v9H4v-9', 'M2 7h20v5H2z', 'M12 7v14', 'M12 7c-2-4-6-3-5 0 .5 1.5 5 0 5 0z', 'M12 7c2-4 6-3 5 0-.5 1.5-5 0-5 0z'],
  tag: ['M3 12V4h8l10 10-8 8z', 'M7.5 8h.01'],
  copy: ['M9 9h11v11H9z', 'M5 15V4h11'],
  share: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 14v7h14v-7'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
};

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(ICONS[name] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function Spinner({ className = 'h-4 w-4', tone = 'blue' }: { className?: string; tone?: 'blue' | 'white' }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-2 ${className} ${
        tone === 'white' ? 'border-white/40 border-t-white' : 'border-gray-300 border-t-[#1E3FCE]'
      }`}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Bottom sheet. Render it OUTSIDE the scrolling <main> so touches never scroll the page behind it. */
export function Sheet({
  open,
  onClose,
  label,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={() => dismissible && onClose()}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ dialog, onClose }: { dialog: ConfirmState | null; onClose: () => void }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-base font-extrabold text-gray-900">{dialog.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{dialog.message}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700">
            Keep
          </button>
          <button
            onClick={() => {
              const run = dialog.onConfirm;
              onClose();
              run();
            }}
            className={`flex-1 rounded-xl py-3 text-sm font-bold text-white ${dialog.danger ? 'bg-red-600' : 'bg-[#1E3FCE]'}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pickup → stops → destination list used in the payment sheet and on activity cards. */
export function RouteSummary({ points }: { points: { label: string; text: string }[] }) {
  return (
    <ol>
      {points.map((p, i) => {
        const end = i === points.length - 1;
        const square = end && points.length > 1;
        return (
          <li key={`${p.label}-${i}`} className={`flex gap-3 ${end ? '' : 'pb-3'}`}>
            <span className="flex w-3 shrink-0 flex-col items-center pt-1.5" aria-hidden>
              <span
                className={`h-2.5 w-2.5 shrink-0 ${
                  i === 0 ? 'rounded-full bg-[#1E3FCE]' : square ? 'rounded-[2px] bg-gray-900' : 'rounded-full bg-gray-400'
                }`}
              />
              {!end && <span className="mt-1 w-px flex-1 bg-gray-300" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-gray-500">{p.label}</span>
              <span className="block break-words text-sm font-semibold text-gray-900">{p.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
