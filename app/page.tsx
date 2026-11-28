import Link from "next/link";
import type { ReactNode } from "react";


type Service = { name: string; blurb: string; icon: ReactNode };


const iconClass = "h-6 w-6";


const SERVICES: readonly Service[] = [
  {
    name: "Okada Ride",
    blurb: "Beat the traffic with a verified rider at your door.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <circle cx="5.5" cy="17" r="3" />
        <circle cx="18.5" cy="17" r="3" />
        <path d="M8.5 17h5l-2-6h-3m5 0 2.5 6M9 7h2" />
      </svg>
    ),
  },
  {
    name: "Delivery",
    blurb: "Send parcels across the city, tracked from pickup to drop.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8M12 13v8" />
      </svg>
    ),
  },
  {
    name: "Waste Collection",
    blurb: "Schedule a bin pickup and keep your area clean.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    ),
  },
] as const;


const STEPS = [
  { title: "Choose a service", text: "Pick a ride, delivery or waste pickup." },
  { title: "Get your price", text: "See the fare before you confirm. No surprises." },
  { title: "Track it live", text: "Watch your rider come to you on the map." },
] as const;


const TRUST = [
  { title: "Verified riders", text: "Ghana Card and licence checked." },
  { title: "Live tracking", text: "Follow every trip in real time." },
  { title: "Pay your way", text: "Cash or Mobile Money." },
] as const;


const CONTACT = {
  email: "support@rydnow.app",
  phoneDisplay: "+233 59 411 6155",
  phoneHref: "tel:+233594116155",
} as const;


const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/rydnowgh",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/rydnowofficial",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@rydnowgh",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.4 1.9 4 4.5 4.2" />
      </svg>
    ),
  },
] as const;


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rydnow.app";


const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RYDNOW",
  url: SITE_URL,
  areaServed: "GH",
  description: "Rides, parcel delivery and waste collection across Ghana.",
  sameAs: SOCIALS.map((s) => s.href),
  contactPoint: {
    "@type": "ContactPoint",
    email: CONTACT.email,
    telephone: CONTACT.phoneHref.replace("tel:", ""),
    contactType: "customer support",
  },
};


export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />


      {/* Hero */}
      <header className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-brand-900 via-brand-700 to-brand-600 px-5 pb-10 pt-5 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />


        <nav className="relative flex items-center justify-between" aria-label="Primary">
          <Link href="/" className="text-2xl font-extrabold tracking-tight" aria-label="RYDNOW home">
            RYD<span className="text-gold">NOW</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </nav>


        <div className="relative mt-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
            Made for Ghana
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight">
            Rides, delivery &amp; waste pickup. <span className="text-gold">Done.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/80">
            One app for the moves that keep your day going. Book in seconds,
            track every trip live.
          </p>


          <div className="mt-6 space-y-3">
            <Link
              href="/customer-signup"
              className="flex w-full items-center justify-center rounded-2xl bg-gold px-6 py-4 text-base font-bold text-brand-900 shadow-lg shadow-black/20 transition-transform active:scale-[0.98]"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-2xl border border-white/30 px-6 py-4 text-base font-semibold transition hover:bg-white/10 active:scale-[0.98]"
            >
              I already have an account
            </Link>
          </div>
        </div>


        {/* Decorative live-trip card */}
        <div className="relative mt-8 rounded-2xl bg-white p-4 text-gray-900 shadow-xl" aria-hidden="true">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <circle cx="5.5" cy="17" r="3" />
                <circle cx="18.5" cy="17" r="3" />
                <path d="M8.5 17h5l-2-6h-3m5 0 2.5 6M9 7h2" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Your rider is on the way</p>
              <p className="text-xs text-gray-500">Arriving in a few minutes</p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              Live
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-2/3 rounded-full bg-brand-600" />
          </div>
        </div>
      </header>


      <main>
        {/* Services */}
        <section className="px-5 pt-10" aria-labelledby="services-heading">
          <h2 id="services-heading" className="text-2xl font-extrabold tracking-tight text-brand-900">
            Everything you need
          </h2>
          <p className="mt-1 text-sm text-gray-600">Three services. One account.</p>


          <ul className="mt-5 space-y-3">
            {SERVICES.map((service) => (
              <li key={service.name}>
                <Link
                  href="/customer-signup"
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    {service.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-gray-900">{service.name}</h3>
                    <p className="text-sm leading-snug text-gray-600">{service.blurb}</p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>


        {/* How it works */}
        <section className="px-5 pt-12" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-extrabold tracking-tight text-brand-900">
            How it works
          </h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>


        {/* Trust */}
        <section className="px-5 pt-12" aria-labelledby="trust-heading">
          <h2 id="trust-heading" className="sr-only">Why choose RYDNOW</h2>
          <ul className="grid grid-cols-1 gap-3 rounded-2xl bg-brand-50 p-4">
            {TRUST.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true">
                  <path d="m5 12 5 5L20 7" />
                </svg>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">{item.title}.</span> {item.text}
                </p>
              </li>
            ))}
          </ul>
        </section>


        {/* Rider CTA */}
        <section className="px-5 pt-12" aria-labelledby="rider-heading">
          <div className="rounded-3xl bg-brand-900 p-6 text-white">
            <h2 id="rider-heading" className="text-2xl font-extrabold tracking-tight">
              Ride with <span className="text-gold">RYDNOW</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Own a motorbike? Sign up, get verified and start earning on your
              own schedule.
            </p>
            <Link
              href="/rider-signup"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold px-6 py-4 text-base font-bold text-brand-900 shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]"
            >
              Become a rider
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>
      </main>


      <footer className="mt-12 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-lg font-extrabold tracking-tight text-brand-900">
          RYD<span className="text-gold-dark">NOW</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">Fast &bull; Safe &bull; Reliable </p>


        <nav aria-label="Social media" className="mt-4 flex items-center justify-center gap-5 text-gray-500">
          {SOCIALS.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`RYDNOW on ${social.name}`}
              className="flex h-10 w-10 items-center justify-center transition-colors hover:text-brand-600"
            >
              {social.icon}
            </a>
          ))}
        </nav>


        <p className="mt-2 text-xs text-gray-500">
          <a href={`mailto:${CONTACT.email}`} className="hover:text-brand-600">{CONTACT.email}</a>
          {" "}&bull;{" "}
          <a href={CONTACT.phoneHref} className="hover:text-brand-600">{CONTACT.phoneDisplay}</a>
        </p>


        <p className="mt-4 text-xs text-gray-500">
          &copy; {new Date().getFullYear()} RYDNOW. All rights reserved.
        </p>
      </footer>
    </>
  );
}


