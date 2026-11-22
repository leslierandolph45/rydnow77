'use client';

import Link from 'next/link';

// ─── BRAND COLORS ─────────────────────────────────────────────────
const BRAND_NAVY = '#0A2342';
const BRAND_BLUE = '#165DFF';
const BRAND_GOLD = '#F5A623';
const BRAND_GOLD_DARK = '#D4880E';

// ─── CONTACT ──────────────────────────────────────────────────────
const CONTACT_PHONE = '+233 59 411 6155';
const CONTACT_EMAIL = 'help.rydnow@outlook.com';

// ─── ICON FILE NAMES ──────────────────────────────────────────────
const ICON_HOME = '/icons/home.svg';
const ICON_ABOUT = '/icons/about.svg';
const ICON_SERVICES = '/icons/services.svg';
const ICON_CONTACT = '/icons/contact.svg';
const ICON_REQUEST = '/icons/request.svg';
const ICON_COLLECT = 'collect.svg';
const ICON_TRACK = 'track1.svg';
const ICON_DELIVER = 'deliver.svg';
const ICON_PHONE = '/icons/phone.svg';
const ICON_EMAIL = '/icons/email.svg';

// ─── TEXT LOGO ────────────────────────────────────────────────────
function BrandLogo() {
  return (
    <Link href="/" aria-label="RYDNOW — Home" className="text-2xl font-extrabold tracking-tight">
      <span style={{ color: BRAND_NAVY }}>RY</span>
      <span style={{ color: BRAND_GOLD }}>DNOW</span>
    </Link>
  );
}

// ─── STEPS DATA ──────────────────────────────────────────────────
const steps = [
  { number: '01', title: 'Request', description: 'Tell us where it is going, what it is, and when you need it. One form — no long forms, no hidden steps.', highlight: 'Instant price shown upfront.', icon: ICON_REQUEST, emoji: '📝' },
  { number: '02', title: 'We Collect', description: 'A verified RYDNOW rider picks it up right from your door. You see their name and live location.', highlight: 'So you always know who\'s coming.', icon: ICON_COLLECT, emoji: '🏍️' },
  { number: '03', title: 'Track Live', description: 'Watch your delivery move in real time on your phone. Every update sent straight to you.', highlight: 'No guesswork.', icon: ICON_TRACK, emoji: '📍' },
  { number: '04', title: 'Delivered Safely', description: 'Handled directly to your recipient. Confirmation sent instantly.', highlight: 'Done.', icon: ICON_DELIVER, emoji: '✅' },
];

