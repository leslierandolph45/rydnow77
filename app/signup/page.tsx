'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

// ─── BRAND (matches the homepage) ────────────────────────────────
const BRAND = {
  navy: '#0A2342',
  deep: '#071B32',
  blue: '#0F52BA',
  sky: '#3B82F6',
  gold: '#F2A900',
  success: '#10B981',
} as const;

// ─── ROUTES ──────────────────────────────────────────────────────
// Kept exactly as in your original file. The rider path looks like it may
// contain a typo ("/rider-/rider-verify"); confirm it matches your app folder.
const ROUTES = {
  customer: '/customer-signup',
  rider: '/rider-signup',
  riderVerify: '/rider-verify',
  signIn: '/login',
  home: '/',
} as const;

const SUPPORT_PHONE = { label: '+233 59 411 6155', raw: '+233594116155' } as const;

// ─── VECTORS ─────────────────────────────────────────────────────
function CustomerArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BRAND.blue} opacity="0.22" />
      <circle cx="60" cy="60" r="44" fill={BRAND.blue} opacity="0.18" />
      {/* phone */}
      <rect x="36" y="18" width="48" height="84" rx="9" fill={BRAND.navy} stroke={BRAND.sky} strokeWidth="3" />
      <rect x="42" y="30" width="36" height="62" rx="5" fill="#123A73" />
      <rect x="52" y="23" width="16" height="2.5" rx="1.25" fill={BRAND.sky} />
      {/* route */}
      <path d="M50 82 C50 68 72 74 72 58" fill="none" stroke={BRAND.gold} strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
      <circle cx="50" cy="82" r="4.5" fill={BRAND.success} />
      <circle cx="50" cy="82" r="8" fill={BRAND.success} opacity="0.25" />
      {/* pin */}
      <path d="M72 60c-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17z" fill={BRAND.gold} />
      <circle cx="72" cy="43" r="4" fill={BRAND.navy} />
      {/* package */}
      <g transform="translate(86 76)">
        <rect width="22" height="20" rx="3" fill={BRAND.gold} />
        <rect x="9" width="4" height="20" fill={BRAND.navy} opacity="0.35" />
        <rect y="8" width="22" height="4" fill={BRAND.navy} opacity="0.2" />
      </g>
      {/* sparkles */}
      <path d="M22 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.85" />
      <circle cx="98" cy="30" r="2.5" fill="#fff" opacity="0.7" />
    </svg>
  );
}

function RiderArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BRAND.success} opacity="0.2" />
      <circle cx="60" cy="60" r="44" fill={BRAND.success} opacity="0.16" />
      {/* speed lines */}
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d="M6 56h14" />
        <path d="M2 68h12" />
        <path d="M8 80h10" />
      </g>
      {/* delivery box */}
      <rect x="24" y="48" width="22" height="18" rx="3" fill={BRAND.gold} />
      <rect x="33" y="48" width="4" height="18" fill={BRAND.navy} opacity="0.3" />
      {/* wheels */}
      <circle cx="34" cy="86" r="13" fill={BRAND.navy} stroke="#fff" strokeWidth="4" />
      <circle cx="94" cy="86" r="13" fill={BRAND.navy} stroke="#fff" strokeWidth="4" />
      <circle cx="34" cy="86" r="3.5" fill={BRAND.gold} />
      <circle cx="94" cy="86" r="3.5" fill={BRAND.gold} />
      {/* frame */}
      <path d="M34 86 L52 66 H74 L94 86" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 66 L56 56 H76 L80 66z" fill={BRAND.gold} />
      <path d="M82 66 L86 46 H94" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="97" cy="46" r="3.5" fill={BRAND.gold} />
      {/* rider */}
      <path d="M62 46 L56 62" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M64 50 L86 47" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="64" cy="35" r="9" fill={BRAND.gold} />
      <path d="M64 33h10v5a5 5 0 0 1-5 5h-5z" fill={BRAND.navy} opacity="0.8" />
      {/* sparkle */}
      <circle cx="100" cy="26" r="2.5" fill="#fff" opacity="0.75" />
      <path d="M20 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill={color} opacity="0.2" />
      <path d="m6 10.5 2.8 2.8L14 7.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

