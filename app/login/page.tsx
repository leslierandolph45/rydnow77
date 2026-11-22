'use client';

import { useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '/api/rydnow'
) 
const LOGIN_URL = `${API_BASE}/auth/login/`;
const REQUEST_TIMEOUT_MS = 60000; // Render free instances can take ~50s to wake up

const BRAND = {
  navy: '#0A2342',
  deep: '#071B32',
  blue: '#0F52BA',
  sky: '#3B82F6',
  gold: '#F2A900',
  success: '#10B981',
} as const;

const ROUTES = {
  // Original pointed "Back" at /customer-signup. The signup choice page is
  // where people arrive from, so Back now goes there. Change if you prefer.
  back: '/signup',
  createAccount: '/customer-signup',
  afterLogin: '/customer-dashboard',
} as const;

// ─── HELPERS ─────────────────────────────────────────────────────
/** Walks any nested error shape and returns readable messages. */
function flatten(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(flatten);
  return [];
}

/** Handles {error}, {detail}, DRF {non_field_errors:[...]}, and {field:[...]} responses. */
function extractError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  for (const k of ['error', 'detail', 'message', 'non_field_errors']) {
    const msgs = flatten(obj[k]);
    if (msgs.length) return msgs.join(' ');
  }
  const rest = flatten(obj);
  return rest.length ? rest.join(' ') : fallback;
}

function safeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage full */
  }
}

// ─── ICONS ───────────────────────────────────────────────────────
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const icons = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6M12 17h.01" />
    </>
  ),
} as const;

function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof icons; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      {icons[name]}
    </svg>
  );
}

function Logo({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black italic leading-none tracking-tighter ${
        large ? 'text-[clamp(2rem,9vw,2.6rem)]' : 'text-[clamp(1.4rem,6vw,1.75rem)]'
      }`}
    >
      <span className="text-white">RYD</span>
      <span style={{ color: BRAND.gold }}>NOW</span>
      <svg viewBox="0 0 24 24" className="h-[0.7em] w-[0.7em]" fill={BRAND.gold} aria-hidden>
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    </span>
  );
}

function Field({
  label,
  icon,
  trailing,
  children,
}: {
  label: string;
  icon: keyof typeof icons;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-200">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-slate-600/70 bg-[#13294B] px-4 transition focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-[#3B82F6]/25">
        <span className="text-slate-400">
          <Icon name={icon} />
        </span>
        {children}
        {trailing}
      </span>
    </label>
  );
}

const inputCls =
  'w-full min-w-0 bg-transparent py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none';

// ─── PAGE ────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const slowTimer = setTimeout(() => setSlow(true), 5000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let success = false;

    try {
      const identifier = formData.username.trim();

      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          username: identifier,
          password: formData.password,
        }),
      });

      // Tolerate non-JSON responses (e.g. a server error page).
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data: any = isJson ? await res.json().catch(() => null) : null;

      // Shows the exact backend payload in DevTools > Console while you debug.
      if (!res.ok) console.error('Login response', res.status, data);

      if (!res.ok) {
        if (!isJson) {
          throw new Error(
            res.status >= 500
              ? 'Our server is having a problem. Please try again in a moment.'
              : 'Could not reach the login service. Please try again.'
          );
        }
        throw new Error(extractError(data, 'Login failed. Please check your credentials and try again.'));
      }

      const token: string | undefined = data?.token || data?.key || data?.access;
      if (!token) {
        console.error('Login succeeded but no token in response:', data);
        throw new Error('Login failed: the server did not return a session token.');
      }

      // The standard DRF token endpoint returns only {token}, so fall back gracefully if there is no user object.
      const user = data?.user ?? { username: identifier };

      // Saved in both formats so the dashboard can find it.
      safeStore('rydnow_token', token);
      safeStore('rydnow_username', user.username ?? identifier);
      safeStore('authtoken', token);
      safeStore('currentUser', JSON.stringify(user));

      success = true;
      router.push(ROUTES.afterLogin);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The server is taking too long to respond. Please try again in a minute.');
      } else if (err instanceof TypeError) {
        setError('Cannot reach the server. Check your connection and try again.');
      } else {
        setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setSlow(false);
      // Keep the button disabled while redirecting so it can't be tapped twice.
      if (!success) setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] font-sans"
      style={{
        background: `radial-gradient(120% 55% at 50% 0%, #12306A 0%, ${BRAND.navy} 45%, ${BRAND.deep} 100%)`,
      }}
    >
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-5"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* top bar */}
        <header className="flex items-center justify-between py-2">
          <Link
            href={ROUTES.back}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} strokeWidth={2.5} aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <span className="w-10" aria-hidden />
        </header>

        {/* brand block */}
        <section className="mt-3 text-center">
          <Link href="/" aria-label="RYDNOW home" className="inline-block">
            <Logo large />
          </Link>
          <p className="mt-2 text-sm font-extrabold tracking-tight text-slate-200">Fast. Safe. Reliable.</p>

          {/* vector: shield + bolt */}
          <svg viewBox="0 0 120 120" className="mx-auto mt-4 h-[clamp(5rem,26vw,6.5rem)] w-[clamp(5rem,26vw,6.5rem)]" aria-hidden>
            <circle cx="60" cy="60" r="56" fill={BRAND.blue} opacity="0.25" />
            <circle cx="60" cy="60" r="42" fill={BRAND.blue} opacity="0.2" />
            <path d="M60 18 28 30v28c0 22 14 38 32 44 18-6 32-22 32-44V30L60 18z" fill={BRAND.navy} stroke={BRAND.sky} strokeWidth="3" strokeLinejoin="round" />
            <path d="M66 36 46 64h12l-4 20 20-30H62l4-18z" fill={BRAND.gold} />
            <circle cx="98" cy="28" r="2.5" fill="#fff" opacity="0.8" />
            <path d="M20 90l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.8" />
          </svg>
        </section>

        {/* form card */}
        <main className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <h1 className="text-[clamp(1.4rem,7vw,1.8rem)] font-black leading-tight tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mb-5 mt-1 text-[0.95rem] text-slate-300">Sign in to book rides and track deliveries.</p>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-sm text-red-200"
            >
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Username or email" icon="user">
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Your username or email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className={inputCls}
              />
            </Field>

            <Field
              label="Password"
              icon="lock"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="-mr-2 rounded-lg p-2 text-slate-400 active:text-white"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className={inputCls}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: BRAND.gold, boxShadow: `0 10px 24px -10px ${BRAND.gold}99` }}
            >
              {loading && (
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {slow && (
              <p className="text-center text-sm text-slate-400" role="status">
                Waking up the server… this can take up to a minute.
              </p>
            )}
          </form>
        </main>

        {/* footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-slate-400">
            New to RYDNOW?{' '}
            <Link href={ROUTES.createAccount} className="font-bold" style={{ color: BRAND.gold }}>
              Create an account
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

