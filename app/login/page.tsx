'use client';


import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// FIX: React components must be capitalised in JSX (<logo /> renders as an HTML tag)
import Logo from '@/components/logo';
import { BRAND } from '@/lib/brand';
// FIX: save the token through session.ts so the dashboards read the same value
import { setAuthToken, readString, writeString } from '@/lib/rydnow/session';


const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '/api/rydnow';
const LOGIN_URL = `${API_BASE}/auth/login/`;
const REQUEST_TIMEOUT_MS = 60000; // Render free instances can take ~50s to wake up


// Every link and redirect on this page comes from here.
// IMPORTANT: riderDashboard must match a real folder in your app directory.
const ROUTES = {
  back: '/signup',
  home: '/',
  customerSignup: '/customer-signup',
  riderSignup: '/rider-signup',
  customerDashboard: '/customer-dashboard',
  riderDashboard: '/rider-dashboard',
} as const;


const SUPPORT = {
  phoneLabel: '+233 59 411 6155',
  phoneHref: 'tel:+233594116155',
  email: 'support@rydnow.app',
} as const;


// Stored via session.ts, so the full key is "rydnow_login_role".
const ROLE_KEY = 'login_role';


// ─── ROLES ───────────────────────────────────────────────────────
type Role = 'customer' | 'rider';
const ROLE_ORDER: readonly Role[] = ['customer', 'rider'];


const ROLES: Record<
  Role,
  { label: string; accent: string; heading: string; sub: string; signup: string; createLabel: string; dashboard: string }
> = {
  customer: {
    label: 'Customer',
    accent: BRAND.sky,
    heading: 'Welcome back',
    sub: 'Sign in to book rides and track deliveries.',
    signup: ROUTES.customerSignup,
    createLabel: 'Create a customer account',
    dashboard: ROUTES.customerDashboard,
  },
  rider: {
    label: 'Rider',
    accent: BRAND.success,
    heading: 'Ready to ride?',
    sub: 'Sign in to go online, take jobs and track your earnings.',
    signup: ROUTES.riderSignup,
    createLabel: 'Become a rider',
    dashboard: ROUTES.riderDashboard,
  },
};


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


/** Best-effort role detection from the login response. */
function detectRole(user: unknown): Role | null {
  if (!user || typeof user !== 'object') return null;
  const u = user as Record<string, unknown>;
  for (const key of ['role', 'user_type', 'account_type', 'type']) {
    const v = u[key];
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s.includes('rider')) return 'rider';
      if (s.includes('customer') || s.includes('client')) return 'customer';
    }
  }
  if (u.is_rider === true) return 'rider';
  if (u.is_customer === true) return 'customer';
  return null;
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
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 2.8 2.8L16 9.8" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M5 12.5a10 10 0 0 1 3.5-2M10 6.3A15 15 0 0 1 22 9.5M8.5 16a5 5 0 0 1 4-1.4M12 20h.01" />
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


