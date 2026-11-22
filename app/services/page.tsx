'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, FormEvent } from 'react';

// ─── BRAND COLORS ─────────────────────────────────────────────────
const BRAND_NAVY = '#0A2342';
const BRAND_BLUE = '#165DFF';
const BRAND_GOLD = '#F5A623';
const BRAND_GOLD_DARK = '#D4880E';
const BRAND_SUCCESS = '#10B981';
const BRAND_NAVY_DARK = '#071B32';

// ─── CONTACT ──────────────────────────────────────────────────────
const CONTACT_PHONE = '+233 59 411 6155';
const CONTACT_EMAIL = 'help.rydnow@outlook.com';

// ─── IMAGES ───────────────────────────────────────────────────────
const bikeIcon = '/okada-one.png';
const deliveryIcon = '/motorcycleman.png';
const wasteIcon = '/binmanc.png';

// ─── SERVICES ─────────────────────────────────────────────────────
const services = [
  { name: 'Okada Riders', icon: bikeIcon, desc: 'Motorcycle taxis across town' },
  { name: 'Delivery Services', icon: deliveryIcon, desc: 'Send parcels fast & safe' },
  { name: 'Waste Collection', icon: wasteIcon, desc: 'Reliable waste pickup' }
];

// ─── MOBILE LAYOUT ────────────────────────────────────────────────
function MobileLayout() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert('Message sent! ✅');
    setName('');
    setEmail('');
  };

  return (
    <div className="md:hidden h-screen max-w-[375px] mx-auto flex flex-col overflow-hidden bg-white">
      {/* Header — MORE SPACING */}
      <header className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
        <span className="font-extrabold text-xl" style={{ color: BRAND_BLUE }}>RYDNOW</span>
        <div className="flex gap-3 text-xs items-center">
          <Link href="/login" className="text-gray-600 font-medium">Login</Link>
          <Link
            href="/signup"
            className="px-3 py-1.5 rounded-md font-semibold"
            style={{ backgroundColor: BRAND_GOLD, color: '#000', fontSize: 13 }}
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-3 overflow-hidden">
        <div className="h-full flex flex-col justify-between gap-2">
          {/* Hero Card */}
          <section
            className="rounded-xl p-4"
            style={{ background: `linear-gradient(180deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}
          >
            <p className="text-[10px] mb-1 text-white/80">★ Our Services</p>
            <h1 className="text-lg font-bold text-white leading-tight mb-1">
              What Would You<br />Like to Move?
            </h1>
            <p className="text-[10px] text-white/80 mb-3">Anything, anywhere across Ghana.</p>
            <div className="flex gap-2">
              <Link
                href="/signup"
                className="flex-1 py-1.5 rounded-md font-semibold text-center text-xs"
                style={{ backgroundColor: BRAND_GOLD, color: '#000' }}
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="flex-1 py-1.5 rounded-md font-medium text-center text-xs bg-white/20 text-white"
              >
                Sign In
              </Link>
            </div>
          </section>

          {/* Services */}
          <section>
            <h2 className="text-sm font-bold text-center mb-1.5" style={{ color: BRAND_NAVY }}>Our Services</h2>
            <div className="grid grid-cols-3 gap-3">
              {services.map((s, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 relative">
                    <Image src={s.icon} alt={s.name} fill className="object-contain" />
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: BRAND_NAVY }}>{s.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-base font-bold" style={{ color: BRAND_GOLD }}>5.0</p>
                <p className="text-[10px] text-gray-500">Ratings</p>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: BRAND_BLUE }}>Nationwide</p>
                <p className="text-[10px] text-gray-500">Coverage</p>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: BRAND_SUCCESS }}>Secure</p>
                <p className="text-[10px] text-gray-500">Verified</p>
              </div>
            </div>
          </section>

          {/* Contact + Compact Footer */}
          <section className="bg-gray-50 rounded-lg p-3">
            <form onSubmit={handleSubmit} className="space-y-1.5 mb-2">
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-xs"
              />
              <input
                type="email"
                placeholder="Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-xs"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-md font-semibold text-white text-xs"
                style={{ backgroundColor: BRAND_BLUE }}
              >
                Send Message
              </button>
            </form>
            <div className="text-center text-[10px] text-gray-500 pt-1.5 border-t border-gray-200">
              <p>📞 {CONTACT_PHONE}  •  ✉️ {CONTACT_EMAIL}</p>
              <p className="mt-0.5">© {new Date().getFullYear()} RYDNOW. All rights reserved.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── DESKTOP LAYOUT — MORE NAV SPACING ─────────────────────────────
function DesktopLayout() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert('Message sent! ✅');
    setName('');
    setEmail('');
  };

  return (
    <div className="hidden md:flex flex-col min-h-screen bg-white">
      {/* Navigation — PROPER SPACING BETWEEN LOGO AND LINKS */}
      <nav className="px-8 lg:px-12 py-5 flex items-center justify-between max-w-7xl mx-auto w-full border-b border-gray-100">
        <Link href="/" className="font-extrabold text-2xl" style={{ color: BRAND_BLUE }}>RYDNOW</Link>
        
        {/* NAV LINKS — MORE SPREAD OUT */}
        <div className="flex items-center gap-10 ml-12">
          <Link href="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About Us</Link>
          <Link href="/services" className="text-gray-900 text-sm font-bold" style={{ color: BRAND_NAVY }}>Services</Link>
          <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium">How It Works</Link>
          <Link href="/contact" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Contact</Link>
        </div>
        
        <div className="flex items-center gap-4 ml-auto">
          <Link href="/login" className="text-gray-600 text-sm font-medium hover:text-gray-900">Login</Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ backgroundColor: BRAND_GOLD, color: '#000' }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD_DARK; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = BRAND_GOLD; }}
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}>
        <div className="px-6 lg:px-8 py-20 max-w-6xl mx-auto text-center">
          <p className="text-sm mb-3 text-blue-200">★ Our Services</p>
          <h1 className="text-4xl font-bold text-white mb-4">
            Fast & Reliable<br />Deliveries & Rides
          </h1>
          <p className="text-lg text-blue-100 mb-8 max-w-lg mx-auto">
            Anything, anywhere across Ghana. Reliable riders, real-time tracking, transparent pricing.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 rounded-lg font-semibold"
              style={{ backgroundColor: BRAND_GOLD, color: '#000' }}
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 bg-white/20 text-white rounded-lg font-semibold"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 lg:px-8 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold" style={{ color: BRAND_NAVY }}>Our Services</h2>
          <p className="text-gray-500 mt-3">What would you like to move today?</p>
        </div>
        <div className="grid grid-cols-3 gap-8">
          {services.map((service, index) => (
            <article key={index} className="bg-gray-50 rounded-2xl p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <Image src={service.icon} alt={service.name} fill className="object-contain" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: BRAND_NAVY }}>{service.name}</h3>
              <p className="text-sm text-gray-500">{service.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-12 text-center">
          <div>
            <p className="text-3xl font-bold" style={{ color: BRAND_GOLD }}>5.0</p>
            <p className="text-gray-500 text-sm mt-2">Verified Ratings</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: BRAND_BLUE }}>Nationwide</p>
            <p className="text-gray-500 text-sm mt-2">Coverage</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: BRAND_SUCCESS }}>Secure</p>
            <p className="text-gray-500 text-sm mt-2">Verified Riders</p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-6 lg:px-8 py-20 max-w-6xl mx-auto">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold" style={{ color: BRAND_NAVY }}>Contact Us</h2>
            <p className="text-gray-500 mt-2">We'd love to hear from you</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-5 py-3 rounded-xl border border-gray-200"
            />
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-5 py-3 rounded-xl border border-gray-200"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              Send Message
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            <p>📞 {CONTACT_PHONE}</p>
            <p>✉️ {CONTACT_EMAIL}</p>
          </div>
        </div>
      </section>

      {/* ✅ ONE FOOTER — DESKTOP ONLY ✅ */}
      <footer className="mt-auto py-12" style={{ backgroundColor: BRAND_NAVY_DARK }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <h3 className="text-xl font-bold mb-3" style={{ color: BRAND_GOLD }}>RYDNOW</h3>
              <p className="text-sm text-blue-200 leading-relaxed">A Ghanaian delivery platform built to connect customers, businesses and delivery partners.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Quick Links</h4>
              <div className="space-y-3 text-sm text-blue-200">
                <Link href="/" className="block hover:text-white transition-colors">Home</Link>
                <Link href="/about" className="block hover:text-white transition-colors">About Us</Link>
                <Link href="/services" className="block hover:text-white transition-colors">Services</Link>
                <Link href="/how-it-works" className="block hover:text-white transition-colors">How It Works</Link>
                <Link href="/contact" className="block hover:text-white transition-colors">Contact</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Get In Touch</h4>
              <div className="space-y-3 text-sm text-blue-200">
                <a href={`mailto:${CONTACT_EMAIL}`} className="block hover:text-white transition-colors">✉️ {CONTACT_EMAIL}</a>
                <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="block hover:text-white transition-colors">📞 {CONTACT_PHONE}</a>
              </div>
            </div>
          </div>
          <p className="mt-10 pt-6 text-sm text-blue-300 border-t border-white/10 text-center">
            © {new Date().getFullYear()} RYDNOW. All rights reserved. Fast. Reliable. RYDNOW.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────
export default function ServicesPage() {
  return (
    <>
      <MobileLayout />
      <DesktopLayout />
    </>
  );
}