// ─── MAIN PAGE ────────────────────────────────────────────────────
export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* ─── HEADER / NAV ─── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <BrandLogo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5">
            <Link href="/" className="text-sm font-bold" style={{ color: BRAND_BLUE }}>Home</Link>
            <Link href="/about" className="text-sm font-bold text-gray-600 hover:text-gray-900">About Us</Link>
            <Link href="/services" className="text-sm font-bold text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/how-it-works" className="text-sm font-bold" style={{ color: BRAND_NAVY }}>How It Works</Link>
            <Link href="/contact" className="text-sm font-bold text-gray-600 hover:text-gray-900">Contact</Link>
          </div>

          <div className="hidden md:flex items-center gap-4 text-sm">
            <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2" style={{ color: BRAND_NAVY }}>📞 {CONTACT_PHONE}</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2" style={{ color: BRAND_NAVY }}>✉️ {CONTACT_EMAIL}</a>
            <Link href="/login" className="font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100" style={{ color: BRAND_NAVY }}>Log In</Link>
            <Link href="/signup" className="font-bold px-4 py-2 rounded-lg text-white" style={{ backgroundColor: BRAND_GOLD }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD_DARK; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD; }}>Create Account</Link>
          </div>

          {/* Mobile Auth Buttons */}
          <div className="md:hidden flex items-center gap-2">
            <Link href="/login" className="text-sm font-bold" style={{ color: BRAND_NAVY }}>Log In</Link>
            <Link href="/signup" className="text-sm font-bold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND_GOLD }}>Sign Up</Link>
          </div>
        </nav>
      </header>

      {/* ─── HERO ─── */}
      <section className="py-12 md:py-20" style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold mb-6" style={{ backgroundColor: 'rgba(245,166,35,0.15)', color: '#FFD27A' }}>★ How It Works</p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">Delivery Made Simple<span style={{ color: BRAND_GOLD }} className="block mt-2">From Your Hands — To Theirs.</span></h1>
          <p className="mt-4 text-lg text-blue-100">In minutes. Not days.</p>
        </div>
      </section>

      {/* ─── STEPS ─── */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: BRAND_GOLD }}>Four Simple Steps</p>
            <h2 className="mt-2 text-2xl md:text-3xl font-extrabold" style={{ color: BRAND_NAVY }}>How RYDNOW Works</h2>
          </div>

          <div className="space-y-12">
            {steps.map((step, index) => (
              <article key={step.number} className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}>
                <div className="w-full md:w-1/2 flex justify-center">
                  <div className="w-full max-w-xs rounded-3xl p-8 text-center" style={{ backgroundColor: '#E8F3FF' }}>
                    <span className="text-5xl block mb-3">{step.emoji}</span>
                    <p className="font-bold text-lg" style={{ color: BRAND_NAVY }}>Step {step.number}</p>
                  </div>
                </div>
                <div className="w-full md:w-1/2 text-center md:text-left">
                  <p className="text-sm font-extrabold tracking-widest mb-2" style={{ color: BRAND_GOLD }}>STEP {step.number}</p>
                  <h3 className="text-2xl font-extrabold mb-3" style={{ color: BRAND_NAVY }}>{step.title}</h3>
                  <p className="text-lg text-gray-600 mb-4">{step.description}</p>
                  <div className="border-l-4 pl-4 py-2 rounded-r-lg" style={{ borderColor: BRAND_GOLD, backgroundColor: '#FFF9EE' }}>
                    <p className="font-bold" style={{ color: BRAND_NAVY }}>{step.highlight}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BUSINESS CTA ─── */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="rounded-3xl p-8 md:p-12" style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}>
            <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: '#FFD27A' }}>For Businesses</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">Power Your Deliveries</h2>
            <p className="text-lg text-blue-100 mb-6 max-w-2xl">Build orders, daily schedules, or regular routes? We set your account once — then you book, track and manage all deliveries from one simple dashboard.</p>
            <Link href="/signup" className="inline-block px-6 py-3 rounded-xl font-extrabold" style={{ backgroundColor: BRAND_GOLD, color: BRAND_NAVY }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD_DARK; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD; }}>Set Up Your Business Account →</Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16" style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: '#FFD27A' }}>RYDNOW</p>
          <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4">From Your Hands<span style={{ color: BRAND_GOLD }} className="block">— To Theirs.</span><span className="block mt-2">In Minutes.</span></h2>
          <p className="text-lg text-blue-100 mb-8">Fast. Reliable. Tracked. Trusted.<br />Your delivery partner, right here at home.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup" className="px-8 py-3 rounded-xl font-extrabold text-lg" style={{ backgroundColor: BRAND_GOLD, color: BRAND_NAVY }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD_DARK; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD; }}>Get Started →</Link>
            <Link href="/contact" className="px-8 py-3 rounded-xl border-2 border-white/40 font-bold text-lg text-white hover:bg-white/10">Speak to Us</Link>
          </div>
        </div>
      </section>

      {/* ✅ ONE FOOTER ONLY — NO DUPLICATES ✅ */}
      <footer className="py-10" style={{ backgroundColor: '#071B32' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <BrandLogo />
              <p className="mt-4 text-sm text-blue-200">A Ghanaian delivery platform built to connect customers, businesses and delivery partners.</p>
              <div className="mt-4 space-y-2">
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 text-sm text-blue-200 hover:text-white">✉️ {CONTACT_EMAIL}</a>
                <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-blue-200 hover:text-white">📞 {CONTACT_PHONE}</a>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white mb-3">Explore</h3>
              <div className="space-y-2 text-sm text-blue-200">
                <Link href="/" className="block hover:text-white">Home</Link>
                <Link href="/about" className="block hover:text-white">About Us</Link>
                <Link href="/services" className="block hover:text-white">Services</Link>
                <Link href="/how-it-works" className="block text-white font-bold">How It Works</Link>
                <Link href="/contact" className="block hover:text-white">Contact</Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white mb-3">Account</h3>
              <div className="space-y-2 text-sm text-blue-200">
                <Link href="/signup" className="block hover:text-white">Create Account</Link>
                <Link href="/login" className="block hover:text-white">Log In</Link>
              </div>
            </div>
          </div>
          <p className="mt-8 pt-4 text-xs text-blue-300 border-t border-white/10">© {new Date().getFullYear()} RYDNOW. All rights reserved. Fast. Reliable. RYDNOW.</p>
        </div>
      </footer>
    </main>
  );
}