function Field({
  id,
  label,
  icon,
  accent,
  error,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon: keyof typeof icons;
  accent: string;
  error?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-300">
        {label}
      </label>
      <div
        className="ryd-field flex items-center gap-3 rounded-xl border border-white/20 bg-brand-900/60 px-4 transition"
        style={{
          borderColor: error ? '#F87171' : undefined,
          ['--ryd-accent' as string]: accent,
        }}
      >
        <span className="text-slate-300">
          <Icon name={icon} />
        </span>
        {children}
        {trailing}
      </div>
      {error && (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}


const inputCls =
  'w-full min-w-0 bg-transparent py-3.5 text-base text-white placeholder:text-slate-300/60 focus:outline-none';


// ─── PAGE ────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const tabRefs = useRef<Record<Role, HTMLButtonElement | null>>({ customer: null, rider: null });


  const [role, setRole] = useState<Role>('customer');
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slow, setSlow] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [offline, setOffline] = useState(false);


  const current = ROLES[role];


  // Restore the last role, or honour /login?role=rider (handy for links).
  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('role');
      if (param === 'rider' || param === 'customer') {
        setRole(param);
        return;
      }
    } catch {
      /* ignore */
    }
    const saved = readString(ROLE_KEY);
    if (saved === 'rider' || saved === 'customer') setRole(saved);
  }, []);


  // Offline banner.
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);


  const selectRole = (next: Role, focus = false) => {
    if (loading) return;
    setRole(next);
    setError('');
    writeString(ROLE_KEY, next);
    if (focus) tabRefs.current[next]?.focus();
  };


  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ROLE_ORDER.indexOf(role);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      selectRole(ROLE_ORDER[(i + step + ROLE_ORDER.length) % ROLE_ORDER.length], true);
    }
  };


  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };


  const usernameError = touched.username && !formData.username.trim() ? 'Enter your username or email.' : undefined;
  const passwordError = touched.password && !formData.password ? 'Enter your password.' : undefined;


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || success) return;
    setError('');


    if (!formData.username.trim() || !formData.password) {
      setTouched({ username: true, password: true });
      return;
    }


    setLoading(true);


    const slowTimer = setTimeout(() => setSlow(true), 5000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let ok = false;


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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = isJson ? await res.json().catch(() => null) : null;


      if (!res.ok) {
        console.error('Login response', res.status, data);
        if (!isJson) {
          throw new Error(
            res.status >= 500
              ? 'Our server is having a problem. Please try again in a moment.'
              : 'Could not reach the login service. Please try again.',
          );
        }
        throw new Error(extractError(data, 'Login failed. Please check your credentials and try again.'));
      }


      const token: string | undefined = data?.token || data?.key || data?.access;
      if (!token) {
        console.error('Login succeeded but no token in response:', data);
        throw new Error('Login failed: the server did not return a session token.');
      }


      // The standard DRF token endpoint returns only {token}, so fall back if there is no user object.
      const user = data?.user ?? { username: identifier };


      // FIX: one helper saves the token where getAuthToken() reads it.
      if (!setAuthToken(token)) {
        throw new Error('Could not save your session. Check that your browser allows site storage.');
      }
      writeString('username', user.username ?? identifier);
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch {
        /* private mode / storage full */
      }


      // Prefer what the server says the account is; fall back to the selected tab.
      const destinationRole = detectRole(user) ?? role;
      writeString(ROLE_KEY, destinationRole);


      ok = true;
      setSuccess(true);
      router.replace(ROLES[destinationRole].dashboard);
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
      if (!ok) setLoading(false);
    }
  };


  const busy = loading || success;


  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-brand-900 via-brand-700 to-brand-600 font-sans">
      <style>{`
        @keyframes rydFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .ryd-fade { animation: rydFade .3s ease-out both; }
        .ryd-field:focus-within { border-color: var(--ryd-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ryd-accent) 25%, transparent); }
        @media (prefers-reduced-motion: reduce) { .ryd-fade { animation: none; } }
      `}</style>


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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} strokeWidth={2.5} aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <span className="w-10" aria-hidden />
        </header>


        {/* brand block */}
        <section className="mt-2 text-center">
          <Link href={ROUTES.home} aria-label="RYDNOW home" className="inline-block">
            <Logo size="lg" />
          </Link>
          <p className="mt-2 text-sm font-extrabold tracking-tight text-slate-300">Fast. Safe. Reliable.</p>


          <svg
            viewBox="0 0 120 120"
            className="mx-auto mt-4 h-[clamp(4.5rem,24vw,6rem)] w-[clamp(4.5rem,24vw,6rem)]"
            aria-hidden
          >
            <circle cx="60" cy="60" r="56" fill={role === 'rider' ? BRAND.success : BRAND.blue} opacity="0.25" />
            <circle cx="60" cy="60" r="42" fill={role === 'rider' ? BRAND.success : BRAND.blue} opacity="0.2" />
            <path
              d="M60 18 28 30v28c0 22 14 38 32 44 18-6 32-22 32-44V30L60 18z"
              fill={BRAND.navy}
              stroke={current.accent}
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M66 36 46 64h12l-4 20 20-30H62l4-18z" fill={BRAND.gold} />
            <circle cx="98" cy="28" r="2.5" fill="#fff" opacity="0.8" />
            <path d="M20 90l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.8" />
          </svg>
        </section>


        {/* role switch */}
        <div
          role="tablist"
          aria-label="Sign in as"
          className="relative mt-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 motion-reduce:transition-none"
            style={{
              backgroundColor: current.accent,
              transform: role === 'rider' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          {ROLE_ORDER.map((key) => {
            const selected = role === key;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                type="button"
                role="tab"
                id={`login-tab-${key}`}
                aria-selected={selected}
                aria-controls="login-panel"
                tabIndex={selected ? 0 : -1}
                disabled={busy}
                onClick={() => selectRole(key)}
                onKeyDown={onTabKeyDown}
                className={`relative z-10 rounded-xl py-3 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  selected ? 'text-brand-900' : 'text-slate-300'
                }`}
              >
                {ROLES[key].label}
              </button>
            );
          })}
        </div>


        {/* form card */}
        <main
          id="login-panel"
          role="tabpanel"
          aria-labelledby={`login-tab-${role}`}
          className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
        >
          <div key={role} className="ryd-fade">
            <h1 className="text-[clamp(1.4rem,7vw,1.8rem)] font-black leading-tight tracking-tight text-white">
              {current.heading}
            </h1>
            <p className="mb-5 mt-1 text-[0.95rem] text-slate-300">{current.sub}</p>
          </div>


          <div aria-live="polite">
            {offline && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/50 bg-amber-950/50 px-4 py-3 text-sm text-amber-200"
              >
                <Icon name="wifiOff" className="mt-0.5 h-5 w-5 shrink-0" />
                <span>You are offline. Reconnect to sign in.</span>
              </div>
            )}


            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-sm text-red-200"
              >
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}


            {success && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#10B981]/60 bg-[#10B981]/15 px-4 py-3 text-sm text-white"
              >
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
                <span>Signed in! Opening your dashboard...</span>
              </div>
            )}
          </div>


          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field
              id="username"
              label="Username or email"
              icon="user"
              accent={current.accent}
              error={usernameError}
            >
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                placeholder="Your username or email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={busy}
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? 'username-msg' : undefined}
                className={inputCls}
              />
            </Field>


            <div>
              <Field
                id="password"
                label="Password"
                icon="lock"
                accent={current.accent}
                error={passwordError}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="-mr-2 rounded-lg p-2 text-slate-300 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                  </button>
                }
              >
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, password: true }));
                    setCapsOn(false);
                  }}
                  onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  onKeyDown={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-msg' : undefined}
                  className={inputCls}
                />
              </Field>
              {capsOn && !passwordError && (
                <p className="mt-1.5 text-xs font-medium text-amber-300" role="status">
                  Caps Lock is on.
                </p>
              )}
            </div>


            <button
              type="submit"
              disabled={busy || offline}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 text-base font-black text-brand-900 shadow-lg shadow-black/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4"
              style={{ ['--tw-ring-color' as string]: `${BRAND.gold}66` }}
            >
              {busy && (
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {success ? 'Opening dashboard...' : loading ? 'Signing in...' : `Sign in as ${current.label.toLowerCase()}`}
            </button>


            {slow && (
              <p className="text-center text-sm text-slate-300" role="status">
                Waking up the server… this can take up to a minute.
              </p>
            )}
          </form>


          {/* forgot password: no reset page is linked, so help goes to support */}
          <p className="mt-4 text-center text-xs text-slate-300">
            Forgot your password?{' '}
            <a href={`mailto:${SUPPORT.email}`} className="font-semibold text-slate-300 underline underline-offset-2">
              Email support
            </a>{' '}
            or{' '}
            <a href={SUPPORT.phoneHref} className="font-semibold text-slate-300 underline underline-offset-2">
              call {SUPPORT.phoneLabel}
            </a>
            .
          </p>
        </main>


        {/* footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-slate-300">
            New to RYDNOW?{' '}
            <Link href={current.signup} className="font-bold text-gold">
              {current.createLabel}
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}


