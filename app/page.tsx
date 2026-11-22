'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, FormEvent, ReactNode } from 'react';

// ─── BRAND ───────────────────────────────────────────────────────
const BRAND = {
  navy: '#0A2342',
  blue: '#0F52BA',
  gold: '#F2A900',
  goldDark: '#D4880E',
  success: '#10B981',
} as const;

const SLOGAN = ['Fast.', 'Safe.', 'Reliable.'] as const;

// ─── CONTACT & SOCIALS (replace handles with your real accounts) ──
const CONTACT = {
  phone: '+233 59 411 6155',
  phoneRaw: '+233594116155',
  whatsapp: 'https://wa.me/233594116155',
  email: 'help.rydnow@outlook.com',
} as const;

const SOCIALS = [
  { name: 'Instagram', href: 'https://instagram.com/rydnow', icon: 'instagram' },
  { name: 'Facebook', href: 'https://facebook.com/rydnow', icon: 'facebook' },
  { name: 'TikTok', href: 'https://tiktok.com/@rydnow', icon: 'tiktok' },
  { name: 'X', href: 'https://x.com/rydnow', icon: 'x' },
  { name: 'WhatsApp', href: CONTACT.whatsapp, icon: 'whatsapp' },
] as const;

// ─── IMAGES ──────────────────────────────────────────────────────
const heroImg = '/hp.png';

const services = [
  { name: 'Okada Rides', icon: '/okada-one.png', desc: 'Beat the traffic. Motorcycle taxis across town.' },
  { name: 'Parcel Delivery', icon: '/motorcycleman.png', desc: 'Send packages across Accra and Tema, door to door.' },
  { name: 'Waste Collection', icon: '/binmanc.png', desc: 'Schedule a pickup and keep your area clean.' },
] as const;

const steps = [
  { title: 'Create your account', desc: 'Sign up in under a minute.' },
  { title: 'Request a ride or delivery', desc: 'Tell us where to go and what to move.' },
  { title: 'Track your rider', desc: 'Follow every trip in real time.' },
] as const;

// ─── ICONS (inline, no extra dependencies) ───────────────────────
type IconName = (typeof SOCIALS)[number]['icon'] | 'phone' | 'mail' | 'star' | 'shield' | 'pin' | 'bolt';

function Icon({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (name) {
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.77.12V9.66a5.7 5.7 0 0 0-.77-.05 5.69 5.69 0 1 0 5.69 5.69V8.9a7.35 7.35 0 0 0 4.3 1.38V7.2a4.3 4.3 0 0 1-3.28-1.38z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M3 21l1.65-4.9A8.5 8.5 0 1 1 8 19.4L3 21z" />
          <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.8c-.8-.4-1.6-1.2-2-2l.8-.8-1-2L9 9.500z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.400l6.6-.9z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3z" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
        </svg>
      );
  }
}

