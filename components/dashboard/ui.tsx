'use client';


/**
 * Shared UI primitives for the RYDNOW dashboards.
 * Location: components/dashboard/ui.tsx
 *
 * Exports: Icon, Spinner, Sheet, ConfirmDialog, RouteSummary, inputCls, ConfirmState, ToastType
 */


import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';


// ═══ Types ═══


export type ToastType = 'success' | 'error' | 'info';


export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}


// ═══ Shared classes ═══


/** Standard text input / textarea styling. */
export const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:border-[#1E3FCE] focus:outline-none focus:ring-2 focus:ring-[#1E3FCE]/20 disabled:bg-gray-50 disabled:text-gray-400';


// ═══ Icon ═══


const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  user: (
    <>
      <path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 2v13" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  locate: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
};


/** Stroke icon set. Unknown names render a neutral dot so a typo never crashes the page. */
export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name] ?? <circle cx="12" cy="12" r="2" />}
    </svg>
  );
}


// ═══ Spinner ═══


export function Spinner({ className = 'h-5 w-5', tone = 'brand' }: { className?: string; tone?: 'brand' | 'white' | 'gray' }) {
  const color = tone === 'white' ? 'text-white' : tone === 'gray' ? 'text-gray-500' : 'text-[#1E3FCE]';
  return (
    <svg className={`animate-spin ${color} ${className}`} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}


// ═══ Sheet (bottom sheet) ═══


interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Set false to block closing (e.g. while a request is in flight). Default true. */
  dismissible?: boolean;
  children: ReactNode;
}


const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';


export function Sheet({ open, onClose, label, dismissible = true, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);


  // Mount, then animate in. Animate out, then unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);


  // Focus handling + Escape + focus trap.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();


    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };


    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.();
    };
  }, [open, dismissible, onClose]);


  if (!mounted) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pt-3 shadow-2xl outline-none transition-transform duration-200 ease-out ${
          shown ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
        {children}
      </div>
    </div>
  );
}


// ═══ ConfirmDialog ═══


export function ConfirmDialog({ dialog, onClose }: { dialog: ConfirmState | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);


  // Keep the last dialog around so the content does not vanish mid-close.
  const last = useRef<ConfirmState | null>(null);
  if (dialog) last.current = dialog;
  const d = dialog ?? last.current;
  const open = !!dialog;


  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);


  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);


  const run = useCallback(async () => {
    if (!dialog || busy) return;
    setBusy(true);
    try {
      await dialog.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  }, [dialog, busy, onClose]);


  if (!open || !d) return null;


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={d.title} className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-extrabold text-gray-900">{d.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{d.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 disabled:opacity-50"
          >
            {d.cancelLabel ?? 'Keep'}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 ${
              d.danger ? 'bg-red-600' : 'bg-[#1E3FCE]'
            }`}
          >
            {busy && <Spinner tone="white" className="h-4 w-4" />}
            {d.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══ RouteSummary ═══


export interface RoutePoint {
  label: string;
  text: string;
}


/** Vertical pickup -> stops -> destination list used in the pay sheet. */
export function RouteSummary({ points }: { points: RoutePoint[] }) {
  if (points.length === 0) return null;
  return (
    <ol className="space-y-0" aria-label="Trip route">
      {points.map((p, i) => {
        const first = i === 0;
        const last = i === points.length - 1;
        const dot = first
          ? 'rounded-full bg-[#1E3FCE]'
          : last
            ? 'rounded-[2px] bg-gray-900'
            : 'rounded-full border-2 border-gray-400 bg-white';
        return (
          <li key={`${p.label}-${i}`} className="flex gap-3">
            <div className="relative w-3 shrink-0" aria-hidden>
              {points.length > 1 && (
                <span className={`absolute left-1/2 w-px -translate-x-1/2 bg-gray-300 ${first ? 'top-2.5 bottom-0' : last ? 'top-0 h-2.5' : 'inset-y-0'}`} />
              )}
              <span className={`absolute left-1/2 top-2.5 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 ${dot}`} />
            </div>
            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-3'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{p.label}</p>
              <p className="text-sm font-medium leading-snug text-gray-900">{p.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}


