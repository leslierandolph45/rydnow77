'use client';

import Link from 'next/link';
import Logo from '@/components/logo'
import { BRAND } from '@/lib/brand';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

// ─── BRAND (matches the homepage) ────────────────────────────────

// ─── ROUTES ──────────────────────────────────────────────────────
// Every link on this page comes from here. All of these pages already
// exist in your app, so nothing here should 404. Change a path in one place.
const ROUTES = {
  customer: '/customer-signup',
  rider: '/rider-signup',
  signIn: '/login',
  home: '/',
} as const;

const SUPPORT = {
  phoneLabel: '+233 59 411 6155',
  phoneHref: 'tel:+233594116155',
  email: 'support@rydnow.app',
} as const;

// Handles assumed to be "rydnowofficial" on all three. Edit any href if different.
const SOCIALS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/rydnowofficial',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/rydnowofficial',
    icon: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" />,
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@rydnowofficial',
    icon: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.4 1.9 4 4.5 4.2" />,
  },
] as const;

// ─── SHARED SVG BITS ─────────────────────────────────────────────
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Glyph({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      {children}
    </svg>
  );
}

const glyphs = {
  okada: (
    <>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M8.5 17h5l-2-6h-3m5 0 2.5 6M9 7h2" />
    </>
  ),
  parcel: (
    <>
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  waste: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  idCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6.5 16c.5-1.5 1.600-2 2.500-2s2 .5 2.500 2M14 10h4M14 14h3" />
    </>
  ),
  licence: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  photo: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.500" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
} as const;