// ─── LOGO ────────────────────────────────────────────────────────
function Logo({ size = 'md', onDark = false }: { size?: 'md' | 'lg'; onDark?: boolean }) {
  const text = size === 'lg' ? 'text-[clamp(2rem,9vw,2.75rem)]' : 'text-[clamp(1.4rem,6vw,1.75rem)]';
  return (
    <span className={`inline-flex items-center gap-1.5 font-black italic tracking-tighter leading-none ${text}`}>
      <span style={{ color: onDark ? '#fff' : BRAND.navy }}>RYD</span>
      <span style={{ color: BRAND.gold }}>NOW</span>
      <svg viewBox="0 0 24 24" className="w-[0.7em] h-[0.7em]" fill={BRAND.gold} aria-hidden>
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    </span>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[clamp(1.15rem,5vw,1.4rem)] font-extrabold tracking-tight" style={{ color: BRAND.navy }}>
        {children}
      </h2>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────
export default function HomePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  // Opens the visitor's mail app addressed to support, so the message is
  // really delivered. Swap for an API call (e.g. /api/contact) when ready.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`RYDNOW enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name} (${email})`);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    setSent(true);
    setName('');
    setEmail('');
    setMessage('');
  };

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors';

  return (
    <div className="min-h-[100dvh] bg-gray-100 font-sans">
      <style>{`
        @keyframes rydFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes rydSlide { from { opacity: 0; transform: translateX(-16px) } to { opacity: 1; transform: none } }
        .ryd-float { animation: rydFloat 3.5s ease-in-out infinite; }
        .ryd-slide { opacity: 0; animation: rydSlide .5s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .ryd-float, .ryd-slide { animation: none; opacity: 1; }
        }
      `}</style>

      {/* App shell: fluid on every phone, centred if the screen is wider */}
      <div className="mx-auto w-full max-w-[480px] min-h-[100dvh] bg-white shadow-xl relative">
        {/* ─── HEADER ─── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-100"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <Link href="/" aria-label="RYDNOW home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-2 text-sm font-semibold text-gray-700 rounded-lg active:bg-gray-100"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg font-bold text-sm text-black active:scale-95 transition-transform"
              style={{ backgroundColor: BRAND.gold }}
            >
              Sign Up
            </Link>
          </div>
        </header>

        <main className="px-4 pt-4 pb-28 space-y-8">
          {/* ─── HERO ─── */}
          <section
            className="relative overflow-hidden rounded-3xl px-5 pt-6 pb-5 text-white"
            style={{ background: `linear-gradient(145deg, ${BRAND.navy} 0%, ${BRAND.blue} 100%)` }}
          >
            {/* speed lines */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden>
              <div className="absolute -right-10 top-6 h-1.5 w-40 rounded-full bg-white rotate-[-12deg]" />
              <div className="absolute -right-4 top-12 h-1.5 w-28 rounded-full bg-white rotate-[-12deg]" />
              <div className="absolute -right-14 top-[4.5rem] h-1.5 w-36 rounded-full bg-white rotate-[-12deg]" />
            </div>

            <div className="relative">
              <Logo size="lg" onDark />

              <p className="mt-4 flex flex-wrap gap-x-2 text-[clamp(1.5rem,7.5vw,2rem)] font-black leading-none tracking-tight">
                {SLOGAN.map((word, i) => (
                  <span
                    key={word}
                    className="ryd-slide"
                    style={{ animationDelay: `${i * 160}ms`, color: i === 1 ? BRAND.gold : '#fff' }}
                  >
                    {word}
                  </span>
                ))}
              </p>

              <p className="mt-3 text-[0.95rem] text-blue-100 max-w-[28ch]">
                Rides, parcels and waste pickup across Ghana, one tap away.
              </p>
            </div>

            <div className="relative mx-auto mt-2 w-[min(62vw,15rem)] aspect-square ryd-float">
              <Image
                src={heroImg}
                alt="RYDNOW delivery rider"
                fill
                sizes="(max-width: 480px) 62vw, 240px"
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-3">
              <Link
                href="/signup"
                className="py-3 rounded-xl font-bold text-center text-black active:scale-95 transition-transform"
                style={{ backgroundColor: BRAND.gold }}
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="py-3 rounded-xl font-semibold text-center bg-white/15 border border-white/25 active:bg-white/25"
              >
                Sign In
              </Link>
            </div>
          </section>

          {/* ─── TRUST STRIP ─── */}
          <section aria-label="Why RYDNOW" className="grid grid-cols-3 gap-2">
            {[
              { icon: 'bolt', label: 'Fast', note: 'Quick pickups', color: BRAND.gold },
              { icon: 'shield', label: 'Safe', note: 'Verified riders', color: BRAND.success },
              { icon: 'pin', label: 'Reliable', note: 'Accra & Tema', color: BRAND.blue },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl bg-gray-50 px-2 py-3 text-center">
                <span
                  className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: t.color }}
                >
                  <Icon name={t.icon as IconName} className="w-4 h-4" />
                </span>
                <p className="text-sm font-extrabold" style={{ color: BRAND.navy }}>{t.label}</p>
                <p className="text-[11px] text-gray-500 leading-tight">{t.note}</p>
              </div>
            ))}
          </section>

          {/* ─── SERVICES ─── */}
          <section>
            <SectionTitle sub="Pick what you need moved today.">Our Services</SectionTitle>
            <div className="space-y-3">
              {services.map((s) => (
                <Link
                  key={s.name}
                  href="/signup"
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="relative h-14 w-14 shrink-0 rounded-xl bg-gray-50 p-2">
                    <Image src={s.icon} alt="" fill sizes="56px" className="object-contain p-2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold leading-tight" style={{ color: BRAND.navy }}>{s.name}</h3>
                    <p className="mt-0.5 text-sm text-gray-500 leading-snug">{s.desc}</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: BRAND.gold }} aria-hidden>›</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section>
            <SectionTitle>How it works</SectionTitle>
            <ol className="space-y-3">
              {steps.map((st, i) => (
                <li key={st.title} className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
                    style={{ backgroundColor: BRAND.gold }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold leading-tight" style={{ color: BRAND.navy }}>{st.title}</p>
                    <p className="text-sm text-gray-500">{st.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ─── REVIEWS ─── */}
          <section>
            <Link
              href="/reviews"
              className="block rounded-2xl p-5 text-center active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#FFF8E6', border: `1px solid ${BRAND.gold}40` }}
            >
              <div className="flex justify-center gap-1" style={{ color: BRAND.gold }} aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((n) => (
                  <Icon key={n} name="star" className="w-6 h-6" />
                ))}
              </div>
              <p className="mt-2 font-extrabold" style={{ color: BRAND.navy }}>Loved your ride or delivery?</p>
              <p className="text-sm font-semibold" style={{ color: BRAND.goldDark }}>Leave a review</p>
            </Link>
          </section>

          {/* ─── CONNECT: SOCIALS + PHONE + EMAIL ─── */}
          <section
            className="rounded-3xl p-5 text-white"
            style={{ background: `linear-gradient(160deg, ${BRAND.navy} 0%, #071B32 100%)` }}
          >
            <h2 className="text-[clamp(1.2rem,5.5vw,1.5rem)] font-black tracking-tight">Stay connected</h2>
            <p className="mt-1 text-sm text-blue-200">Follow us for updates, offers and rider stories.</p>

            <div className="mt-4 flex flex-wrap gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`RYDNOW on ${s.name}`}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 active:scale-90 active:bg-white/25 transition"
                >
                  <Icon name={s.icon} className="w-5 h-5" />
                </a>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <a
                href={`tel:${CONTACT.phoneRaw}`}
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 active:bg-white/20"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-black" style={{ backgroundColor: BRAND.gold }}>
                  <Icon name="phone" className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-blue-200">Call us</span>
                  <span className="block font-bold">{CONTACT.phone}</span>
                </span>
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 active:bg-white/20"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black" style={{ backgroundColor: BRAND.gold }}>
                  <Icon name="mail" className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-blue-200">Email us</span>
                  <span className="block font-bold break-all">{CONTACT.email}</span>
                </span>
              </a>
            </div>
          </section>

          {/* ─── CONTACT FORM ─── */}
          <section>
            <SectionTitle sub="Questions or feedback? Send us a note.">Need help?</SectionTitle>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="email"
                placeholder="Your email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
              />
              <textarea
                placeholder="How can we help?"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className={inputCls}
              />
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-bold text-white active:scale-[0.98] transition-transform"
                style={{ backgroundColor: BRAND.blue }}
              >
                Send message
              </button>
              {sent && (
                <p role="status" className="text-sm text-center font-medium" style={{ color: BRAND.success }}>
                  Your mail app is open. Tap send there to reach us.
                </p>
              )}
            </form>
          </section>

          {/* ─── FOOTER ─── */}
          <footer className="text-center pt-2">
            <Logo />
            <p className="mt-2 text-sm font-bold" style={{ color: BRAND.navy }}>
              {SLOGAN.join(' ')}
            </p>
            <p className="mt-3 text-[11px] text-gray-400">
              © {new Date().getFullYear()} RYDNOW. All rights reserved.
            </p>
          </footer>
        </main>

        {/* ─── STICKY QUICK-ACTION BAR ─── */}
        <nav
          aria-label="Quick actions"
          className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-gray-200 bg-white/95 backdrop-blur px-3 pt-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`tel:${CONTACT.phoneRaw}`}
              className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold active:bg-gray-100"
              style={{ color: BRAND.navy }}
            >
              <Icon name="phone" className="w-5 h-5" />
              Call
            </a>
            <a
              href={CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold active:bg-gray-100"
              style={{ color: BRAND.navy }}
            >
              <Icon name="whatsapp" className="w-5 h-5" />
              WhatsApp
            </a>
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-xl text-sm font-black text-black active:scale-95 transition-transform"
              style={{ backgroundColor: BRAND.gold }}
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

