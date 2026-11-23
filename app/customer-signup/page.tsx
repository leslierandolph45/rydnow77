'use client';

import { useState, ReactNode } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Browser -> /api/rydnow/<path> -> Next.js proxy -> https://rydnow-backend.onrender.com/api/<path>
// Base has NO trailing slash and api() below strips stray slashes, so "//" can never appear.
const API_BASE = '/api/rydnow';
const api = (path: string) => `${API_BASE}/${path.replace(/^\/+/, '')}`;

// Tried in order. Only a 404 moves on to the next one.
const REGISTER_PATHS = ['/auth/register/customer/'];
const LOGIN_PATHS = ['auth/login/', 'auth/token/'];
const REQUEST_TIMEOUT_MS = 60000;

const LOGIN_ROUTE = '/login';
const DASHBOARD_ROUTE = '/customer-dashboard/'; // change if your dashboard lives elsewhere

const BRAND = {
  navy: '#0A2342',
  deep: '#071B32',
  blue: '#0F52BA',
  sky: '#3B82F6',
  gold: '#F2A900',
  success: '#10B981',
} as const;

const isValidGhanaNumber = (phone: string) => {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (/^0[2-9]\d{8}$/.test(cleaned)) return true;
  if (/^\+233[2-9]\d{8}$/.test(cleaned)) return true;
  if (/^[2-9]\d{8}$/.test(cleaned)) return true;
  return false;
};

const toInternational = (phone: string) => {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+233')) return cleaned;
  if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
  return `+233${cleaned}`;
};

const firstMessage = (v: unknown): string | null => {
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  if (typeof v === 'string' && v) return v;
  return null;
};

const saveSession = (token: string, user: Record<string, unknown>) => {
  const entries: [string, string][] = [
    ['rydnow_token', token],
    ['authtoken', token],
    ['authToken', token],
    ['rydnow_username', String(user.username ?? '')],
    ['currentUser', JSON.stringify(user)],
  ];
  for (const [key, value] of entries) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the user can still sign in from the login page */
    }
  }
};

/**
 * POST JSON to the first path that exists. A 404 means "no such route", so the next path is tried.
 * Any other status (200, 400, 401, 500...) is returned immediately.
 * Logs the exact URL and body of every 404 so the real cause is visible in the console.
 */
async function postFirstMatch(paths: string[], body: unknown, signal: AbortSignal) {
  let last: { res: Response; data: any; url: string } | null = null;
  for (const path of paths) {
    const url = api(path);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { _nonJson: text.slice(0, 200) };
    }
    last = { res, data, url };
    if (res.status !== 404) return last;
    console.error(`[rydnow] 404 from ${url}`, data);
  }
  return last!;
}

// ─── SMALL UI PIECES ─────────────────────────────────────────────
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
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
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
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 2.8 2.8L16 9.8" />
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