// ─── ROLE CARD ───────────────────────────────────────────────────
type RoleCardProps = {
  href: string;
  accent: string;
  title: string;
  tagline: string;
  perks: readonly string[];
  cta: string;
  art: ReactNode;
  delay: number;
};

function RoleCard({ href, accent, title, tagline, perks, cta, art, delay }: RoleCardProps) {
  return (
    <Link
      href={href}
      className="ryd-rise group block rounded-3xl p-4 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4"
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(160deg, #13294B 0%, #0E1F3A 100%)',
        border: `2px solid ${accent}`,
        boxShadow: `0 10px 30px -12px ${accent}66`,
        ['--tw-ring-color' as string]: `${accent}88`,
      }}
    >
      <div className="flex items-center gap-4">
        <div className="h-[clamp(5.5rem,28vw,7.5rem)] w-[clamp(5.5rem,28vw,7.5rem)] shrink-0">{art}</div>
        <div className="min-w-0">
          <h2 className="text-[clamp(1.2rem,5.5vw,1.45rem)] font-extrabold leading-tight text-white">{title}</h2>
          <p className="mt-1 text-sm leading-snug text-slate-300">{tagline}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm text-slate-200">
            <Check color={accent} />
            {p}
          </li>
        ))}
      </ul>

      <span
        className="mt-5 flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-black text-black transition-transform group-active:scale-[0.99]"
        style={{ backgroundColor: accent }}
      >
        {cta}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────
export default function SignupChoicePage() {
  return (
    <div
      className="min-h-[100dvh] font-sans"
      style={{
        background: `radial-gradient(120% 60% at 50% 0%, #12306A 0%, ${BRAND.navy} 45%, ${BRAND.deep} 100%)`,
      }}
    >
      <style>{`
        @keyframes rydRise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
        .ryd-rise { opacity: 0; animation: rydRise .55s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .ryd-rise { animation: none; opacity: 1; } }
      `}</style>

      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* top bar */}
        <header className="flex items-center justify-between py-2">
          <Link
            href={ROUTES.home}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link href={ROUTES.home} aria-label="RYDNOW home">
            <Logo />
          </Link>
          <span className="w-10" aria-hidden />
        </header>

        {/* intro */}
        <section className="mt-5 text-center">
          <h1 className="text-[clamp(1.6rem,8vw,2.1rem)] font-black leading-tight tracking-tight text-white">
            Join RYDNOW
          </h1>
          <p className="mx-auto mt-2 max-w-[30ch] text-[0.95rem] text-slate-300">
            Choose how you want to use the app. You can set up your profile in minutes.
          </p>
        </section>

        {/* role cards */}
        <main className="mt-6 space-y-4">
          <RoleCard
            href={ROUTES.customer}
            accent={BRAND.sky}
            title="I'm a Customer"
            tagline="Book rides and send deliveries."
            perks={['Request a ride or parcel pickup', 'Track your rider in real time', 'Transparent pricing']}
            cta="Continue as Customer"
            art={<CustomerArt />}
            delay={0}
          />
          <RoleCard
            href={ROUTES.rider}
            accent={BRAND.success}
            title="I'm a Rider"
            tagline="Earn money with rides and deliveries."
            perks={['Work on your own schedule', 'Take rides and deliveries', 'Quick rider verification']}
            cta="Continue as Rider"
            art={<RiderArt />}
            delay={140}
          />
        </main>

        {/* footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <Link href={ROUTES.signIn} className="font-bold" style={{ color: BRAND.gold }}>
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-sm font-extrabold tracking-tight text-white">Fast. Safe. Reliable.</p>

          <a
            href={`tel:${SUPPORT_PHONE.raw}`}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200 active:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
            Need help? {SUPPORT_PHONE.label}
          </a>
        </footer>
      </div>
    </div>
  );
}

