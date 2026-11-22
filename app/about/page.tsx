'use client';

import Link from 'next/link';

const BRAND = {
  navy: '#0A2342',
  blue: '#165DFF',
  gold: '#F5A623',
  goldDark: '#D4880E',
  navyDark: '#071B32',
} as const;

const CONTACT = {
  phone: '+233 59 411 6155',
  email: 'help.rydnow@outlook.com',
} as const;

function BrandLogo() {
  return (
    <Link href="/" aria-label="RYDNOW — Home" className="inline-block">
      <span className="text-2xl font-extrabold tracking-tight" style={{ color: BRAND.blue }}>
        RYDNOW
      </span>
    </Link>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: BRAND.gold, fontSize: '1.125rem', lineHeight: 1 }}>
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

// ─── MOBILE VERSION — ONE SCREEN, NO SCROLL ───────────────────────
function MobileLayout() {
  return (
    <div className="md:hidden h-screen max-w-[375px] mx-auto flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="px-4 py-2.5 flex items-center justify-between flex-shrink-0 border-b border-gray-200 bg-white/95">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-xs font-medium" style={{ color: BRAND.navy }}>Log In</Link>
          <Link
            href="/signup"
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: BRAND.gold }}
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content — ONE SCREEN ONLY */}
      <main className="flex-1 px-4 py-2 overflow-hidden">
        <div className="h-full flex flex-col justify-between gap-1.5">
          {/* Hero */}
          <section
            className="rounded-xl p-3 text-center"
            style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.blue} 100%)` }}
          >
            <p className="text-[10px] text-amber-200 mb-1">★ About RYDNOW</p>
            <h1 className="text-lg font-extrabold text-white">
              Built for Ghana.<span style={{ color: BRAND.gold }} className="block">Trusted by Ghana.</span>
            </h1>
            <p className="text-[10px] text-blue-100 mt-1">Your neighbours, your partners, your platform.</p>
          </section>

          {/* Mission */}
          <section className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-1" style={{ color: BRAND.gold }}>Our Purpose</p>
            <h2 className="text-sm font-bold text-center mb-1" style={{ color: BRAND.navy }}>Our Mission</h2>
            <p className="text-xs text-gray-700 text-center">
              To make delivery <strong style={{ color: BRAND.gold }}>easy, affordable, and accessible</strong> everywhere in Ghana.
            </p>
          </section>

          {/* Why We're Different */}
          <section className="bg-gray-50 rounded-xl p-3 border-2" style={{ borderColor: BRAND.gold }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-1" style={{ color: BRAND.gold }}>What Makes Us Different</p>
            <h2 className="text-sm font-bold text-center mb-1.5" style={{ color: BRAND.navy }}>Truly Local</h2>
            <ul className="space-y-0.5 text-xs text-gray-700">
              <li className="flex items-start gap-1.5"><span style={{ color: BRAND.gold }}>✓</span>We partner with local businesses first</li>
              <li className="flex items-start gap-1.5"><span style={{ color: BRAND.gold }}>✓</span>We train our riders properly</li>
              <li className="flex items-start gap-1.5"><span style={{ color: BRAND.gold }}>✓</span>We keep prices fully transparent</li>
              <li className="flex items-start gap-1.5"><span style={{ color: BRAND.gold }}>✓</span>Because this is our home too.</li>
            </ul>
          </section>

          {/* CTA + Compact Footer */}
          <section className="text-center">
            <Link
              href="/signup"
              className="inline-block w-full py-2 rounded-lg font-bold text-sm mb-2"
              style={{ backgroundColor: BRAND.gold, color: BRAND.navy }}
            >
              Join RYDNOW Today →
            </Link>
            <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200">
              <p>📞 {CONTACT.phone}  •  ✉️ {CONTACT.email}</p>
              <p className="mt-0.5">© {new Date().getFullYear()} RYDNOW. All rights reserved.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── DESKTOP VERSION ──────────────────────────────────────────────
function DesktopLayout() {
  return (
    <div className="hidden md:flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo />
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 font-medium" style={{ color: BRAND.navy }}>📞 {CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 font-medium" style={{ color: BRAND.navy }}>✉️ {CONTACT.email}</a>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">Home</Link>
            <Link href="/about" className="text-sm font-bold" style={{ color: BRAND.navy }}>About Us</Link>
            <Link href="/services" className="text-sm font-medium text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900">How It Works</Link>
            <Link href="/contact" className="text-sm font-medium text-gray-600 hover:text-gray-900">Contact</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100" style={{ color: BRAND.navy }}>Log In</Link>
            <Link href="/signup" className="text-sm font-bold px-5 py-2.5 rounded-lg text-white shadow-md" style={{ backgroundColor: BRAND.gold }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND.goldDark; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND.gold; }}>Create Account</Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-28" style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.blue} 100%)` }}>
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold mb-6" style={{ backgroundColor: 'rgba(245,166,35,0.15)', color: '#FFD27A' }}>★ About RYDNOW</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Built for Ghana.<span style={{ color: BRAND.gold }} className="block mt-3">Trusted by Ghana.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
            We are more than a delivery service — we are your neighbours, your partners, and your platform.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: BRAND.gold }}>Our Purpose</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.navy }}>Our Mission</h2>
          </div>
          <div className="bg-gray-50 rounded-3xl border border-gray-100 p-8 md:p-10">
            <p className="text-lg md:text-xl text-gray-800 text-center">
              Our mission is simple — to make delivery <strong style={{ color: BRAND.gold }}>easy, affordable, and accessible</strong> everywhere in Ghana.
            </p>
          </div>
        </div>
      </section>

      {/* Why We're Different */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: BRAND.gold }}>Why We Are Different</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.navy }}>Truly Local</h2>
          </div>
          <div className="rounded-3xl border-2 p-8 md:p-10" style={{ borderColor: BRAND.gold }}>
            <ul className="space-y-4">
              {[
                'We partner with local businesses first',
                'We train our riders properly',
                'We keep prices fully transparent',
                'Because this is our home too.',
              ].map((point, index) => (
                <li key={index} className="flex items-start gap-3 text-lg text-gray-700">
                  <span style={{ color: BRAND.gold }} className="font-bold">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20" style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.blue} 100%)` }}>
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">
            Fast. Reliable.<span style={{ color: BRAND.gold }} className="block mt-2">RYDNOW</span>
          </h2>
          <p className="mt-4 text-lg md:text-xl text-blue-100">Your delivery partner, right here at home.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup" className="px-8 py-3.5 rounded-xl font-bold text-lg transition-all" style={{ backgroundColor: BRAND.gold, color: BRAND.navy }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND.goldDark; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND.gold; }}>Join RYDNOW Today →</Link>
            <Link href="/services" className="px-8 py-3.5 rounded-xl border-2 border-white/40 font-semibold text-lg text-white hover:bg-white/10">What We Offer</Link>
          </div>
        </div>
      </section>

      {/* ✅ ONE FOOTER — DESKTOP ONLY ✅ */}
      <footer className="mt-auto py-10" style={{ backgroundColor: BRAND.navyDark }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: BRAND.gold }}>RYDNOW</h3>
              <p className="text-sm text-blue-200">A Ghanaian delivery platform built to connect customers, businesses and delivery partners.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <Link href="/" className="block hover:text-white">Home</Link>
                <Link href="/about" className="block hover:text-white">About Us</Link>
                <Link href="/services" className="block hover:text-white">Services</Link>
                <Link href="/how-it-works" className="block hover:text-white">How It Works</Link>
                <Link href="/contact" className="block hover:text-white">Contact</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Get In Touch</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <a href={`mailto:${CONTACT.email}`} className="block hover:text-white">✉️ {CONTACT.email}</a>
                <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="block hover:text-white">📞 {CONTACT.phone}</a>
              </div>
            </div>
          </div>
          <p className="mt-8 pt-4 text-xs text-blue-300 border-t border-white/10 text-center">
            © {new Date().getFullYear()} RYDNOW. All rights reserved. Fast. Reliable. RYDNOW.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <>
      <MobileLayout />
      <DesktopLayout />
    </>
  );
}
