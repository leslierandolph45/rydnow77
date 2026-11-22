'use client';

/**
 * RYDNOW — Customer navigation
 * Place at: components/CustomerNav.tsx
 *
 * - Mobile (default): fixed bottom tab bar, same phone layout (max-w-md) as the customer pages
 * - md and up: sticky top bar with the RYDNOW logo and the same links
 * - Active state follows the URL, so deep links like /client-dashboard/orders/123 keep "Orders" lit
 * - Optional `trackBadge` shows a live dot on Track while the customer has an active booking
 *
 * Usage (e.g. app/client-dashboard/layout.tsx):
 *   <CustomerNav trackBadge={hasActiveBooking} />
 *   <main className="pb-24 md:pb-0">{children}</main>
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  badgeKey?: 'track';
};

const HOME_HREF = '/client-dashboard';

const navItems: NavItem[] = [
  { label: 'Home', href: HOME_HREF, icon: 'home' },
  { label: 'Book', href: '/client-dashboard/book', icon: 'plus' },
  { label: 'Orders', href: '/client-dashboard/orders', icon: 'orders' },
  { label: 'Track', href: '/client-dashboard/track', icon: 'track', badgeKey: 'track' },
  { label: 'Account', href: '/client-dashboard/account', icon: 'user' },
];

const ICONS = {
  home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  plus: ['M12 5v14M5 12h14'],
  orders: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  track: ['M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z'],
  user: ['M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
} as const;

const Icon = ({ name, className = 'w-6 h-6' }: { name: keyof typeof ICONS; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[name].map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);

// Home only matches exactly; every other tab also matches its sub-pages.
const isActivePath = (pathname: string | null, href: string) => {
  if (!pathname) return false;
  if (href === HOME_HREF) return pathname === HOME_HREF || pathname === `${HOME_HREF}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
};

type CustomerNavProps = {
  /** Show a live dot on the Track tab (e.g. the customer has an active booking). */
  trackBadge?: boolean;
  className?: string;
};

export default function CustomerNav({ trackBadge = false, className = '' }: CustomerNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop / tablet: top bar */}
      <header className={`hidden md:block sticky top-0 z-40 bg-[#1E3FCE] shadow-md ${className}`}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={HOME_HREF} className="flex items-center gap-2" aria-label="Rydnow home">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5B82E]" />
            <span className="text-lg font-extrabold tracking-wide text-white">RYDNOW</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {navItems.map(item => {
              const active = isActivePath(pathname, item.href);
              const isBook = item.icon === 'plus';
              const showBadge = item.badgeKey === 'track' && trackBadge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                    isBook
                      ? 'bg-[#F5B82E] text-gray-900 hover:brightness-95'
                      : active
                      ? 'bg-white text-[#1E3FCE]'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon name={item.icon} className="w-[18px] h-[18px]" />
                  {item.label}
                  {showBadge && (
                    <span className="relative flex w-2.5 h-2.5" aria-label="Active booking">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70 animate-ping" />
                      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Main"
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 ${className}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="w-full max-w-md mx-auto px-2 py-1.5 flex items-stretch justify-between">
          {navItems.map(item => {
            const active = isActivePath(pathname, item.href);
            const isBook = item.icon === 'plus';
            const showBadge = item.badgeKey === 'track' && trackBadge;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3FCE] rounded-lg ${
                    active ? 'text-[#1E3FCE]' : 'text-gray-400'
                  }`}
                >
                  {isBook ? (
                    <span
                      className={`w-10 h-10 -mt-4 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${
                        active ? 'bg-[#1E3FCE] text-white' : 'bg-[#F5B82E] text-gray-900'
                      }`}
                    >
                      <Icon name="plus" className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="relative">
                      <Icon name={item.icon} />
                      {showBadge && (
                        <span
                          className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"
                          aria-label="Active booking"
                        />
                      )}
                    </span>
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