function Check({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill={color} opacity="0.2" />
      <path d="m6 10.5 2.8 2.8L14 7.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── VECTORS ─────────────────────────────────────────────────────
function CustomerArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <circle cx="60" cy="60" r="56" fill={BRAND.blue} opacity="0.22" />
      <circle cx="60" cy="60" r="44" fill={BRAND.blue} opacity="0.18" />
      <rect x="36" y="18" width="48" height="84" rx="9" fill={BRAND.navy} stroke={BRAND.sky} strokeWidth="3" />
      <rect x="42" y="30" width="36" height="62" rx="5" fill={BRAND.blue} />
      <rect x="52" y="23" width="16" height="2.5" rx="1.25" fill={BRAND.sky} />
      <path d="M50 82 C50 68 72 74 72 58" fill="none" stroke={BRAND.gold} strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
      <circle cx="50" cy="82" r="4.5" fill={BRAND.success} />
      <circle cx="50" cy="82" r="8" fill={BRAND.success} opacity="0.25" />
      <path d="M72 60c-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17z" fill={BRAND.gold} />
      <circle cx="72" cy="43" r="4" fill={BRAND.navy} />
      <g transform="translate(86 76)">
        <rect width="22" height="20" rx="3" fill={BRAND.gold} />
        <rect x="9" width="4" height="20" fill={BRAND.navy} opacity="0.35" />
        <rect y="8" width="22" height="4" fill={BRAND.navy} opacity="0.2" />
      </g>
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
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d="M6 56h14" />
        <path d="M2 68h12" />
        <path d="M8 80h10" />
      </g>
      <rect x="24" y="48" width="22" height="18" rx="3" fill={BRAND.gold} />
      <rect x="33" y="48" width="4" height="18" fill={BRAND.navy} opacity="0.3" />
      <circle cx="34" cy="86" r="13" fill={BRAND.navy} stroke="#fff" strokeWidth="4" />
      <circle cx="94" cy="86" r="13" fill={BRAND.navy} stroke="#fff" strokeWidth="4" />
      <circle cx="34" cy="86" r="3.5" fill={BRAND.gold} />
      <circle cx="94" cy="86" r="3.5" fill={BRAND.gold} />
      <path d="M34 86 L52 66 H74 L94 86" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 66 L56 56 H76 L80 66z" fill={BRAND.gold} />
      <path d="M82 66 L86 46 H94" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="97" cy="46" r="3.5" fill={BRAND.gold} />
      <path d="M62 46 L56 62" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M64 50 L86 47" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="64" cy="35" r="9" fill={BRAND.gold} />
      <path d="M64 33h10v5a5 5 0 0 1-5 5h-5z" fill={BRAND.navy} opacity="0.8" />
      <circle cx="100" cy="26" r="2.5" fill="#fff" opacity="0.75" />
      <path d="M20 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

// ─── ROLE CONTENT ────────────────────────────────────────────────
type Role = 'customer' | 'rider';

type Chip = { label: string; glyph: keyof typeof glyphs };

type RoleConfig = {
  label: string;
  href: string;
  accent: string;
  title: string;
  tagline: string;
  perks: readonly string[];
  chipsHeading: string;
  chips: readonly Chip[];
  steps: readonly string[];
  cta: string;
  art: ReactNode;
};

const ROLES: Record<Role, RoleConfig> = {
  customer: {
    label: 'Customer',
    href: ROUTES.customer,
    accent: BRAND.sky,
    title: "I'm a Customer",
    tagline: 'Book rides and send deliveries.',
    perks: ['Request a ride or parcel pickup', 'Track your rider in real time', 'See the price before you book'],
    chipsHeading: 'Three services, one account',
    chips: [
      { label: 'Okada Ride', glyph: 'okada' },
      { label: 'Delivery', glyph: 'parcel' },
      { label: 'Waste Collection', glyph: 'waste' },
    ],
    steps: ['Create your free account', 'Book a ride, parcel or bin pickup', 'Track it live and pay with cash or Mobile Money'],
    cta: 'Continue as Customer',
    art: <CustomerArt />,
  },
  rider: {
    label: 'Rider',
    href: ROUTES.rider,
    accent: BRAND.success,
    title: "I'm a Rider",
    tagline: 'Earn money with rides and deliveries.',
    perks: ['Work on your own schedule', 'Take rides and deliveries', 'Quick rider verification'],
    chipsHeading: 'Have these ready',
    chips: [
      { label: 'Ghana Card', glyph: 'idCard' },
      { label: 'Riding licence', glyph: 'licence' },
      { label: 'Passport photo', glyph: 'photo' },
    ],
    steps: ['Create your free rider account', 'Upload your documents', 'Get verified and start earning'],
    cta: 'Continue as Rider',
    art: <RiderArt />,
  },
};

const ROLE_ORDER: readonly Role[] = ['customer', 'rider'];

// ─── PAGE ────────────────────────────────────────────────────────
export default function SignupChoicePage() {
  const [role, setRole] = useState<Role>('customer');
  const tabRefs = useRef<Record<Role, HTMLButtonElement | null>>({ customer: null, rider: null });

  // Deep link support: /signup?role=rider opens the Rider tab (handy for ads and shared links).
  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('role');
      if (param === 'rider' || param === 'customer') setRole(param);
    } catch {
      /* ignore */
    }
  }, []);

  const current = ROLES[role];

  const selectRole = (next: Role, focus = false) => {
    setRole(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const index = ROLE_ORDER.indexOf(role);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectRole(ROLE_ORDER[(index + 1) % ROLE_ORDER.length], true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectRole(ROLE_ORDER[(index - 1 + ROLE_ORDER.length) % ROLE_ORDER.length], true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectRole(ROLE_ORDER[0], true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectRole(ROLE_ORDER[ROLE_ORDER.length - 1], true);
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-b from-brand-900 via-brand-700 to-brand-600 font-sans"
    >
      <style>{`
        @keyframes rydFade { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .ryd-fade { animation: rydFade .35s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .ryd-fade { animation: none; } }
      `}</style>

      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* top bar */}
        <header className="flex items-center justify-between py-2">
          <Link
            href={ROUTES.home}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link href={ROUTES.home} aria-label="RYDNOW home">
            <Logo />
          </Link>
          <Link
            href={ROUTES.signIn}
            className="rounded-full border border-white/30 px-3.5 py-1.5 text-sm font-semibold text-white active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
          >
            Sign in
          </Link>
        </header>

        {/* intro */}
        <section className="mt-5 text-center">
          <p
            className="bg-gold inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-brand-900"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            Free to join
          </p>
          <h1 className="mt-3 text-[clamp(1.6rem,8vw,2.1rem)] font-black leading-tight tracking-tight text-white">
            Join RYDNOW
          </h1>
          <p className="mx-auto mt-2 max-w-[32ch] text-[0.95rem] text-slate-300">
            Choose how you want to use the app. Setting up takes a few minutes.
          </p>
        </section>

        {/* role switch */}
        <div
          role="tablist"
          aria-label="Choose your account type"
          className="relative mt-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1"
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
                id={`tab-${key}`}
                aria-selected={selected}
                aria-controls={`panel-${key}`}
                tabIndex={selected ? 0 : -1}
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

        {/* role panel */}
        <main className="mt-4 flex-1">
          <section
            key={role}
            role="tabpanel"
            id={`panel-${role}`}
            aria-labelledby={`tab-${role}`}
            className="ryd-fade rounded-3xl p-4"
            style={{
              background: `linear-gradient(160deg, ${BRAND.navy}D9 0%, ${BRAND.navy}8C 100%)`,
              border: `2px solid ${current.accent}`,
              boxShadow: `0 10px 30px -12px ${current.accent}66`,
            }}
          >
            <div className="flex items-center gap-4">
              <div className="h-[clamp(5.5rem,28vw,7.5rem)] w-[clamp(5.5rem,28vw,7.5rem)] shrink-0">{current.art}</div>
              <div className="min-w-0">
                <h2 className="text-[clamp(1.2rem,5.5vw,1.45rem)] font-extrabold leading-tight text-white">
                  {current.title}
                </h2>
                <p className="mt-1 text-sm leading-snug text-slate-300">{current.tagline}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {current.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check color={current.accent} />
                  {perk}
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-white/10 pt-4">
              <h3 className="text-sm font-bold text-white">{current.chipsHeading}</h3>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {current.chips.map((chip) => (
                  <li key={chip.label} className="rounded-2xl bg-white/5 px-2 py-3 text-center">
                    <span
                      className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
                      style={{ color: current.accent }}
                    >
                      <Glyph>{glyphs[chip.glyph]}</Glyph>
                    </span>
                    <span className="mt-2 block text-[11.5px] font-semibold leading-tight text-slate-300">
                      {chip.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <h3 className="text-sm font-bold text-white">How it works</h3>
              <ol className="mt-3 space-y-3">
                {current.steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-slate-300">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-brand-900"
                      style={{ backgroundColor: current.accent }}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* help */}
          <section className="mt-5 rounded-2xl bg-white/5 p-4 text-center" aria-label="Help and contact">
            <p className="text-sm font-bold text-white">Need help signing up?</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <a
                href={SUPPORT.phoneHref}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-300 active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
              >
                <Glyph className="h-4 w-4">{glyphs.phone}</Glyph>
                {SUPPORT.phoneLabel}
              </a>
              <a
                href={`mailto:${SUPPORT.email}`}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-300 active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
              >
                <Glyph className="h-4 w-4">{glyphs.mail}</Glyph>
                {SUPPORT.email}
              </a>
            </div>
            <nav aria-label="Social media" className="mt-3 flex items-center justify-center gap-4 text-slate-300">
              {SOCIALS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`RYDNOW on ${social.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                >
                  <Glyph>{social.icon}</Glyph>
                </a>
              ))}
            </nav>
          </section>

          <p className="mt-5 text-center text-sm font-extrabold tracking-tight text-white">Fast. Safe. Reliable.</p>
        </main>

        {/* sticky action bar */}
        <div
          className="sticky bottom-0 -mx-4 mt-6 px-4 pt-6"
          style={{
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            background: `linear-gradient(to top, ${BRAND.navy}F2 55%, ${BRAND.navy}00)`,
          }}
        >
          <Link
            href={current.href}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-brand-900 shadow-lg transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4"
            style={{
              backgroundColor: current.accent,
              boxShadow: `0 10px 24px -10px ${current.accent}99`,
              ['--tw-ring-color' as string]: `${current.accent}66`,
            }}
          >
            {current.cta}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <p className="mt-3 text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link href={ROUTES.signIn} className="font-bold text-gold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