function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[clamp(1.4rem,6vw,1.75rem)] font-black italic leading-none tracking-tighter">
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
  hint,
  trailing,
  children,
}: {
  label: string;
  icon: keyof typeof icons;
  hint?: string;
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
      {hint && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full min-w-0 bg-transparent py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none';

// ─── PAGE ────────────────────────────────────────────────────────
export default function CustomerSignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || successMsg) return;
    setError('');
    setSuccessMsg('');

    if (!isValidGhanaNumber(formData.phone)) {
      setError('Enter a valid Ghanaian number, e.g. 0241234567 or +233241234567.');
      return;
    }
    if (formData.password.length < 10) {
      setError('Your password needs at least 10 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const finalPhone = toInternational(formData.phone);
    const email = formData.email.trim().toLowerCase();
    const derivedUsername = email.replace(/[^a-z0-9]/g, '_').slice(0, 150);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const { res, data: result, url } = await postFirstMatch(
        REGISTER_PATHS,
        {
          full_name: formData.fullName.trim(),
          email,
          phone: finalPhone,
          password: formData.password,
        },
        controller.signal,
      );

      if (!res.ok) {
        if (res.status === 404) {
          // Every candidate path returned 404: the route is missing on the backend (or the
          // backend is not the latest deploy). The console shows each URL that was tried.
          console.error('Signup: all register paths returned 404. Last URL:', url, 'Body:', result);
          setError(
            'Sign-up is not available right now (server route not found). Please contact support if this continues.',
          );
          return;
        }

        console.error('Signup response', res.status, result);

        const errs = result?.errors || result || {};
        const message =
          firstMessage(errs.email) ||
          firstMessage(errs.phone) ||
          firstMessage(errs.full_name) ||
          firstMessage(errs.password) ||
          firstMessage(errs.username) ||
          firstMessage(errs.non_field_errors) ||
          firstMessage(result?.detail) ||
          firstMessage(result?.error) ||
          (res.status >= 500
            ? 'Server error. Please try again in a moment.'
            : 'Could not create your account. Please try again.');
        throw new Error(message);
      }

      // 1) Token in the sign-up response?
      let token: unknown =
        result?.token ?? result?.key ?? result?.access ?? result?.tokens?.access ?? result?.data?.token;
      const backendUser: Record<string, unknown> =
        result?.user && typeof result.user === 'object' ? result.user : {};
      let loginIdentifier = email;

      // 2) Otherwise sign in with the same credentials (email first, then derived username).
      if (!token) {
        for (const identifier of [email, derivedUsername]) {
          try {
            const { res: loginRes, data: loginData } = await postFirstMatch(
              LOGIN_PATHS,
              { username: identifier, password: formData.password },
              controller.signal,
            );
            if (loginRes.ok) {
              token = loginData?.token ?? loginData?.key ?? loginData?.access;
              if (token) {
                loginIdentifier = identifier;
                break;
              }
            } else {
              console.error('Auto-login after signup failed', identifier, loginRes.status, loginData);
            }
          } catch (loginErr) {
            if (loginErr instanceof DOMException && loginErr.name === 'AbortError') throw loginErr;
          }
        }
      }

      // 3) Still no token: send them to the login page.
      if (!token) {
        setSuccessMsg('Account created successfully! Please sign in to continue.');
        setTimeout(() => router.push(LOGIN_ROUTE), 1500);
        return;
      }

      // 4) Save the session, then go to the dashboard.
      const user: Record<string, unknown> = {
        ...backendUser,
        username: backendUser.username || loginIdentifier,
        email: backendUser.email || email,
        full_name: backendUser.full_name || formData.fullName.trim(),
        phone: backendUser.phone || formData.phone.trim(),
      };
      saveSession(String(token), user);

      setSuccessMsg('Account created successfully! Welcome to Rydnow. Taking you to your dashboard ...');
      router.push(DASHBOARD_ROUTE);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The server is taking too long to respond. Please try again.');
      } else if (err instanceof TypeError) {
        setError('Cannot reach the server. Check your connection and try again.');
      } else {
        setError(message || 'Something went wrong. Please try again.');
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const pwScore =
    (formData.password.length >= 6 ? 1 : 0) +
    (formData.password.length >= 10 ? 1 : 0) +
    (/[A-Z]/.test(formData.password) && /\d/.test(formData.password) ? 1 : 0);
  const pwColors = ['#EF4444', '#F2A900', '#10B981'];

  return (
    <div
      className="min-h-[100dvh] font-sans"
      style={{
        background: `radial-gradient(120% 50% at 50% 0%, #12306A 0%, ${BRAND.navy} 45%, ${BRAND.deep} 100%)`,
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
            href="/login"
            aria-label="Back to login"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} strokeWidth={2.5} aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link href="/" aria-label="RYDNOW home">
            <Logo />
          </Link>
          <span className="w-10" aria-hidden />
        </header>

        {/* intro */}
        <section className="mt-5 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(1.6rem,8vw,2.1rem)] font-black leading-tight tracking-tight text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-[0.95rem] text-slate-300">
              Book rides and send parcels across Ghana in minutes.
            </p>
          </div>
          <svg viewBox="0 0 120 120" className="h-[clamp(4.5rem,22vw,6rem)] w-[clamp(4.5rem,22vw,6rem)] shrink-0" aria-hidden>
            <circle cx="60" cy="60" r="56" fill={BRAND.blue} opacity="0.25" />
            <rect x="36" y="18" width="48" height="84" rx="9" fill={BRAND.navy} stroke={BRAND.sky} strokeWidth="3" />
            <rect x="42" y="30" width="36" height="62" rx="5" fill="#123A73" />
            <path d="M50 82 C50 68 72 74 72 58" fill="none" stroke={BRAND.gold} strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
            <circle cx="50" cy="82" r="4.5" fill={BRAND.success} />
            <path d="M72 60c-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17z" fill={BRAND.gold} />
            <circle cx="72" cy="43" r="4" fill={BRAND.navy} />
          </svg>
        </section>

        {/* form card */}
        <main className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-sm text-red-200"
            >
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/60 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-200"
            >
              <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <Field label="Full name" icon="user">
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Kwame Mensah"
                autoComplete="name"
                autoCapitalize="words"
                required
                className={inputCls}
              />
            </Field>

            <Field label="Email address" icon="mail">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@email.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                required
                className={inputCls}
              />
            </Field>

            <Field label="Phone number" icon="phone" hint="Ghana numbers only, e.g. 0241234567 or +233241234567">
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="024 123 4567"
                autoComplete="tel"
                inputMode="tel"
                required
                className={inputCls}
              />
            </Field>

            <div>
              <Field
                label="Create password"
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
                  placeholder="At least 10 characters"
                  autoComplete="new-password"
                  minLength={10}
                  required
                  className={inputCls}
                />
              </Field>
              {formData.password && (
                <div className="mt-2 flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors"
                      style={{ backgroundColor: i < pwScore ? pwColors[Math.max(pwScore - 1, 0)] : '#334155' }}
                    />
                  ))}
                </div>
              )}
            </div>

            <Field
              label="Confirm Password"
              icon="lock"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="-mr-2 rounded-lg p-2 text-slate-400 active:text-white"
                >
                  <Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} />
                </button>
              }
            >
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                className={inputCls}
              />
            </Field>

            <button
              type="submit"
              disabled={loading || !!successMsg}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-black shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: BRAND.gold, boxShadow: `0 10px 24px -10px ${BRAND.gold}99` }}
            >
              {loading && (
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-slate-300">
            <li className="rounded-lg bg-white/5 px-1 py-2">Verified riders</li>
            <li className="rounded-lg bg-white/5 px-1 py-2">Live tracking</li>
            <li className="rounded-lg bg-white/5 px-1 py-2">Clear pricing</li>
          </ul>
        </main>

        {/* footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-bold" style={{ color: BRAND.gold }}>
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-sm font-extrabold tracking-tight text-white">Fast. Safe. Reliable.</p>
        </footer>
      </div>
    </div>
  );
}

