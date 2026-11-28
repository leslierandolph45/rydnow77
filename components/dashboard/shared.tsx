'use client';


/**
 * Shared UI primitives for the customer dashboard:
 * Icon, Sheet (bottom sheet), Spinner, ConfirmDialog, RouteSummary, inputCls.
 */


import { useEffect, useState, type ReactNode } from 'react';


export type ToastType = 'info' | 'success' | 'error';


export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}


/** Shared text-input styling. */
export const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-[#1E3FCE] focus:outline-none focus:ring-4 focus:ring-[#1E3FCE]/15 disabled:opacity-60 aria-[invalid=true]:border-red-400';


// ─── Icons ───
const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12 5 5 9-10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v9H5v-9" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
};


export function Icon({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}


// ─── Spinner ───
export function Spinner({ className = 'h-5 w-5', tone = 'blue' }: { className?: string; tone?: 'blue' | 'white' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin ${tone === 'white' ? 'text-white' : 'text-[#1E3FCE]'}`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}


// ─── Bottom sheet ───
interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  /** false while something is in flight: blocks Escape and backdrop taps. */
  dismissible?: boolean;
  children: ReactNode;
}


export function Sheet({ open, onClose, label, dismissible = true, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);


  if (!open) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => dismissible && onClose()} />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
        {children}
      </div>
    </div>
  );
}


// ─── Confirm dialog ───
export function ConfirmDialog({ dialog, onClose }: { dialog: ConfirmState | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, busy, onClose]);


  if (!dialog) return null;


  const run = async () => {
    setBusy(true);
    try {
      await dialog.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
      <button type="button" aria-label="Dismiss" tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-extrabold text-gray-900">{dialog.title}</h3>
        <p className="mt-2 text-sm text-gray-600">{dialog.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700 disabled:opacity-50">
            Keep it
          </button>
          <button
            onClick={run}
            disabled={busy}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 ${dialog.danger ? 'bg-red-600' : 'bg-[#1E3FCE]'}`}
          >
            {busy && <Spinner tone="white" className="h-4 w-4" />}
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Route summary (pickup -> stops -> destination) ───
export function RouteSummary({ points }: { points: { label: string; text: string }[] }) {
  return (
    <ol className="space-y-3">
      {points.map((p, i) => {
        const first = i === 0;
        const last = i === points.length - 1;
        return (
          <li key={`${p.label}-${i}`} className="flex gap-3">
            <span className="relative mt-1 flex w-3 shrink-0 justify-center" aria-hidden>
              {!last && <span className="absolute left-1/2 top-3 h-[calc(100%+0.75rem)] w-px -translate-x-1/2 bg-gray-300" />}
              <span className={`relative h-2.5 w-2.5 ${first ? 'rounded-full bg-[#1E3FCE]' : last ? 'rounded-[2px] bg-gray-900' : 'rounded-full border-2 border-gray-400 bg-white'}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{p.label}</span>
              <span className="block text-sm font-medium text-gray-900">{p.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}


