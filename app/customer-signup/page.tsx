'use client';


import { useRef, useState } from 'react';
import type { ChangeEvent, FocusEvent, FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/logo';
import { BRAND } from '@/lib/brand';
import { api as rydnow, isApiError, friendlyError } from '@/lib/rydnow/api';


// All network calls go through lib/rydnow/api.ts:
// Browser -> /api/rydnow/<path> -> Next.js proxy -> Django backend.
// No backend URL, route path or timeout logic lives in this page.


// Must match a real folder in your app directory (app/customer-dashboard/page.tsx).
// If your dashboard lives elsewhere, change it here and nowhere else.
const DASHBOARD_ROUTE = '/customer-dashboard';
const LOGIN_ROUTE = '/login';
const HOME_ROUTE = '/';


const MIN_PASSWORD_LENGTH = 10;


// ─── HELPERS ─────────────────────────────────────────────────────
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


const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);


/**
 * Persists the session so the dashboard can read it.
 * Keys are kept as before so existing pages keep working.
 * Storage can be unavailable (private mode, quota), so every write is guarded.
 */
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
      /* storage unavailable: the dashboard will send the user to sign in */
    }
  }
};


type SignupForm = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};
type FieldName = keyof SignupForm;


const validate = (data: SignupForm): Partial<Record<FieldName, string>> => {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!data.fullName.trim()) errors.fullName = 'Enter your full name.';
  if (!isValidEmail(data.email.trim())) errors.email = 'Enter a valid email address.';
  if (!isValidGhanaNumber(data.phone)) {
    errors.phone = 'Enter a valid Ghana number, e.g. 0241234567.';
  }
  if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Re-enter your password.';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
};


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
  shield: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21z" />
      <circle cx="12" cy="9.500" r="2.500" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.500" cy="8.500" r="1.200" />
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
  hint,
  error,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon: keyof typeof icons;
  hint?: string;
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
        className={`flex items-center gap-3 rounded-xl border bg-brand-900/60 px-4 transition focus-within:ring-4 ${
          error
            ? 'border-red-400/80 focus-within:border-red-400 focus-within:ring-red-400/20'
            : 'border-white/20 focus-within:border-[#3B82F6] focus-within:ring-[#3B82F6]/25'
        }`}
      >
        <span className="text-slate-300">
          <Icon name={icon} />
        </span>
        {children}
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-slate-300">
          {hint}
        </p>
      ) : null}
    </div>
  );
}


function VisibilityToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="-mr-2 rounded-lg p-2 text-slate-300 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
    >
      <Icon name={shown ? 'eyeOff' : 'eye'} />
    </button>
  );
}


const inputCls =
  'w-full min-w-0 bg-transparent py-3.5 text-base text-white placeholder:text-slate-300/60 focus:outline-none';


const PERKS = [
  { icon: 'shield', title: 'Verified riders', text: 'Every rider is ID-checked' },
  { icon: 'pin', title: 'Live tracking', text: 'Watch your trip on the map' },
  { icon: 'tag', title: 'Clear pricing', text: 'See the fare before you book' },
] as const;


