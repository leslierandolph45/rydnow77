/**
 * RYDNOW — icon set. Save as: components/icons.tsx
 * Consistent 24px outline icons (inherit colour from the text colour). No dependencies.
 */
import type { ReactNode } from 'react';

const P = (d: string) => <path d={d} />;
const C = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} />;

const ICONS = {
  pin: <>{P('M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z')}{C(12, 10, 2.5)}</>,
  list: <>{P('M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z')}{P('M6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z')}{P('M9 12h6M9 16h4')}</>,
  user: <>{C(12, 8, 4)}{P('M4 21a8 8 0 0 1 16 0')}</>,
  sliders: <>{P('M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1')}{C(15, 6, 2)}{C(9, 12, 2)}{C(17, 18, 2)}</>,
  bell: <>{P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9')}{P('M10.3 21a1.94 1.94 0 0 0 3.4 0')}</>,
  shield: <>{P('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z')}{P('M9 12l2 2 4-4')}</>,
  wallet: <>{P('M3 7a2 2 0 0 1 2-2h13v4')}{P('M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z')}{C(17, 14, 1)}</>,
  deposit: <>{C(12, 12, 9)}{P('M12 8v8M8.5 12.5L12 16l3.5-3.5')}</>,
  withdraw: <>{C(12, 12, 9)}{P('M12 16V8M8.5 11.5L12 8l3.5 3.5')}</>,
  phone: P('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'),
  chat: P('M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.3A8 8 0 1 1 21 12z'),
  camera: <>{P('M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z')}{C(12, 13, 3.5)}</>,
  bike: <>{C(6, 17, 3)}{C(18, 17, 3)}{P('M6 17l3-7h5l4 7M9 10L8 7H6M14 10l-1-3h2')}</>,
  box: <>{P('M3 7l9-4 9 4v10l-9 4-9-4z')}{P('M3 7l9 4 9-4M12 11v10')}</>,
  file: <>{P('M7 3h7l5 5v13H7z')}{P('M14 3v5h5M10 13h6M10 17h6')}</>,
  calendar: <>{P('M4 6h16v14H4z')}{P('M4 10h16M8 3v4M16 3v4')}</>,
  trophy: <>{P('M8 4h8v5a4 4 0 0 1-8 0z')}{P('M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4')}</>,
  lock: <>{P('M6 11h12v10H6z')}{P('M8 11V8a4 4 0 0 1 8 0v3')}</>,
  book: <>{P('M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z')}{P('M12 6v14')}</>,
  support: <>{P('M4 14v-2a8 8 0 0 1 16 0v2')}{P('M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z')}</>,
  check: P('M5 12l5 5 9-10'),
  clock: <>{C(12, 12, 9)}{P('M12 7v5l3 2')}</>,
  alert: <>{P('M12 3l10 18H2z')}{P('M12 10v5M12 18h.01')}</>,
  back: P('M15 5l-7 7 7 7'),
  chevron: P('M9 5l7 7-7 7'),
  navigation: P('M3 11l18-8-8 18-2-8z'),
  refresh: <>{P('M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5')}{P('M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5')}</>,
  mobile: <>{P('M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z')}{P('M11 18h2')}</>,
  card: <>{P('M3 6h18v12H3z')}{P('M3 10h18M7 15h3')}</>,
  bank: <>{P('M3 10l9-6 9 6')}{P('M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18')}</>,
  cash: <>{P('M3 7h18v10H3z')}{C(12, 12, 2.5)}</>,
  star: P('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'),
  flame: P('M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2 2 2 0-3-1-5 1-8z'),
  plus: P('M12 5v14M5 12h14'),
  logout: P('M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9'),
  chart: P('M5 20V11M12 20V4M19 20v-6'),
  sun: <>{C(12, 12, 4)}{P('M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19')}</>,
  receipt: <>{P('M6 3h12v18l-3-2-3 2-3-2-3 2z')}{P('M9 8h6M9 12h6')}</>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
    {ICONS[name]}
  </svg>
);

