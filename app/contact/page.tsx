'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';

// ─── BRAND COLORS ─────────────────────────────────────────────────
const BRAND_NAVY = '#0A2342';
const BRAND_BLUE = '#165DFF';
const BRAND_GOLD = '#F5A623';
const BRAND_GOLD_DARK = '#D4880E';
const BRAND_NAVY_DARK = '#071B32';

// ─── CONTACT INFO ────────────────────────────────────────────────
const CONTACT = {
  phone: '+233 59 411 6155',
  email: 'help.rydnow@outlook.com',
  address: 'Accra, Ghana' // ✅ Update this to your full address anytime
};

// ─── BRAND LOGO — TEXT ONLY ──────────────────────────────────────
function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <Link href="/" aria-label="RYDNOW — Home" className="inline-block">
      <span className={`font-extrabold tracking-tight ${sizeClass}`} style={{ color: BRAND_BLUE }}>
        RYDNOW
      </span>
    </Link>
  );
}

// ─── MOBILE LAYOUT — ONE SCREEN, NO SCROLL ────────────────────────
function MobileLayout() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert('Message sent! ✅');
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="md:hidden h-screen max-w-[375px] mx-auto flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
        <BrandLogo size="md" />
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

      {/* Main Content — ONE SCREEN ONLY */}
      <main className="flex-1 px-4 py-3 overflow-hidden">
        <div className="h-full flex flex-col justify-between gap-2">
           
          {/* Hero */}
          <section
            className="rounded-xl p-4 text-center"
            style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_BLUE} 100%)` }}
          >
            <p className="text-[10px] text-amber-200 mb-1">★ Get In Touch</p>
            <h1 className="text-lg font-extrabold text-white">Contact Us</h1>
            <p className="text-[10px] text-blue-100 mt-1">We'd love to hear from you.</p>
          </section>

          {/* Contact Info */}
          <section className="bg-gray-50 rounded-xl p-3">
            <h2 className="text-sm font-bold text-center mb-2" style={{ color: BRAND_NAVY }}>Head Office</h2>
            <p className="text-xs text-gray-700 text-center mb-2">{CONTACT.address}</p>
            <div className="space-y-1 text-xs">
              <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="flex items-center justify-center gap-2 text-gray-700">
                📞 {CONTACT.phone}
              </a>
              <a href={`mailto:${CONTACT.email}`} className="flex items-center justify-center gap-2 text-gray-700">
                ✉️ {CONTACT.email}
              </a>
            </div>
          </section>

          {/* Contact Form */}
          <section className="bg-white rounded-xl p-3 border border-gray-100">
            <h2 className="text-sm font-bold text-center mb-2" style={{ color: BRAND_NAVY }}>Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-1.5">
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
              <textarea
                placeholder="Your Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={2}
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-xs resize-none"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-md font-semibold text-white text-xs"
                style={{ backgroundColor: BRAND_BLUE }}
              >
                Send Message
              </button>
            </form>
          </section>

          {/* Compact Footer — LOGO INCLUDED */}
          <div className="text-center pt-2 border-t border-gray-200">
            <BrandLogo size="sm" />
            <p className="text-[9px] text-gray-500 mt-1">
              © {new Date().getFullYear()} RYDNOW. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── DESKTOP LAYOUT ────────────────────────────────────────────────
function DesktopLayout() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert('Message sent! ✅');
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="hidden md:flex flex-col min-h-screen bg-white">
      {/* Navigation — SAME PROFESSIONAL SPACING */}
      <nav className="px-8 lg:px-12 py-5 flex items-center justify-between max-w-7xl mx-auto w-full border-b border-gray-100">
        <BrandLogo size="lg" />
        <div className="flex items-center gap-10 ml-12">
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Home</Link>
          <Link href="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About Us</Link>
          <Link href="/services" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Services</Link>
          <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium">How It Works</Link>
          <Link href="/contact" className="text-gray-900 text-sm font-bold" style={{ color: BRAND_NAVY }}>Contact</Link>
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
          <p className="text-sm mb-3 text-blue-200">★ Get In Touch</p>
          <h1 className="text-4xl font-bold text-white mb-4">Contact RYDNOW</h1>
          <p className="text-lg text-blue-100 max-w-lg mx-auto">
            We'd love to hear from you. Reach out and we'll be happy to help.
          </p>
        </div>
      </section>

      {/* Contact Details + Form */}
      <section className="px-6 lg:px-8 py-20 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: BRAND_NAVY }}>Head Office</h2>
            <p className="text-lg text-gray-700 mb-6">{CONTACT.address}</p>
            <div className="space-y-4">
              <a
                href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 text-lg text-gray-700 hover:opacity-80 transition-opacity"
              >
                📞 <span>{CONTACT.phone}</span>
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-3 text-lg text-gray-700 hover:opacity-80 transition-opacity"
              >
                ✉️ <span>{CONTACT.email}</span>
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: BRAND_NAVY }}>Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Your Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-base"
              />
              <input
                type="email"
                placeholder="Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-base"
              />
              <textarea
                placeholder="Your Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-base resize-none"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-lg font-semibold text-white text-base"
                style={{ backgroundColor: BRAND_BLUE }}
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ✅ ONE FOOTER — STRICTLY TEXT LOGO ONLY ✅ */}
      <footer className="mt-auto py-12" style={{ backgroundColor: BRAND_NAVY_DARK }}>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <BrandLogo size="lg" />
          <p className="text-sm text-blue-200 mt-3 max-w-md mx-auto">
            Your delivery partner, right here at home.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6 mt-6 text-sm text-blue-200">
            <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">📞 {CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`} className="hover:text-white transition-colors">✉️ {CONTACT.email}</a>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-300">
              © {new Date().getFullYear()} RYDNOW. All rights reserved. Fast. Reliable. RYDNOW.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────
export default function ContactPage() {
  return (
    <>
      <MobileLayout />
      <DesktopLayout />
    </>
  );
}
