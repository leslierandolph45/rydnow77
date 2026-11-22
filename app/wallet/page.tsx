'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../app/components/dashboard/hooks.ts';


/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rydnow-backend.onrender.com' ;
const TOKEN_KEY = 'rydnow_token';

// TODO: set these once the backend endpoints exist. While null, the sheets
// validate the amount and then show a "not connected yet" notice.
const TOPUP_PATH: string | null = null;
const WITHDRAW_PATH: string | null = null;

const BRAND_BLUE = '#1E3FCE';
const BRAND_GOLD = '#F5B82E';

/* -------------------------------------------------------------------------- */
/*  Types (only fields your current page already reads)                       */
/* -------------------------------------------------------------------------- */

interface Wallet {
  balance?: number | string;
  available_balance?: number | string;
  [key: string]: unknown;
}

interface Transaction {
  id?: string | number;
  description?: string;
  kind?: string;
  direction?: string;
  amount?: number | string;
  created_at?: string;
  [key: string]: unknown;
}

type Filter = 'all' | 'in' | 'out';
type SheetMode = 'topup' | 'withdraw' | null;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const money = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

const formatMoney = (v: unknown) => {
  const n = Number(v);
  return money.format(Number.isFinite(n) ? n : 0);
};

/** Credit if direction says so; otherwise fall back to the sign of amount. */
function isCredit(tx: Transaction): boolean {
  if (tx.direction) return tx.direction.toLowerCase() === 'credit';
  return Number(tx.amount) > 0;
}

function dayLabel(iso?: string): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  Small UI pieces                                                           */
/* -------------------------------------------------------------------------- */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

function WalletSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading wallet">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-xl text-base font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        primary
          ? 'text-white focus-visible:ring-[#1E3FCE]'
          : 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus-visible:ring-gray-400'
      }`}
      style={primary ? { backgroundColor: BRAND_BLUE } : undefined}
    >
      {label}
    </button>
  );
}

function AmountSheet({
  mode,
  maxAmount,
  onClose,
}: {
  mode: Exclude<SheetMode, null>;
  maxAmount: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const isTopUp = mode === 'topup';
  const quick = isTopUp ? [10, 20, 50, 100] : [20, 50, 100];

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount.' });
      return;
    }
    if (!isTopUp && n > maxAmount) {
      setMessage({ type: 'error', text: 'That is more than your available balance.' });
      return;
    }
    const path = isTopUp ? TOPUP_PATH : WITHDRAW_PATH;
    if (!path) {
      setMessage({
        type: 'info',
        text: `${isTopUp ? 'Top-up' : 'Withdrawal'} isn't connected to the backend yet.`,
      });
      return;
    }
    // TODO: POST to `${API_URL}${path}` with { amount: n } and refresh the wallet.
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={isTopUp ? 'Top up wallet' : 'Withdraw funds'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isTopUp ? 'Top up wallet' : 'Withdraw funds'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {!isTopUp && (
          <p className="mb-3 text-sm text-gray-500">
            Available to withdraw: <span className="font-semibold text-gray-900">{formatMoney(maxAmount)}</span>
          </p>
        )}

        <label htmlFor="amount" className="sr-only">
          Amount in GHS
        </label>
        <div className="flex items-center rounded-xl border border-gray-300 px-4 focus-within:border-[#1E3FCE] focus-within:ring-2 focus-within:ring-[#1E3FCE]/20">
          <span className="font-semibold text-gray-500">GHS</span>
          <input
            id="amount"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ''));
              setMessage(null);
            }}
            placeholder="0.00"
            className="h-14 w-full bg-transparent pl-3 text-2xl font-bold outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setAmount(String(q));
                setMessage(null);
              }}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              {q}
            </button>
          ))}
          {!isTopUp && maxAmount > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(maxAmount))}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              Max
            </button>
          )}
        </div>

        {message && (
          <p
            role="alert"
            className={`mt-3 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-gray-600'}`}
          >
            {message.text}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          className="mt-5 h-14 w-full rounded-xl text-base font-semibold text-white active:scale-[0.99]"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          {isTopUp ? 'Continue to top up' : 'Request withdrawal'}
        </button>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const credit = isCredit(tx);
  const title = tx.description || (tx.kind ? titleCase(String(tx.kind)) : 'Transaction');

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
          credit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {credit ? '↓' : '↑'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">
          {timeLabel(tx.created_at)}
          {tx.kind && tx.description ? ` · ${titleCase(String(tx.kind))}` : ''}
        </p>
      </div>
      <p className={`shrink-0 font-bold tabular-nums ${credit ? 'text-green-600' : 'text-gray-900'}`}>
        {credit ? '+' : '−'}
        {formatMoney(Math.abs(Number(tx.amount)))}
      </p>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function WalletPage() {
  const { loading: authLoading, isAuthenticated, logout } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txWarning, setTxWarning] = useState(false);

  const [filter, setFilter] = useState<Filter>('all');
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<SheetMode>(null);

  const loadWallet = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      silent ? setRefreshing(true) : setLoading(true);
      setError(null);
      setTxWarning(false);

      const headers = {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      };

      try {
        const [walletRes, txRes] = await Promise.all([
          fetch(`${API_URL}/api/rider/wallet/`, { headers, signal }),
          fetch(`${API_URL}/api/rider/wallet/transactions/`, { headers, signal }),
        ]);

        if (walletRes.status === 401 || walletRes.status === 403) {
          logout();
          return;
        }
        if (!walletRes.ok) throw new Error('Failed to load wallet');

        setWallet(await walletRes.json());

        if (txRes.ok) {
          const data = await txRes.json();
          // Supports a plain array or a DRF paginated { results: [...] }
          setTransactions(Array.isArray(data) ? data : (data?.results ?? []));
        } else {
          setTxWarning(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Could not load wallet data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    void loadWallet(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadWallet]);

  /* ----------------------------- derived data ----------------------------- */

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((t) => (filter === 'in' ? isCredit(t) : !isCredit(t)));
  }, [transactions, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const key = dayLabel(tx.created_at);
      map.set(key, [...(map.get(key) ?? []), tx]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totals = useMemo(() => {
    let money_in = 0;
    let money_out = 0;
    for (const t of transactions) {
      const n = Math.abs(Number(t.amount)) || 0;
      isCredit(t) ? (money_in += n) : (money_out += n);
    }
    return { money_in, money_out };
  }, [transactions]);

  const available = Number(wallet?.available_balance ?? wallet?.balance ?? 0) || 0;
  const mask = (v: unknown) => (hidden ? 'GHS ••••' : formatMoney(v));

  /* -------------------------------- render -------------------------------- */

  if (authLoading || (isAuthenticated && loading && !wallet)) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <WalletSkeleton />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <p className="p-8 text-center text-gray-600">Please log in to view your wallet.</p>;
  }

  if (error && !wallet) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">We couldn&apos;t load your wallet</p>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button
          type="button"
          onClick={() => loadWallet()}
          className="mt-6 rounded-xl px-6 py-3 font-semibold text-white"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <button
          type="button"
          onClick={() => loadWallet(undefined, true)}
          disabled={refreshing}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* Balance card */}
      <section
        className="rounded-2xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #152C94 100%)` }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">Wallet balance</p>
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-pressed={hidden}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
          >
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>
        <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums">
          {mask(wallet?.balance ?? 0)}
        </p>
        {wallet?.available_balance !== undefined && (
          <p className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold text-gray-900" style={{ backgroundColor: BRAND_GOLD }}>
            Available {mask(wallet.available_balance)}
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ActionButton label="+ Top up" primary onClick={() => setSheet('topup')} />
        <ActionButton label="Withdraw" onClick={() => setSheet('withdraw')} />
      </div>

      {/* Summary */}
      {transactions.length > 0 && (
        <section className="mt-4 grid grid-cols-2 gap-3" aria-label="Activity summary">
          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-xs text-green-800">Money in</p>
            <p className="mt-1 font-bold text-green-700 tabular-nums">{mask(totals.money_in)}</p>
          </div>
          <div className="rounded-xl bg-gray-100 p-4">
            <p className="text-xs text-gray-600">Money out</p>
            <p className="mt-1 font-bold text-gray-900 tabular-nums">{mask(totals.money_out)}</p>
          </div>
        </section>
      )}

      {/* Activity */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
          <div className="flex gap-1 rounded-full bg-gray-100 p-1" role="tablist" aria-label="Filter transactions">
            {(
              [
                ['all', 'All'],
                ['in', 'In'],
                ['out', 'Out'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {txWarning && (
          <p className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your balance loaded, but we couldn&apos;t load recent activity.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-12 text-center">
            <p className="font-medium text-gray-900">
              {transactions.length === 0 ? 'No transactions yet' : 'Nothing to show for this filter'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {transactions.length === 0
                ? 'Complete a ride or delivery and your earnings will appear here.'
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([label, items]) => (
              <div key={label}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
                <ul className="divide-y divide-gray-100">
                  {items.map((tx, i) => (
                    <TransactionRow key={tx.id ?? `${tx.created_at}-${i}`} tx={tx} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {sheet && <AmountSheet mode={sheet} maxAmount={available} onClose={() => setSheet(null)} />}
    </main>
  );
}