// ─── PAGE ────────────────────────────────────────────────────────
export default function CustomerSignupPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);


  const [formData, setFormData] = useState<SignupForm>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const fieldErrors = validate(formData);
  const visibleError = (name: FieldName) => (touched[name] ? fieldErrors[name] : undefined);


  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };


  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const name = e.target.name as FieldName;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };


  const focusField = (name: FieldName) => {
    formRef.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
  };


  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || successMsg) return; // block double submits
    setError('');
    setSuccessMsg('');


    const errors = validate(formData);
    const firstInvalid = (Object.keys(errors) as FieldName[])[0];
    if (firstInvalid) {
      setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true });
      focusField(firstInvalid);
      return;
    }


    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const finalPhone = toInternational(formData.phone);


    setLoading(true);


    try {
      const result = await rydnow.auth.registerCustomer({
        full_name: fullName,
        email,
        phone: finalPhone,
        password: formData.password,
      });


      let token: string | undefined = result.token;
      let user: Record<string, unknown> = (result.user as unknown as Record<string, unknown>) ?? {};


      // Fallback: sign in if the backend did not return a token
      if (!token) {
        try {
          const login = await rydnow.auth.login(email, formData.password);
          token = login.token;
          user = (login.user as unknown as Record<string, unknown>) ?? {};
        } catch {
          /* handled below: the account already exists at this point */
        }
      }


      if (!token) {
        setError('Your account was created but we could not sign you in. Please sign in from the login page.');
        setLoading(false);
        return;
      }


      // Save the token first, then go straight to the dashboard.
      saveSession(token, { ...user, email, full_name: fullName, phone: finalPhone });
      setSuccessMsg('Account created! Taking you to your dashboard ...');
      router.replace(DASHBOARD_ROUTE);
      // Keep the button locked while the redirect happens.
    } catch (err) {
      if (isApiError(err) && err.isRouteNotFound) {
        setError('Sign-up is temporarily unavailable. Please try again shortly.');
      } else {
        setError(friendlyError(err, 'Could not create your account. Please try again.'));
      }
      setLoading(false);
    }
  };


  const hasLength = formData.password.length >= MIN_PASSWORD_LENGTH;
  const hasMix = /[A-Za-z]/.test(formData.password) && /\d/.test(formData.password);
  const isLong = formData.password.length >= 14;
  const pwScore = formData.password ? (hasLength ? 1 + (hasMix ? 1 : 0) + (isLong ? 1 : 0) : 1) : 0;
  const pwColors = ['#EF4444', BRAND.gold, BRAND.success];
  const pwLabel = !formData.password
    ? ''
    : !hasLength
      ? 'Too short'
      : pwScore === 1
        ? 'Okay. Add a number to make it stronger'
        : pwScore === 2
          ? 'Good'
          : 'Strong';


  const passwordsMatch =
    formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;


  const busy = loading || !!successMsg;


  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-b from-brand-900 via-brand-700 to-brand-600 font-sans"
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
            href={HOME_ROUTE}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} strokeWidth={2.5} aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link href={HOME_ROUTE} aria-label="RYDNOW home">
            <Logo />
          </Link>
          <Link
            href={LOGIN_ROUTE}
            className="rounded-full border border-white/30 px-3.5 py-1.5 text-sm font-semibold text-white active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
          >
            Sign in
          </Link>
        </header>


        {/* intro */}
        <section className="mt-5 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="bg-gold inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-brand-900"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
              </svg>
              Free to join
            </p>
            <h1 className="mt-3 text-[clamp(1.6rem,8vw,2.1rem)] font-black leading-tight tracking-tight text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-[0.95rem] text-slate-300">
              Book rides, send parcels and schedule waste pickup across Ghana.
            </p>
          </div>
          <svg
            viewBox="0 0 120 120"
            className="h-[clamp(4.5rem,22vw,6rem)] w-[clamp(4.5rem,22vw,6rem)] shrink-0"
            aria-hidden
          >
            <circle cx="60" cy="60" r="56" fill={BRAND.blue} opacity="0.25" />
            <rect x="36" y="18" width="48" height="84" rx="9" fill={BRAND.navy} stroke={BRAND.sky} strokeWidth="3" />
            <rect x="42" y="30" width="36" height="62" rx="5" fill={BRAND.blue} />
            <path
              d="M50 82 C50 68 72 74 72 58"
              fill="none"
              stroke={BRAND.gold}
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            <circle cx="50" cy="82" r="4.5" fill={BRAND.success} />
            <path d="M72 60c-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17z" fill={BRAND.gold} />
            <circle cx="72" cy="43" r="4" fill={BRAND.navy} />
          </svg>
        </section>


        {/* form card */}
        <main className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <div aria-live="polite">
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
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#10B981]/60 bg-[#10B981]/15 px-4 py-3 text-sm text-white"
              >
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>


          <form ref={formRef} onSubmit={handleSubmitForm} className="space-y-4" noValidate>
            <Field id="fullName" label="Full name" icon="user" error={visibleError('fullName')}>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Kwame Mensah"
                autoComplete="name"
                autoCapitalize="words"
                required
                disabled={busy}
                aria-invalid={!!visibleError('fullName')}
                aria-describedby={visibleError('fullName') ? 'fullName-msg' : undefined}
                className={inputCls}
              />
            </Field>


            <Field id="email" label="Email address" icon="mail" error={visibleError('email')}>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@email.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                required
                disabled={busy}
                aria-invalid={!!visibleError('email')}
                aria-describedby={visibleError('email') ? 'email-msg' : undefined}
                className={inputCls}
              />
            </Field>


            <Field
              id="phone"
              label="Phone number"
              icon="phone"
              hint="Ghana numbers only, e.g. 0241234567 or +233241234567"
              error={visibleError('phone')}
            >
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="024 123 4567"
                autoComplete="tel"
                inputMode="tel"
                required
                disabled={busy}
                aria-invalid={!!visibleError('phone')}
                aria-describedby="phone-msg"
                className={inputCls}
              />
            </Field>


            <div>
              <Field
                id="password"
                label="Create password"
                icon="lock"
                error={visibleError('password')}
                trailing={<VisibilityToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
              >
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                  required
                  disabled={busy}
                  aria-invalid={!!visibleError('password')}
                  aria-describedby={visibleError('password') ? 'password-msg' : undefined}
                  className={inputCls}
                />
              </Field>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor: i < pwScore ? (hasLength ? pwColors[Math.max(pwScore - 1, 0)] : pwColors[0]) : 'rgba(255,255,255,0.2)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300">{pwLabel}</p>
                </div>
              )}
            </div>


            <Field
              id="confirmPassword"
              label="Confirm password"
              icon="lock"
              error={visibleError('confirmPassword')}
              trailing={
                passwordsMatch && !showConfirmPassword ? (
                  <span className="text-[#10B981]" aria-label="Passwords match">
                    <Icon name="check" />
                  </span>
                ) : (
                  <VisibilityToggle
                    shown={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((s) => !s)}
                  />
                )
              }
            >
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                disabled={busy}
                aria-invalid={!!visibleError('confirmPassword')}
                aria-describedby={visibleError('confirmPassword') ? 'confirmPassword-msg' : undefined}
                className={inputCls}
              />
            </Field>


            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 text-base font-black text-brand-900 shadow-lg shadow-black/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F9D342]/40"
            >
              {busy && (
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {successMsg ? 'Opening your dashboard...' : loading ? 'Creating account...' : 'Create free account'}
            </button>


            <p className="text-center text-xs text-slate-300">Free to join. No card needed.</p>
          </form>
        </main>


        {/* perks */}
        <ul className="mt-5 grid grid-cols-3 gap-2 text-center">
          {PERKS.map((perk) => (
            <li key={perk.title} className="rounded-2xl bg-white/5 px-2 py-3">
              <span
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
                style={{ color: BRAND.gold }}
              >
                <Icon name={perk.icon} className="h-[18px] w-[18px]" />
              </span>
              <p className="mt-2 text-[12px] font-bold leading-tight text-white">{perk.title}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-slate-300">{perk.text}</p>
            </li>
          ))}
        </ul>


        {/* footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-slate-300">
            Already have an account?{' '}
            <Link href={LOGIN_ROUTE} className="font-bold text-gold">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-sm font-extrabold tracking-tight text-white">Fast. Safe. Reliable.</p>
        </footer>
      </div>
    </div>
  );
}


