'use client';

/**
 * RYDNOW — Rider Dashboard v3 (mobile-first, Tailwind only, no custom CSS)
 * Save as: app/rider-dashboard/page.tsx   (also needs components/rider-features.tsx)
 *
 * Layout:  fixed header · 3 tabs (Home / Jobs / Account) · fixed Go Online bar · bottom tab bar
 * Home:    sync status · service toggle · guidelines · map + hot zones · job/offer · daily goal · milestones
 *          · peak hours · shift analytics · weather & demand
 * Jobs:    Earnings (donut, payout, 7-day bars, per-trip breakdown, filters) | Performance (ratings, rates)
 * Account: wallet · profile photo · details · vehicles · documents · safety centre · schedule · achievements
 *          · settings (theme) · security · help centre · support
 * Sheets:  notifications · safety centre · badge · goal · password · 2FA · add vehicle · chat · photo · proof of delivery
 *
 * ALL DATA IS MOCK. Search for "BACKEND:" to find every place to connect your API.
 * Logo: default export from @/components/logo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Logo from '@/components/logo';
import { Icon, type IconName } from '@/components/icons';
import { WalletPanel, ServiceToggle, ChatPanel, PhotoPanel, ProofPanel, DEFAULT_SERVICES, type Dest, type Msg } from '@/components/rider-features';

// ─── TYPES ───
type Tab = 'home' | 'jobs' | 'account';
type Period = 'today' | 'week' | 'month';
type ThemePref = 'light' | 'dark' | 'system';
type DocStatus = 'verified' | 'pending' | 'action';
type Stage = 'pickup' | 'arrived' | 'trip';
type TxFilter = 'all' | 'cash' | 'online' | 'bonus' | 'fee';
type Pay = 'cash' | 'online';
type Job = { id: string; at: number; from: string; to: string; base: number; fee: number; bonus: number; method: Pay; km: number; proof?: string };
type Offer = { customer: string; from: string; to: string; fare: number; km: number; method: Pay };
type Doc = { name: string; status: DocStatus; note: string };
type Sched = { on: boolean; from: number; to: number };
type NoteGroup = 'jobs' | 'earnings' | 'system' | 'promos';
type Note = { id: string; group: NoteGroup; icon: string; title: string; msg: string; at: number; read: boolean; action?: string };
type Txn = { id: string; kind: 'deposit' | 'withdraw' | 'earning'; label: string; amount: number; at: number };
type Vehicle = { id: string; model: string; plate: string; color: string; active: boolean; status: DocStatus; service: string; kmLeft: number };

// ─── THEME TOKENS ───
const LIGHT = {
  page: 'bg-[#F5F7FA]', card: 'bg-white ring-1 ring-[#0A2342]/5 shadow-[0_6px_24px_rgba(10,35,66,0.08)]', ink: 'text-[#0A2342]', sub: 'text-[#0A2342]/65',
  faint: 'text-[#0A2342]/50', line: 'border-[#0A2342]/10', soft: 'bg-[#0A2342]/5', input: 'bg-white border-[#0A2342]/20 text-[#0A2342]',
  hero: 'bg-[#0A2342] text-white', btn: 'bg-[#0A2342] text-[#F9D342]', nav: 'bg-white/95', skel: 'bg-[#0A2342]/10', divide: 'divide-[#0A2342]/5',
  bar: 'bg-[#0A2342]/80', sheet: 'bg-white', stroke: '#0A2342', map: 'bg-[#E8EEF5]', road: '#fff',
};
const DARK: typeof LIGHT = {
  page: 'bg-[#06101F]', card: 'bg-[#0E2240] ring-1 ring-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.45)]', ink: 'text-white', sub: 'text-white/70',
  faint: 'text-white/55', line: 'border-white/10', soft: 'bg-white/10', input: 'bg-[#0A1A33] border-white/25 text-white',
  hero: 'bg-[#14396B] text-white', btn: 'bg-[#F9D342] text-[#0A2342]', nav: 'bg-[#0A1A33]/95', skel: 'bg-white/10', divide: 'divide-white/10',
  bar: 'bg-[#6FA8FF]', sheet: 'bg-[#0E2240]', stroke: '#FFFFFF', map: 'bg-[#10294A]', road: '#1D3E6B',
};
type Theme = typeof LIGHT;

// ─── MOCK DATA (BACKEND: replace with API responses) ───
const HOUR = 3600_000;
const now = Date.now();
const MOCK_RIDER = { name: 'Kofi Mensah', phone: '0541234567', email: 'kofi.mensah@example.com', walletBalance: 142.5, dailyGoal: 150, streakDays: 4 }; // BACKEND: GET /auth/me/ + /get-rider-wallet/
const MOCK_DOCS: Doc[] = [
  { name: 'Driver’s licence', status: 'verified', note: 'Expires Mar 2028' },
  { name: 'Ghana Card', status: 'verified', note: 'Matched with your selfie' },
  { name: 'Vehicle insurance', status: 'pending', note: 'We’re reviewing this, usually 24 hrs' },
];
const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', model: 'Haojue 125cc Okada', plate: 'GR 4821-24', color: 'Red', active: true, status: 'verified', service: '2026-12-15', kmLeft: 300 },
  { id: 'v2', model: 'Yamaha Crux', plate: 'GN 2210-23', color: 'Black', active: false, status: 'verified', service: '2027-01-20', kmLeft: 1200 },
]; // BACKEND: GET /rider-vehicles/
const MOCK_HISTORY: Job[] = [
  { id: 'J-1042', at: now - 2 * HOUR, from: 'Madina Market', to: 'Legon Campus', base: 22, fee: 3.3, bonus: 0, method: 'cash', km: 6.2 },
  { id: 'J-1041', at: now - 4 * HOUR, from: 'Accra Mall', to: 'East Legon', base: 30, fee: 4.5, bonus: 5, method: 'online', km: 9.1 },
  { id: 'J-1038', at: now - 26 * HOUR, from: 'Osu Oxford St', to: 'Labone', base: 18, fee: 2.7, bonus: 0, method: 'online', km: 4 },
  { id: 'J-1035', at: now - 50 * HOUR, from: 'Circle', to: 'Kaneshie', base: 25, fee: 3.75, bonus: 0, method: 'cash', km: 7 },
  { id: 'J-1031', at: now - 74 * HOUR, from: 'Tema Station', to: 'Ashaiman', base: 40, fee: 6, bonus: 5, method: 'cash', km: 14 },
  { id: 'J-1027', at: now - 120 * HOUR, from: 'Spintex Rd', to: 'Airport', base: 55, fee: 8.25, bonus: 0, method: 'online', km: 21 },
  { id: 'J-1012', at: now - 300 * HOUR, from: 'Dansoman', to: 'Mallam', base: 28, fee: 4.2, bonus: 0, method: 'online', km: 9 },
];
const MOCK_OFFER: Offer = { customer: 'Ama B.', from: 'Accra Mall', to: 'Osu Oxford St', fare: 35, km: 8.4, method: 'cash' };
const MOCK_CUSTOMER = { phone: '0201234567', rating: 4.9, trips: 58 }; // BACKEND: customer profile (photo, address, phone, stats) comes with the booking
const MOCK_NOTES: Note[] = [
  { id: 'n1', group: 'jobs', icon: '🛵', title: 'Busy at Accra Mall', msg: 'Several requests waiting near you.', at: now - 8 * 60000, read: false, action: 'Go There' },
  { id: 'n2', group: 'earnings', icon: '💰', title: 'Bonus earned +GH₵ 5', msg: 'Peak-hour bonus added to trip J-1041.', at: now - 4 * HOUR, read: false, action: 'View' },
  { id: 'n3', group: 'system', icon: '📄', title: 'Insurance under review', msg: 'We’ll let you know once it’s approved.', at: now - 20 * HOUR, read: true, action: 'View' },
  { id: 'n4', group: 'promos', icon: '🎁', title: 'Refer a rider, earn GH₵ 20', msg: 'Share your code from the Invite screen.', at: now - 40 * HOUR, read: true },
];
const RATINGS = { avg: 4.8, total: 312, dist: [248, 46, 12, 4, 2], acceptance: 92, response: 96, cancel: 3, dAcc: 2, dResp: 1, dCancel: -1 }; // dist = 5★..1★. BACKEND: GET /rider-performance/
const ANALYTICS = { perHr: 24.5, platformPerHr: 21, onlineHrs: 28.5, earningHrs: 21, km: 126 }; // BACKEND: GET /rider-analytics/
const DEMAND = [35, 85, 90, 55, 35, 30, 32, 38, 40, 45, 60, 92, 95, 85, 45, 30, 20]; // demand index for 06:00–22:00
const HOT_ZONES = ['Accra Mall', 'Madina', 'Circle']; // BACKEND: demand heat from bookings
const PEAK = { from: 18, to: 21, boost: 20 };
const WEATHER = { temp: 29, cond: 'Partly cloudy', rainFrom: '4 PM', rainTo: '7 PM' }; // BACKEND: weather API
const SUPPORT_PHONE = '0300000000';
const EMERGENCY = { name: 'Abena (sister)', phone: '0244000000', national: '112' }; // BACKEND: rider-set emergency contact
const CHECKIN_MS = 15 * 60_000; // safety check-in prompt interval during a trip
const MIN_DEPOSIT = 50; // GHS needed to receive delivery jobs
const BADGES = [
  { id: 'first', icon: '🥇', name: 'First Trip', desc: 'Complete your first trip.', at: '2026-09-14', cur: 1, target: 1, unit: 'trip' },
  { id: 'star', icon: '⭐', name: '5-Star Rider', desc: 'Get 10+ perfect ratings.', at: '2026-10-20', cur: 10, target: 10, unit: 'ratings' },
  { id: 'hundred', icon: '💯', name: '100 Trips', desc: 'Complete 100 trips.', at: '2026-11-28', cur: 100, target: 100, unit: 'trips' },
  { id: 'streak', icon: '🔥', name: '7-Day Streak', desc: 'Ride 7 days in a row.', at: null, cur: 4, target: 7, unit: 'days' },
  { id: 'fast', icon: '⚡', name: 'Fast Responder', desc: 'Accept requests within 10 s on average.', at: null, cur: 12, target: 20, unit: 'trips' },
  { id: 'night', icon: '🌙', name: 'Night Rider', desc: 'Complete 20+ evening trips.', at: null, cur: 6, target: 20, unit: 'trips' },
]; // BACKEND: GET /rider-badges/
const GUIDELINES = [
  ['⏱️', 'Be on time', 'Reach the pickup within the ETA. Wait up to 5 minutes before cancelling.'],
  ['🚫', 'Cancel rarely', 'Frequent cancellations lower your rating and the jobs you see.'],
  ['🛵', 'Keep your bike ready', 'Clean, fuelled, working lights, and a spare helmet for the passenger.'],
  ['💵', 'Confirm payment', 'For cash jobs, collect the exact fare. For online jobs, never ask for extra.'],
];
const SAFETY_TIPS = [
  'Share your trip with someone you trust on longer or late-night rides.',
  'Always wear your helmet and give your passenger one.',
  'Park in well-lit places while waiting. Trust your instincts and cancel if a pickup feels unsafe.',
  'Confirm the customer’s name before they board.',
  'Keep your phone charged and your emergency contact up to date.',
];
const HELP = [
  { cat: 'Getting Started', q: 'How do I start receiving jobs?', a: 'Tap GO ONLINE at the bottom of the screen. Turn on location and make sure none of your documents say Action needed.' },
  { cat: 'Getting Started', q: 'How do goals and bonuses work?', a: 'Finish a milestone before its countdown ends and the bonus is added to your wallet.' },
  { cat: 'Payments', q: 'When do I get paid?', a: 'Online earnings are paid out weekly to your Mobile Money number. Cash is yours as soon as you collect it.' },
  { cat: 'Payments', q: 'What is the service fee?', a: 'A small share of each fare. You can see it on every trip under Jobs, in the trip breakdown.' },
  { cat: 'Payments', q: 'How do withdrawals work?', a: 'Tap Withdraw Funds in your wallet to instantly take 85% of your balance. 15% stays held. Money only goes back to the number or card you deposited with.' },
  { cat: 'Documents & Verification', q: 'How long does verification take?', a: 'Usually within 24 hours. We’ll send a notification when each document is approved.' },
  { cat: 'Documents & Verification', q: 'A document says Action needed', a: 'Re-upload a clear photo with all four corners visible. Your account unlocks once it’s approved.' },
  { cat: 'Vehicle Info', q: 'Can I use more than one bike?', a: 'Yes. Add a vehicle in Account, upload its documents, then tap Set as active once it’s verified.' },
  { cat: 'Safety & Support', q: 'What does the emergency button do?', a: 'It calls your emergency contact and opens WhatsApp with your location ready to send.' },
  { cat: 'Safety & Support', q: 'How do I contact support?', a: 'Use Call or WhatsApp in the Support card at the bottom of Account.' },
];
const HELP_CATS = ['Payments', 'Documents & Verification', 'Vehicle Info', 'Safety & Support', 'Getting Started'];
const MOCK_SESSIONS = [
  { id: 's1', device: 'This phone · Chrome', where: 'Accra, GH', seen: 'Active now', current: true },
  { id: 's2', device: 'iPhone 12 · Safari', where: 'Tema, GH', seen: '2 days ago', current: false },
  { id: 's3', device: 'Windows PC · Edge', where: 'Kumasi, GH', seen: '9 days ago', current: false },
]; // BACKEND: GET /auth/sessions/
const DEFAULT_SCHED: Sched[] = [
  { on: true, from: 7, to: 18 }, { on: true, from: 7, to: 18 }, { on: true, from: 7, to: 18 }, { on: false, from: 7, to: 18 },
  { on: true, from: 17, to: 22 }, { on: true, from: 17, to: 22 }, { on: false, from: 17, to: 22 },
];
const ACTUAL_HRS = [9, 10, 8, 0, 4, 0, 0]; // hours actually ridden Mon..Sun this week. BACKEND: derive from online sessions
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── HELPERS ───
const money = (n: number) => n.toFixed(2);
const netOf = (j: Job) => j.base - j.fee + j.bonus;
const todayKey = () => new Date().toISOString().slice(0, 10);
const startOfDay = (t = Date.now()) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
const periodStart = (p: Period) => (p === 'today' ? startOfDay() : p === 'week' ? startOfDay() - 6 * 24 * HOUR : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());
const fmtDate = (t: number | string) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtFull = (t: string) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtHM = (ms: number) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : fmtDate(t); };
const h12 = (h: number) => `${h % 12 || 12}${h < 12 || h === 24 ? 'AM' : 'PM'}`;
const weekEnd = () => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); d.setHours(23, 59, 59, 0); return d.getTime(); };
const nextFriday = () => { const d = new Date(); d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7)); return d.getTime(); };
const summarize = (s: Sched[]) => {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (!s[i].on) continue;
    let j = i;
    while (j + 1 < 7 && s[j + 1].on && s[j + 1].from === s[i].from && s[j + 1].to === s[i].to) j++;
    out.push(`${i === j ? DAYS[i] : `${DAYS[i]}–${DAYS[j]}`} ${h12(s[i].from)}–${h12(s[i].to)}`);
    i = j;
  }
  return out.length ? `I ride: ${out.join(', ')}` : 'No rides scheduled';
};
const strength = (p: string) => [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* non-critical */ } },
};

const PRESS = 'transition active:scale-[0.97] hover:brightness-95';
const TAP = 'min-h-[44px]';
const BADGE: Record<DocStatus, { label: string; cls: string; icon: IconName }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700', icon: 'check' },
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800', icon: 'clock' },
  action: { label: 'Action needed', cls: 'bg-red-100 text-red-700', icon: 'alert' },
};

const NOTE_ICON: Record<NoteGroup, IconName> = { jobs: 'bike', earnings: 'wallet', system: 'file', promos: 'star' };
const L = (name: IconName, text: ReactNode) => <span className="inline-flex items-center justify-center gap-1.5"><Icon name={name} className="h-4 w-4 shrink-0" />{text}</span>;

// ─── SMALL COMPONENTS ───
const Spinner = ({ cls = 'h-5 w-5' }: { cls?: string }) => <span className={`inline-block ${cls} animate-spin rounded-full border-2 border-current border-t-transparent`} role="status" aria-label="Loading" />;

const GoalRing = ({ pct, k }: { pct: number; k: Theme }) => (
  <div className="relative h-20 w-20 shrink-0">
    <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" stroke={k.stroke} strokeOpacity="0.12" strokeWidth="4" />
      <circle cx="18" cy="18" r="15" fill="none" stroke="#F9D342" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - pct} className="transition-all duration-700" />
    </svg>
    <span className={`absolute inset-0 flex items-center justify-center text-sm font-extrabold ${k.ink}`}>{pct}%</span>
  </div>
);

const Stars = ({ v, size = 'text-3xl' }: { v: number; size?: string }) => (
  <span className={`relative inline-block leading-none ${size}`} role="img" aria-label={`${v} out of 5 stars`}>
    <span className="text-gray-400/40">★★★★★</span>
    <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-[#F9D342]" style={{ width: `${(v / 5) * 100}%` }}>★★★★★</span>
  </span>
);

const Donut = ({ parts, k }: { parts: { v: number; c: string; l: string }[]; k: Theme }) => {
  const total = parts.reduce((s, p) => s + p.v, 0);
  let acc = 0;
  return (
    <svg viewBox="0 0 36 36" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={`Breakdown: ${parts.map(p => `${p.l} ${money(p.v)}`).join(', ')}`}>
      <circle cx="18" cy="18" r="14" fill="none" stroke={k.stroke} strokeOpacity="0.1" strokeWidth="6" />
      {total > 0 && parts.map(p => {
        const len = (p.v / total) * 100;
        const el = <circle key={p.l} cx="18" cy="18" r="14" fill="none" stroke={p.c} strokeWidth="6" pathLength={100} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-acc} />;
        acc += len;
        return el;
      })}
    </svg>
  );
};

const Toggle = ({ on, onChange, label, k }: { on: boolean; onChange: (v: boolean) => void; label: string; k: Theme }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-center">
    <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-emerald-500' : k.soft}`}>
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

// Bottom sheet: Escape closes, backdrop closes, page behind stops scrolling, focused inputs scroll above the keyboard
const Sheet = ({ title, onClose, children, k }: { title: string; onClose: () => void; children: ReactNode; k: Theme }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}
      onClick={e => e.target === e.currentTarget && onClose()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <div className={`max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ${k.sheet} ${k.ink}`}
        onFocusCapture={e => { const t = e.target as HTMLElement; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName)) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); }}>
        <div className={`mx-auto mb-3 h-1 w-10 rounded-full ${k.soft}`} />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className={`flex h-11 w-11 items-center justify-center rounded-full ${k.soft} ${PRESS}`}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Collapsible card used for the long Account tab
const Fold = ({ title, icon, children, open: initial = false, k }: { title: string; icon: IconName; children: ReactNode; open?: boolean; k: Theme }) => {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`rounded-3xl ${k.card}`}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className={`flex ${TAP} w-full items-center gap-3 p-4 text-left ${k.ink}`}>
        <Icon name={icon} className="h-5 w-5 shrink-0" />
        <span className="flex-1 font-extrabold">{title}</span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''} ${k.faint}`} aria-hidden="true">›</span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
};

// ─── PAGE ───
export default function RiderDashboardPage() {
  // navigation + shell
  const [tab, setTab] = useState<Tab>('home');
  const [shown, setShown] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true); // skeleton state, true on first load and on every refresh
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(Date.now());
  const [netOnline, setNetOnline] = useState(true);
  const [pull, setPull] = useState(0);
  const [tick, setTick] = useState(0);
  const [themePref, setThemePref] = useState<ThemePref>('system');
  const [systemDark, setSystemDark] = useState(false);
  // work state
  const [online, setOnline] = useState(false);
  const [onlineSince, setOnlineSince] = useState<number | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [job, setJob] = useState<(Offer & { stage: Stage }) | null>(null);
  const [history, setHistory] = useState<Job[]>(MOCK_HISTORY);
  const [onBreak, setOnBreak] = useState(false);
  // jobs tab
  const [jobsView, setJobsView] = useState<'earnings' | 'performance'>('earnings');
  const [period, setPeriod] = useState<Period>('today');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [openTx, setOpenTx] = useState<string | null>(null);
  // home extras
  const [guideOpen, setGuideOpen] = useState(false);
  const [goal, setGoal] = useState(MOCK_RIDER.dailyGoal);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [weatherOpen, setWeatherOpen] = useState(true);
  const [checkin, setCheckin] = useState(false);
  // sheets + notifications
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [notesOpen, setNotesOpen] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [badgeSel, setBadgeSel] = useState<string | null>(null);
  // account
  const [rider, setRider] = useState(MOCK_RIDER);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: MOCK_RIDER.name, phone: MOCK_RIDER.phone, email: MOCK_RIDER.email });
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [addVeh, setAddVeh] = useState(false);
  const [vehForm, setVehForm] = useState({ model: '', plate: '', color: '' });
  const [sched, setSched] = useState<Sched[]>(DEFAULT_SCHED);
  const [helpQ, setHelpQ] = useState('');
  const [helpCat, setHelpCat] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [twoFA, setTwoFA] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [code, setCode] = useState('');
  const [logoutAll, setLogoutAll] = useState(false);
  // wallet, service, chat, photo, proof of delivery
  const [walletBal, setWalletBal] = useState(MOCK_RIDER.walletBalance);
  const [dest, setDest] = useState<Dest>(null); // BACKEND: saved deposit method, locked once set
  const [svc, setSvc] = useState('ride'); // BACKEND: PATCH /rider-services/active/
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoStatus, setPhotoStatus] = useState<'verified' | 'pending' | 'none'>('none');
  const [proofOpen, setProofOpen] = useState(false);
  const [showDone, setShowDone] = useState(false); // map: show completed jobs
  const [walletOpen, setWalletOpen] = useState(false); // dedicated wallet page
  const [walletView, setWalletView] = useState<'deposit' | 'withdraw'>('deposit');
  const [txns, setTxns] = useState<Txn[]>([]); // BACKEND: GET /wallet/transactions/

  const touchY = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dark = themePref === 'dark' || (themePref === 'system' && systemDark);
  const K: Theme = dark ? DARK : LIGHT;

  const notify = useCallback((msg: string, type: 'ok' | 'err' | 'info' = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Add an in-app notification. BACKEND: these come from your push/websocket feed.
  const pushNote = useCallback((group: NoteGroup, icon: string, title: string, msg: string, action?: string) => {
    setNotes(p => [{ id: `n${Date.now()}${Math.round(Math.random() * 999)}`, group, icon, title, msg, at: Date.now(), read: false, action }, ...p]);
  }, []);

  // Pretend-save indicator. BACKEND: call this after each successful PATCH/POST instead.
  const touchSync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSynced(Date.now()); }, 700);
  }, []);

  // ─── EFFECTS ───
  useEffect(() => {
    const t = store.get('rydn_dash_tab') as Tab | null;
    if (t && ['home', 'jobs', 'account'].includes(t)) setTab(t);
    setGuideOpen(store.get('rydn_guide_seen') !== todayKey());
    const th = store.get('rydn_theme') as ThemePref | null;
    if (th && ['light', 'dark', 'system'].includes(th)) setThemePref(th);
    const g = Number(store.get('rydn_goal')); if (g > 0) setGoal(g);
    setQuiet(store.get('rydn_quiet') === '1');
    setOnBreak(store.get('rydn_break') === '1');
    try { const s = JSON.parse(store.get('rydn_sched') || 'null'); if (Array.isArray(s) && s.length === 7) setSched(s); } catch { /* ignore */ }
    setNetOnline(navigator.onLine);
    const timer = setTimeout(() => setLoading(false), 900); // BACKEND: replace with real initial fetches
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const up = () => { setNetOnline(true); touchSync(); notify('Back online.', 'ok'); };
    const down = () => setNetOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [notify, touchSync]);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30_000); return () => clearInterval(id); }, []);

  // Safety check-in while a trip is in progress
  useEffect(() => {
    if (job?.stage !== 'trip') { setCheckin(false); return; }
    const id = setInterval(() => setCheckin(true), CHECKIN_MS);
    return () => clearInterval(id);
  }, [job?.stage]);

  // Grab a position snapshot when the safety centre opens (used for the emergency / share links)
  useEffect(() => {
    if (!safetyOpen || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setCoords(null), { timeout: 8000 });
  }, [safetyOpen]);

  useEffect(() => {
    if (!walletOpen) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setWalletOpen(false);
    document.addEventListener('keydown', on);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', on); document.body.style.overflow = prev; };
  }, [walletOpen]);

  // ─── DERIVED ───
  void tick;
  const docState: DocStatus = MOCK_DOCS.some(d => d.status === 'action') ? 'action' : MOCK_DOCS.some(d => d.status === 'pending') ? 'pending' : 'verified';
  const todayJobs = useMemo(() => history.filter(j => j.at >= startOfDay()), [history]);
  const todayEarned = todayJobs.reduce((s, j) => s + netOf(j), 0);
  const goalPct = Math.min(100, Math.round((todayEarned / Math.max(goal, 1)) * 100));
  const weekJobs = useMemo(() => history.filter(j => j.at >= periodStart('week')), [history]);
  const weekNet = weekJobs.reduce((s, j) => s + netOf(j), 0);
  const allTimeNet = useMemo(() => history.reduce((s, j) => s + netOf(j), 0), [history]);
  const periodJobs = useMemo(() => history.filter(j => j.at >= periodStart(period)), [history, period]);
  const totals = useMemo(() => {
    const t = { base: 0, fee: 0, bonus: 0, net: 0, cashNet: 0, onlineNet: 0 };
    for (const j of periodJobs) {
      const n = netOf(j);
      t.base += j.base; t.fee += j.fee; t.bonus += j.bonus; t.net += n;
      if (j.method === 'cash') t.cashNet += n; else t.onlineNet += n;
    }
    return t;
  }, [periodJobs]);
  const weekBars = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay() - (6 - i) * 24 * HOUR;
    return { label: new Date(d).toLocaleDateString('en-GB', { weekday: 'narrow' }), v: history.filter(j => j.at >= d && j.at < d + 24 * HOUR).reduce((s, j) => s + netOf(j), 0) };
  }), [history]);
  const maxBar = Math.max(...weekBars.map(b => b.v), 1);
  const listJobs = useMemo(() => periodJobs.filter(j => (txFilter === 'cash' ? j.method === 'cash' : txFilter === 'online' ? j.method === 'online' : txFilter === 'bonus' ? j.bonus > 0 : txFilter === 'fee' ? j.fee > 0 : true)), [periodJobs, txFilter]);
  const unread = notes.filter(n => !n.read).length;
  const shiftMs = online && onlineSince ? Date.now() - onlineSince : 0;
  const hour = new Date().getHours();
  const inPeak = hour >= PEAK.from && hour < PEAK.to;
  const minsToPeak = hour < PEAK.from ? (PEAK.from - hour) * 60 - new Date().getMinutes() : 0;
  const msLeft = Math.max(0, weekEnd() - Date.now());
  const leftTxt = `${Math.floor(msLeft / 86400000)}d ${Math.floor((msLeft % 86400000) / HOUR)}h left`;
  const milestones = [
    { id: 'm1', title: 'Complete 10 trips', reward: 15, cur: weekJobs.length, target: 10, fmt: (n: number) => String(n) },
    { id: 'm2', title: 'Earn GH₵ 300 this week', reward: 25, cur: weekNet, target: 300, fmt: (n: number) => `GH₵ ${Math.round(n)}` },
  ];
  const nextBadge = BADGES.filter(b => !b.at).sort((a, b) => b.cur / b.target - a.cur / a.target)[0];
  const tomorrowIdx = (((new Date().getDay() + 6) % 7) + 1) % 7;
  const etaMin = job ? Math.max(3, Math.round(job.km * 3)) : 0;
  const tripMsg = `I’m on a Rydnow ${job ? `trip: ${job.from} to ${job.to}, ETA about ${etaMin} min.` : 'job.'}${coords ? ` My location: https://www.google.com/maps?q=${coords.lat},${coords.lon}` : ''}`;
  const customerInfo = job ? { name: job.customer, address: job.to, phone: MOCK_CUSTOMER.phone, rating: MOCK_CUSTOMER.rating, trips: MOCK_CUSTOMER.trips } : null; // BACKEND: real customer profile + verified photo
  const svcName = DEFAULT_SERVICES.find(s => s.id === svc)?.name ?? '';
  const txList = [...txns, ...history.slice(0, 8).map(j => ({ id: j.id, kind: 'earning' as const, label: `${j.from} → ${j.to}`, amount: netOf(j), at: j.at }))].sort((a, b) => b.at - a.at).slice(0, 12);
  const initials = rider.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // ─── ACTIONS ───
  const changeTab = (t: Tab) => {
    if (t === tab) return;
    setShown(false);
    setTimeout(() => { setTab(t); store.set('rydn_dash_tab', t); setShown(true); window.scrollTo({ top: 0 }); }, 120);
  };

  // One tap, no confirmation. BACKEND: PATCH /auth/me/ { online } + start sending GPS to /update-rider-location/
  const toggleOnline = () => {
    if (online) {
      if (job) return notify('Finish your current trip before going offline.', 'err');
      setOnline(false); setOnlineSince(null); setOffer(null);
      return notify('You’re offline.', 'info');
    }
    if (docState === 'action') return notify('Fix your documents in Account before going online.', 'err');
    if (svc !== 'ride' && walletBal < MIN_DEPOSIT) return notify(`Minimum deposit: ${MIN_DEPOSIT} GHS is required to receive delivery jobs. Top up in your Wallet.`, 'err');
    setOnline(true); setOnlineSince(Date.now());
    notify(onBreak ? 'You’re online, but on a break. Offers are paused.' : 'You’re online. Looking for jobs…', onBreak ? 'info' : 'ok');
  };

  // Pull-to-refresh / manual refresh. BACKEND: re-fetch bookings, wallet, profile, notifications here.
  const refresh = async () => {
    if (refreshing) return;
    if (!netOnline) return notify('You’re offline. We’ll refresh when you reconnect.', 'err');
    setRefreshing(true); setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false); setRefreshing(false); setLastSynced(Date.now());
    notify('Up to date.', 'ok');
  };
  const onTouchStart = (e: React.TouchEvent) => { if (window.scrollY <= 0) touchY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => { if (touchY.current !== null) setPull(Math.min(80, Math.max(0, e.touches[0].clientY - touchY.current))); };
  const onTouchEnd = () => { if (pull > 60) refresh(); touchY.current = null; setPull(0); };

  const changeService = (id: string, name: string) => {
    if (job) return notify('Finish your current trip before switching service.', 'err');
    setSvc(id); setOffer(null); touchSync(); // BACKEND: PATCH /rider-services/active/ { service: id }
    notify(`Service updated to: ${name}. Jobs for this service will now appear.`, 'ok');
  };

  const sendMsg = (text: string) => {
    const id = `m${Date.now()}`;
    setMsgs(m => [...m, { id, from: 'rider', text, at: Date.now(), read: false }]); // BACKEND: POST /bookings/{id}/messages/ or websocket send
    setTimeout(() => setMsgs(m => m.map(x => (x.id === id ? { ...x, read: true } : x))), 1500); // demo read receipt
  };
  const addSystemMsg = (text: string) => setMsgs(m => [...m, { id: `s${Date.now()}${m.length}`, from: 'system', text, at: Date.now() }]);

  const acceptOffer = () => {
    if (offer) {
      setJob({ ...offer, stage: 'pickup' }); setMsgs([]); setOffer(null); notify('Job accepted. Head to pickup.', 'ok');
      pushNote('jobs', '✅', 'Job accepted', `${offer.from} → ${offer.to}`);
    }
  }; // BACKEND: POST /accept-booking/
  const advance = () => {
    if (!job) return;
    if (job.stage === 'pickup') { // BACKEND: POST /arrive-ride/
      setJob({ ...job, stage: 'arrived' });
      addSystemMsg('You arrived. Say hello to the customer.');
      setChatOpen(true); // chat opens automatically on arrival
      return;
    }
    if (job.stage === 'arrived') return setJob({ ...job, stage: 'trip' }); // BACKEND: POST /start-ride/
    setProofOpen(true); // trip finished: proof of delivery comes first, then the job completes
  };

  // Runs after proof is submitted. BACKEND: POST /complete-ride/ (multipart: proof image or scanned code), server credits the wallet.
  const completeJob = async (proof: { file?: File; code?: string }) => {
    if (!job) return;
    await new Promise(r => setTimeout(r, 900));
    const fee = +(job.fare * 0.15).toFixed(2);
    const bonus = inPeak ? +(job.fare * 0.1).toFixed(2) : 0;
    const net = job.fare - fee + bonus;
    const proofRef = proof.file ? URL.createObjectURL(proof.file) : `code:${proof.code}`;
    setHistory(h => [{ id: `J-${1043 + h.length}`, at: Date.now(), from: job.from, to: job.to, base: job.fare, fee, bonus, method: job.method, km: job.km, proof: proofRef }, ...h]);
    setWalletBal(b => +(b + net).toFixed(2));
    addSystemMsg('Delivery completed — proof submitted');
    pushNote('earnings', '💰', 'Payment received', `GH₵ ${money(net)} added to your wallet.`, 'View');
    pushNote('jobs', '📎', 'Proof of delivery uploaded', `${job.from} → ${job.to}`);
    setProofOpen(false); setChatOpen(false);
    notify(`Delivery Completed ✅ +GH₵ ${money(net)}`, 'ok');
    setJob(null); touchSync();
  };

  const onWalletDeposit = (a: number, d: NonNullable<Dest>) => {
    setWalletBal(b => +(b + a).toFixed(2)); setDest(d); touchSync();
    setTxns(t => [{ id: `t${Date.now()}`, kind: 'deposit', label: `Deposit · ${d.masked}`, amount: a, at: Date.now() }, ...t]);
    pushNote('earnings', '', 'Deposit received', `GH₵ ${money(a)} added to your wallet.`);
  };
  const onWalletWithdraw = (a: number) => {
    setWalletBal(b => +(b - a).toFixed(2)); touchSync();
    setTxns(t => [{ id: `t${Date.now()}`, kind: 'withdraw', label: `Withdrawal · ${dest?.masked ?? ''}`, amount: -a, at: Date.now() }, ...t]);
    pushNote('earnings', '', 'Withdrawal processed', `GH₵ ${money(a)} sent to ${dest?.masked ?? 'your account'}.`);
  };

  const saveProfile = async () => {
    if (!form.name.trim()) return notify('Enter your full name.', 'err');
    if (!/^0\d{9}$/.test(form.phone.replace(/\s/g, ''))) return notify('Enter a valid 10-digit phone number.', 'err');
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 700)); // BACKEND: PATCH /auth/me/ { name, phone, email }
      setRider(r => ({ ...r, ...form }));
      setEditing(false); touchSync(); notify('Profile updated.', 'ok');
    } catch {
      notify('We couldn’t save your changes. Please try again.', 'err'); // never show technical details
    } finally { setSaving(false); }
  };

  const saveGoal = (v: number) => {
    if (!(v >= 10)) return notify('Pick a goal of GH₵ 10 or more.', 'err');
    setGoal(v); store.set('rydn_goal', String(v)); setGoalOpen(false); touchSync(); notify('Daily goal updated.', 'ok');
  };
  const updateSched = (i: number, patch: Partial<Sched>) => {
    setSched(prev => {
      const next = prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
      if (next[i].to <= next[i].from) next[i] = { ...next[i], to: Math.min(24, next[i].from + 1) };
      store.set('rydn_sched', JSON.stringify(next)); // BACKEND: PUT /rider-schedule/
      return next;
    });
    touchSync();
  };
  const setTheme = (t: ThemePref) => { setThemePref(t); store.set('rydn_theme', t); };
  const toggleBreak = (v: boolean) => { setOnBreak(v); store.set('rydn_break', v ? '1' : '0'); if (v) setOffer(null); notify(v ? 'Break on. Job offers are paused.' : 'Welcome back. Offers resumed.', v ? 'info' : 'ok'); touchSync(); };
  const setQuietHours = (v: boolean) => { setQuiet(v); store.set('rydn_quiet', v ? '1' : '0'); }; // BACKEND: PATCH notification prefs

  const setActiveVehicle = (id: string) => {
    const v = vehicles.find(x => x.id === id);
    if (!v || v.active) return;
    if (job) return notify('Finish your current trip first.', 'err');
    if (v.status !== 'verified') return notify('This vehicle needs verified documents first.', 'err');
    setVehicles(vs => vs.map(x => ({ ...x, active: x.id === id }))); // BACKEND: PATCH /rider-vehicles/{id}/ { active: true }
    touchSync(); notify(`${v.model} is now your active vehicle.`, 'ok');
  };
  const submitVehicle = () => {
    if (!vehForm.model.trim() || !vehForm.plate.trim()) return notify('Enter the model and plate number.', 'err');
    setVehicles(vs => [...vs, { id: `v${vs.length + 1}`, model: vehForm.model.trim(), plate: vehForm.plate.trim().toUpperCase(), color: vehForm.color.trim() || '—', active: false, status: 'pending', service: '2027-03-01', kmLeft: 3000 }]); // BACKEND: POST /rider-vehicles/ then open document upload
    setAddVeh(false); setVehForm({ model: '', plate: '', color: '' }); touchSync(); notify('Vehicle added. Upload its documents to verify it.', 'ok');
  };

  const submitPw = async () => {
    if (!pw.cur) return notify('Enter your current password.', 'err');
    if (pw.next.length < 8 || strength(pw.next) < 3) return notify('Choose a stronger password.', 'err');
    if (pw.next !== pw.again) return notify('The new passwords don’t match.', 'err');
    setSaving(true);
    await new Promise(r => setTimeout(r, 700)); // BACKEND: POST /auth/change-password/
    setSaving(false); setPwOpen(false); setPw({ cur: '', next: '', again: '' }); notify('Password changed.', 'ok');
  };
  const enable2FA = () => {
    if (!/^\d{6}$/.test(code)) return notify('Enter the 6-digit code we sent you.', 'err');
    setTwoFA(true); setTwoFAOpen(false); setCode(''); notify('Two-factor authentication is on.', 'ok'); // BACKEND: POST /auth/2fa/verify/
  };

  const openNoteAction = (n: Note) => {
    setNotes(p => p.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    setNotesOpen(false);
    if (n.group === 'jobs') window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Accra Mall, Accra, Ghana')}`, '_blank', 'noopener');
    else changeTab(n.group === 'earnings' ? 'jobs' : 'account');
  };
  const emergency = () => {
    window.open(`https://wa.me/233${EMERGENCY.phone.slice(1)}?text=${encodeURIComponent(`EMERGENCY. ${tripMsg}`)}`, '_blank', 'noopener');
    window.location.href = `tel:${EMERGENCY.phone}`;
  };
  const dismissGuide = () => { setGuideOpen(false); store.set('rydn_guide_seen', todayKey()); };
  const logout = () => notify('Signed out (connect your logout route).', 'info'); // BACKEND: clear token, router.replace('/login')

  // ─── RENDER HELPERS (plain functions so inputs keep focus) ───
  const gate = (h: string, node: ReactNode) => (loading ? <div className={`animate-pulse rounded-3xl ${K.skel} ${h}`} aria-busy="true" aria-label="Loading" /> : node);
  const card = (extra = '') => `rounded-3xl p-4 ${K.card} ${extra}`;
  const primary = `${TAP} rounded-full ${K.btn} px-4 text-sm font-extrabold ${PRESS}`;
  const ghost = `${TAP} rounded-full border ${K.line} px-4 text-sm font-bold ${K.ink} ${PRESS}`;
  const gold = `${TAP} rounded-full bg-[#F9D342] px-4 text-sm font-extrabold text-[#0A2342] ${PRESS}`;
  const chip = (on: boolean) => `${TAP} shrink-0 rounded-full border px-4 text-xs font-bold transition ${on ? 'border-[#F9D342] bg-[#F9D342] text-[#0A2342]' : `${K.line} ${K.sub}`}`;
  const empty = (icon: IconName, title: string, body: string) => (
    <div className={`${card()} py-8 text-center`}><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F9D342]/25"><Icon name={icon} className="h-7 w-7" /></span><p className={`mt-2 font-extrabold ${K.ink}`}>{title}</p><p className={`mt-1 text-sm ${K.sub}`}>{body}</p></div>
  );
  const trend = (d: number, goodWhenUp = true) => {
    const good = goodWhenUp ? d >= 0 : d <= 0;
    return <span className={`text-xs font-extrabold ${d === 0 ? K.faint : good ? 'text-emerald-500' : 'text-red-500'}`} aria-label={good ? 'improving' : 'declining'}>{d === 0 ? '–' : d > 0 ? '↑' : '↓'} {Math.abs(d)}%</span>;
  };
  const field = (label: string, key: 'name' | 'phone' | 'email', type = 'text') => (
    <label className="block">
      <span className={`mb-1 block text-xs font-semibold ${K.faint}`}>{label}</span>
      {editing ? <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={`${TAP} w-full rounded-xl border px-3 text-base outline-none focus:ring-2 focus:ring-[#F9D342] ${K.input}`} /> : <p className={`py-1 font-semibold ${K.ink}`}>{rider[key]}</p>}
    </label>
  );
  const input = (label: string, value: string, onChange: (v: string) => void, type = 'text', ph = '') => (
    <label className="mb-3 block"><span className={`mb-1 block text-xs font-semibold ${K.faint}`}>{label}</span>
      <input type={type} value={value} placeholder={ph} onChange={e => onChange(e.target.value)} className={`${TAP} w-full rounded-xl border px-3 text-base outline-none focus:ring-2 focus:ring-[#F9D342] ${K.input}`} /></label>
  );

  const syncRow = () => {
    const s = !netOnline ? 'offline' : syncing ? 'syncing' : 'saved';
    const txt = s === 'offline' ? 'Offline — using cached data. Reconnecting…' : s === 'syncing' ? 'Syncing…' : `All changes saved · ${ago(lastSynced)}`;
    return (
      <div className={`flex items-center justify-between gap-2 rounded-2xl pl-3 text-xs font-semibold ${s === 'offline' ? 'bg-red-100 text-red-700' : s === 'syncing' ? 'bg-amber-100 text-amber-800' : `${K.soft} ${K.sub}`}`} role="status">
        <span className="flex items-center gap-1.5"><Icon name={s === 'offline' ? 'alert' : s === 'syncing' ? 'refresh' : 'check'} className="h-4 w-4 shrink-0" />{txt}</span>
        <button onClick={refresh} aria-label="Refresh now" className="flex h-11 w-11 items-center justify-center rounded-full">{refreshing ? <Spinner cls="h-4 w-4" /> : <Icon name="refresh" className="h-4 w-4" />}</button>
      </div>
    );
  };

  // ─── HOME ───
  const homeTab = () => (
    <div className="space-y-4">
      {syncRow()}
      <ServiceToggle k={K} services={DEFAULT_SERVICES} current={svc} onChange={s => changeService(s.id, s.name)} />
      {svc !== 'ride' && walletBal < MIN_DEPOSIT && (
        <button onClick={() => setWalletOpen(true)} className={`w-full rounded-2xl bg-amber-100 p-3 text-left text-sm font-bold text-amber-900 ${PRESS}`}>⚠️ Minimum deposit: {MIN_DEPOSIT} GHS (Cedis) is required to receive delivery jobs. Tap to top up.</button>
      )}
      {onBreak && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-100 p-3 text-sm font-semibold text-amber-900" role="status">
          <span>☕ You’re on a break. Job offers are paused.</span>
          <button onClick={() => toggleBreak(false)} className="min-h-[44px] shrink-0 rounded-full bg-amber-900 px-4 text-xs font-bold text-white">End break</button>
        </div>
      )}
      {checkin && (
        <section className="rounded-3xl border-2 border-sky-400 bg-sky-50 p-4 text-sky-900" role="alert">
          <p className="font-extrabold">Still on a trip? Confirm you’re safe 🛡️</p>
          <div className="mt-3 flex gap-3">
            <button onClick={() => { setCheckin(false); notify('Thanks. Ride safe.', 'ok'); }} className="min-h-[44px] flex-1 rounded-full bg-sky-600 text-sm font-bold text-white">I’m safe</button>
            <button onClick={() => { setCheckin(false); setSafetyOpen(true); }} className="min-h-[44px] flex-1 rounded-full bg-red-600 text-sm font-bold text-white">I need help</button>
          </div>
        </section>
      )}

      {guideOpen ? (
        <section className="rounded-3xl bg-[#0A2342] p-5 text-white shadow-[0_10px_30px_rgba(10,35,66,0.35)]">
          <h2 className="text-lg font-extrabold">Know before you go 👋</h2>
          <ul className="mt-3 space-y-3">
            {GUIDELINES.map(([icon, title, body]) => (
              <li key={title} className="flex gap-3"><span className="text-xl" aria-hidden="true">{icon}</span><p className="text-sm leading-snug text-white/80"><b className="text-white">{title}.</b> {body}</p></li>
            ))}
          </ul>
          <button onClick={dismissGuide} className={`mt-4 w-full ${gold}`}>I’ve read — Got it</button>
        </section>
      ) : (
        <button onClick={() => setGuideOpen(true)} className={`flex ${TAP} w-full items-center justify-between rounded-2xl px-4 text-left text-sm font-semibold ${K.card} ${K.ink} ${PRESS}`}><span>{L('book', 'Rider guidelines')}</span><span className={`text-xs ${K.faint}`}>Show</span></button>
      )}

      {/* Map placeholder. BACKEND: swap this block for your Leaflet <LiveMap /> (hot zones = heat circles, pickups = 📍, destination = 🔴) */}
      <section className={`relative h-56 overflow-hidden rounded-3xl ring-1 ring-black/10 ${K.map}`}>
        <svg viewBox="0 0 400 224" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g stroke={K.road} strokeWidth="10" fill="none" strokeLinecap="round">
            <path d="M-10 150 C100 120 160 190 260 120 S380 60 420 90" /><path d="M80 -10 C110 60 90 140 140 240" /><path d="M300 -10 C280 70 330 150 310 240" />
          </g>
          {online && !onBreak && (<><circle cx="110" cy="100" r="34" fill="#F9D342" fillOpacity="0.45" /><circle cx="300" cy="150" r="26" fill="#F9D342" fillOpacity="0.4" /></>)}
          {online && !onBreak && !job && (<><text x="104" y="106" fontSize="18">📍</text><text x="294" y="156" fontSize="18">📍</text></>)}
          {showDone && (<><text x="60" y="190" fontSize="16" opacity="0.6">✔️</text><text x="340" y="70" fontSize="16" opacity="0.6">✔️</text></>)}
          {job && <path d="M200 120 C230 90 270 100 320 60" stroke={K.stroke} strokeWidth="4" strokeDasharray="2 8" strokeLinecap="round" fill="none" />}
          {job && <circle cx="320" cy="60" r="8" fill="#EF4444" stroke="#fff" strokeWidth="3" />}
        </svg>
        <span className="absolute left-[48%] top-[48%] flex h-5 w-5">
          {online && <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative h-5 w-5 rounded-full border-4 border-white shadow ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </span>
        <div className="absolute right-2 top-2 flex flex-col gap-2">
          <button onClick={refresh} aria-label="Refresh map" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-lg shadow">{refreshing ? <Spinner cls="h-4 w-4" /> : <Icon name="refresh" className="h-4 w-4" />}</button>
          <button onClick={() => setShowDone(s => !s)} aria-pressed={showDone} aria-label="Show completed jobs" className={`flex h-11 w-11 items-center justify-center rounded-full text-lg shadow ${showDone ? 'bg-[#F9D342]' : 'bg-white/95'}`}><Icon name="check" className="h-5 w-5 text-[#0A2342]" /></button>
        </div>
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#0A2342] shadow"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />You <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#F9D342]" />Jobs <span className="mx-1 inline-block h-2 w-2 rounded-full bg-red-500" />Destination</div>
        {online && !job && <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 px-3 py-2 text-xs font-semibold text-[#0A2342] shadow">🔥 High demand: {HOT_ZONES.join(' · ')}</div>}
      </section>

      {/* Offer / active job / empty */}
      {offer && (
        <section className="rounded-3xl border-2 border-[#F9D342] p-4 shadow-[0_10px_30px_rgba(249,211,66,0.35)]" role="alertdialog" aria-label="New job request" style={{ background: dark ? '#0E2240' : '#fff' }}>
          <div className="flex items-start justify-between">
            <div><p className="text-xs font-bold text-amber-500">NEW REQUEST · {offer.km} km</p><p className={`mt-1 text-sm font-bold ${K.ink}`}>{offer.from} → {offer.to}</p></div>
            <p className={`text-2xl font-black ${K.ink}`}>GH₵ {money(offer.fare)}</p>
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={() => { setOffer(null); notify('Request declined.', 'info'); }} className={`flex-1 ${ghost}`}>Decline</button>
            <button onClick={acceptOffer} className={`flex-[2] ${primary}`}>Accept</button>
          </div>
        </section>
      )}
      {job ? (
        <section className={card('space-y-4')}>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{job.stage === 'pickup' ? 'Heading to pickup' : job.stage === 'arrived' ? 'At pickup' : 'Trip in progress'}</span>
            <p className={`text-2xl font-black ${K.ink}`}>GH₵ {money(job.fare)}</p>
          </div>
          <div className={`space-y-2 text-sm font-semibold ${K.ink}`}><p>🔵 {job.from}</p><p>🟡 {job.to}</p><p className={`text-xs font-medium ${K.faint}`}>{job.customer} · {job.method === 'cash' ? 'Collect cash' : 'Paid online'}</p></div>
          <div className="flex gap-3">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${job.stage === 'trip' ? job.to : job.from}, Accra, Ghana`)}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className={`flex flex-1 items-center justify-center ${ghost}`}>{L('navigation', 'Navigate')}</a>
            <button onClick={advance} className={`${TAP} flex-[2] rounded-full text-sm font-extrabold ${PRESS} ${job.stage === 'trip' ? 'bg-emerald-500 text-white' : 'bg-[#F9D342] text-[#0A2342]'}`}>{job.stage === 'pickup' ? 'I’ve arrived' : job.stage === 'arrived' ? 'Start trip' : 'Complete trip'}</button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setChatOpen(true)} className={`flex-1 ${ghost}`}>{L('chat', 'Chat with customer')}</button>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(tripMsg)}`, '_blank', 'noopener')} className={`flex-1 ${ghost}`}>{L('pin', 'Share my trip')}</button>
          </div>
        </section>
      ) : !offer && (
        <section className={`${card()} py-8 text-center`}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F9D342]/25"><Icon name={onBreak ? 'clock' : online ? 'pin' : 'bike'} className="h-7 w-7" /></span>
          <p className={`mt-2 font-extrabold ${K.ink}`}>{onBreak ? 'On a break' : online ? 'You’re online and ready' : 'You’re offline'}</p>
          <p className={`mt-1 text-sm ${K.sub}`}>{onBreak ? 'Switch off break mode in Account → Schedule to get offers.' : online ? `Waiting for ${svcName} jobs near you…` : 'Tap Go Online below to start earning.'}</p>
          {/* Demo helper. BACKEND: delete this; offers will arrive from polling /list-bookings/ */}
          {online && !onBreak && <button onClick={() => { setOffer(MOCK_OFFER); pushNote('jobs', '🛵', 'New job alert', `${MOCK_OFFER.from} → ${MOCK_OFFER.to}`); }} className={`mt-4 ${TAP} rounded-full border border-dashed ${K.line} px-4 text-xs font-semibold ${K.sub}`}>Simulate a job request</button>}
        </section>
      )}

      {/* Daily goal */}
      {gate('h-28', (
        <section className={`${card()} flex items-center gap-4`}>
          <GoalRing pct={goalPct} k={K} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold ${K.faint}`}>Today’s earnings</p>
            <p className={`text-3xl font-black tracking-tight ${K.ink}`}>GH₵ {money(todayEarned)}</p>
            <p className={`text-xs ${K.sub}`}>{todayJobs.length} trips · goal GH₵ {goal}</p>
            <button onClick={() => { setGoalInput(String(goal)); setGoalOpen(true); }} className={`${TAP} -ml-1 px-1 text-xs font-bold underline decoration-[#F9D342] decoration-2 underline-offset-4 ${K.ink}`}>Edit goal</button>
          </div>
          <div className="text-right"><p className={`text-[11px] ${K.faint}`}>Shift</p><p className={`text-sm font-extrabold ${K.ink}`}>{online ? fmtHM(shiftMs) : '—'}</p></div>
        </section>
      ))}

      {/* Milestones, streak, peak hours */}
      {gate('h-72', (
        <section className={card('space-y-3')}>
          <div className="flex items-center justify-between"><h2 className={`font-extrabold ${K.ink}`}>Goals & milestones</h2><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">🔥 {rider.streakDays}-day streak</span></div>
          <p className={`text-xs ${K.sub}`}>Keep it up! Ride tomorrow to make it {rider.streakDays + 1} days.</p>
          {milestones.map(m => {
            const pct = Math.min(100, Math.round((m.cur / m.target) * 100));
            return (
              <div key={m.id} className={`rounded-2xl p-3 ${K.soft}`}>
                <div className="flex items-center justify-between gap-2"><p className={`text-sm font-bold ${K.ink}`}>{m.title}</p><span className="shrink-0 rounded-full bg-[#F9D342] px-2 py-0.5 text-[11px] font-extrabold text-[#0A2342]">+GH₵ {m.reward}</span></div>
                <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${dark ? 'bg-white/15' : 'bg-[#0A2342]/10'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={m.title}><div className="h-full rounded-full bg-[#F9D342] transition-all" style={{ width: `${pct}%` }} /></div>
                <div className={`mt-1 flex justify-between text-[11px] ${K.faint}`}><span>{m.fmt(m.cur)} / {m.fmt(m.target)}</span><span>⏳ {leftTxt}</span></div>
              </div>
            );
          })}
          <div className="rounded-2xl bg-amber-100 p-3 text-sm font-semibold text-amber-900">
            {inPeak ? `🚀 Peak hours now: +${PEAK.boost}% fares until ${h12(PEAK.to)}.` : `⏰ ${h12(PEAK.from)}–${h12(PEAK.to)} = +${PEAK.boost}% fares. ${hour < PEAK.from ? `Starts in ${fmtHM(minsToPeak * 60000)}, plan your shift around it.` : 'Plan tomorrow’s shift around it.'}`}
          </div>
        </section>
      ))}

      {/* Shift analytics */}
      {gate('h-80', (
        <section className={card('space-y-3')}>
          <h2 className={`font-extrabold ${K.ink}`}>Shift analytics</h2>
          <div>
            <p className={`mb-1 text-xs ${K.sub}`}>Best times · busiest: 7–9 AM, 5–8 PM</p>
            <div className="flex h-20 items-end gap-1" role="img" aria-label="Demand by hour, 6 AM to 10 PM. Peaks at 7 to 9 AM and 5 to 8 PM.">
              {DEMAND.map((v, i) => <div key={i} className={`flex-1 rounded-t ${v >= 80 ? 'bg-[#F9D342]' : K.bar}`} style={{ height: `${v}%` }} />)}
            </div>
            <div className={`mt-1 flex justify-between text-[10px] ${K.faint}`}><span>6 AM</span><span>2 PM</span><span>10 PM</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              [`GH₵ ${money(ANALYTICS.perHr)}/hr`, `Your average · platform GH₵ ${money(ANALYTICS.platformPerHr)} (+${Math.round((ANALYTICS.perHr / ANALYTICS.platformPerHr - 1) * 100)}%)`],
              [`${ANALYTICS.km} km`, 'Distance this week'],
              [`${ANALYTICS.onlineHrs} h`, 'Online hours this week'],
              [`${Math.round((ANALYTICS.earningHrs / ANALYTICS.onlineHrs) * 100)}%`, `Efficiency · ${ANALYTICS.earningHrs} earning of ${ANALYTICS.onlineHrs} online hrs`],
            ].map(([v, l]) => <div key={l} className={`rounded-2xl p-3 ${K.soft}`}><p className={`text-base font-black ${K.ink}`}>{v}</p><p className={`text-[11px] ${K.sub}`}>{l}</p></div>)}
          </div>
        </section>
      ))}

      {/* Weather & demand forecast */}
      <section className={`rounded-3xl ${K.card}`}>
        <button onClick={() => setWeatherOpen(o => !o)} aria-expanded={weatherOpen} className={`flex ${TAP} w-full items-center gap-3 p-4 text-left ${K.ink}`}>
          <Icon name="sun" className="h-6 w-6" /><span className="flex-1 font-extrabold">{WEATHER.temp}°C · {WEATHER.cond}</span><span className={`transition-transform ${weatherOpen ? 'rotate-90' : ''} ${K.faint}`}>›</span>
        </button>
        {weatherOpen && (
          <div className="space-y-2 px-4 pb-4 text-sm">
            <p className="rounded-2xl bg-sky-100 p-3 font-semibold text-sky-900">🌧️ Rain expected {WEATHER.rainFrom}–{WEATHER.rainTo}. Demand likely higher.</p>
            <p className={`rounded-2xl p-3 font-semibold ${K.soft} ${K.ink}`}>📈 Tomorrow’s busiest times: 7–9 AM, 5–8 PM</p>
            <p className={`text-xs ${K.faint}`}>Heat zones show on the map while you’re online: {HOT_ZONES.join(', ')}.</p>
          </div>
        )}
      </section>
    </div>
  );

  // ─── JOBS ───
  const jobsTab = () => (
    <div className="space-y-4">
      {syncRow()}
      <div className={`grid grid-cols-2 rounded-full p-1 ${K.soft}`} role="tablist">
        {(['earnings', 'performance'] as const).map(v => (
          <button key={v} role="tab" aria-selected={jobsView === v} onClick={() => setJobsView(v)} className={`${TAP} rounded-full text-sm font-bold transition ${jobsView === v ? `${K.btn} shadow` : K.sub}`}>{v === 'earnings' ? L('wallet', 'Earnings') : L('chart', 'Performance')}</button>
        ))}
      </div>

      {jobsView === 'performance' ? (
        gate('h-96', (
          <>
            <section className={card('text-center')}>
              <p className={`text-5xl font-black ${K.ink}`}>{RATINGS.avg}<span className={`text-xl font-bold ${K.faint}`}>/5</span></p>
              <div className="mt-1"><Stars v={RATINGS.avg} /></div>
              <p className={`mt-1 text-xs ${K.sub}`}>{RATINGS.total} ratings</p>
              <p className="mt-3 inline-block rounded-full bg-[#F9D342] px-4 py-1.5 text-xs font-extrabold text-[#0A2342]">🏅 Top 5% rider this week</p>
              <p className={`mt-1 text-xs ${K.sub}`}>Consistently great service</p>
            </section>
            <section className={card('space-y-2')}>
              <h2 className={`font-extrabold ${K.ink}`}>Rating breakdown</h2>
              {RATINGS.dist.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-6 font-bold ${K.ink}`}>{5 - i}★</span>
                  <div className={`h-3 flex-1 overflow-hidden rounded-full ${K.soft}`}><div className="h-full rounded-full bg-[#F9D342]" style={{ width: `${(n / RATINGS.total) * 100}%` }} /></div>
                  <span className={`w-8 text-right ${K.sub}`}>{n}</span>
                </div>
              ))}
            </section>
            <section className="grid grid-cols-3 gap-2 text-center">
              {[['Acceptance', RATINGS.acceptance, RATINGS.dAcc, true], ['Response', RATINGS.response, RATINGS.dResp, true], ['Cancellation', RATINGS.cancel, RATINGS.dCancel, false]].map(([l, v, d, up]) => (
                <div key={l as string} className={card('!p-3')}><p className={`text-xl font-black ${K.ink}`}>{v as number}%</p><p className={`text-[11px] ${K.sub}`}>{l as string}</p>{trend(d as number, up as boolean)}</div>
              ))}
              <p className={`col-span-3 text-[11px] ${K.faint}`}>Arrows compare with last week.</p>
            </section>
          </>
        ))
      ) : (
        <>
          <div className={`grid grid-cols-3 rounded-full p-1 ${K.soft}`} role="tablist" aria-label="Period">
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)} className={`${TAP} rounded-full text-sm font-bold transition ${period === p ? `${K.btn} shadow` : K.sub}`}>{p === 'today' ? 'Today' : p === 'week' ? 'This week' : 'This month'}</button>
            ))}
          </div>
          {gate('h-44', (
            <section className={`rounded-3xl p-5 shadow-[0_10px_30px_rgba(10,35,66,0.3)] ${K.hero}`}>
              <p className="text-xs text-white/70">Net earnings</p>
              <p className="text-4xl font-black tracking-tight text-[#F9D342]">GH₵ {money(totals.net)}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
                {[['Base', totals.base], ['Fees', -totals.fee], ['Bonus', totals.bonus], ['Net', totals.net]].map(([l, v]) => <div key={l as string} className="rounded-2xl bg-white/10 p-2"><p className="text-white/70">{l as string}</p><p className="text-sm font-extrabold">{(v as number) < 0 ? '−' : ''}{money(Math.abs(v as number))}</p></div>)}
              </div>
            </section>
          ))}
          {gate('h-44', (
            <section className={`${card()} flex items-center gap-4`}>
              <Donut k={K} parts={[{ v: totals.cashNet, c: '#F9D342', l: 'Cash' }, { v: totals.onlineNet, c: '#3B82F6', l: 'Online' }, { v: totals.fee, c: '#EF4444', l: 'Fees' }]} />
              <ul className={`flex-1 space-y-2 text-sm ${K.ink}`}>
                {[['#F9D342', 'Cash', totals.cashNet], ['#3B82F6', 'Online', totals.onlineNet], ['#EF4444', 'Fees deducted', totals.fee]].map(([c, l, v]) => (
                  <li key={l as string} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c as string }} />{l as string}</span><b>GH₵ {money(v as number)}</b></li>
                ))}
              </ul>
            </section>
          ))}
          {gate('h-28', (
            <section className={card('flex items-center gap-3')}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F9D342]/30"><Icon name="bank" className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${K.faint}`}>Next payout · {fmtDate(nextFriday())}</p>
                <p className={`text-xl font-black ${K.ink}`}>≈ GH₵ {money(weekJobs.filter(j => j.method === 'online').reduce((s, j) => s + netOf(j), 0))}</p>
                <p className={`text-xs ${K.sub}`}>MTN MoMo •••• {rider.phone.slice(-4)}</p>
              </div>
            </section>
          ))}
          {gate('h-40', (
            <section className={card()}>
              <p className={`mb-3 text-sm font-bold ${K.ink}`}>Last 7 days</p>
              <div className="flex h-24 items-end gap-2" role="img" aria-label="Daily net earnings for the last 7 days">
                {weekBars.map((b, i) => <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><div className={`w-full rounded-t-lg ${i === 6 ? 'bg-[#F9D342]' : K.bar}`} style={{ height: `${Math.max(4, (b.v / maxBar) * 100)}%` }} /><span className={`text-[10px] font-semibold ${K.faint}`}>{b.label}</span></div>)}
              </div>
            </section>
          ))}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Transaction filter">
            {(['all', 'cash', 'online', 'bonus', 'fee'] as TxFilter[]).map(f => <button key={f} role="tab" aria-selected={txFilter === f} onClick={() => setTxFilter(f)} className={chip(txFilter === f)}>{f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>)}
          </div>
          {gate('h-48', listJobs.length === 0 ? empty('bike', 'No trips here yet', 'Go online to start earning.') : (
            <ul className="space-y-2">
              {listJobs.map(j => {
                const open = openTx === j.id;
                const val = txFilter === 'fee' ? -j.fee : txFilter === 'bonus' ? j.bonus : netOf(j);
                return (
                  <li key={j.id} className={`rounded-2xl ${K.card}`}>
                    <button onClick={() => setOpenTx(open ? null : j.id)} aria-expanded={open} className={`flex ${TAP} w-full items-center gap-3 p-3 text-left`}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9D342]/30 text-lg" aria-hidden="true"><Icon name={j.method === 'cash' ? 'cash' : 'mobile'} className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-bold ${K.ink}`}>{j.from} → {j.to}{j.proof ? ' 📎' : ''}</span><span className={`block text-xs ${K.faint}`}>{fmtDate(j.at)} · {j.km} km</span></span>
                      <span className={`text-base font-black ${val < 0 ? 'text-red-500' : K.ink}`}>{val < 0 ? '−' : txFilter === 'bonus' ? '+' : ''}GH₵ {money(Math.abs(val))}</span>
                    </button>
                    {open && (
                      <dl className={`mx-3 mb-3 space-y-1 border-t pt-2 text-sm ${K.line} ${K.ink}`}>
                        {[['Base fare', `GH₵ ${money(j.base)}`], ['Service fee', `− GH₵ ${money(j.fee)}`], ['Bonus', `+ GH₵ ${money(j.bonus)}`]].map(([l, v]) => <div key={l} className="flex justify-between"><dt className={K.sub}>{l}</dt><dd>{v}</dd></div>)}
                        <div className="flex justify-between font-extrabold"><dt>Net earnings</dt><dd>GH₵ {money(netOf(j))}</dd></div>
                        {j.proof && (j.proof.startsWith('blob:') ? (
                          <div className="pt-2"><dt className={`mb-1 ${K.sub}`}>📎 Proof of delivery</dt><dd><img src={j.proof} alt="Proof of delivery" className="max-h-40 rounded-xl object-cover" /></dd></div>
                        ) : <div className="flex justify-between pt-1"><dt className={K.sub}>📎 Proof (scanned)</dt><dd>{j.proof.replace('code:', '')}</dd></div>)}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </>
      )}
    </div>
  );

  // ─── ACCOUNT ───
  const accountTab = () => {
    const hq = helpQ.trim().toLowerCase();
    const faqs = HELP.filter(f => (!helpCat || f.cat === helpCat) && (!hq || `${f.q} ${f.a}`.toLowerCase().includes(hq)));
    return (
      <div className="space-y-3">
        {syncRow()}
        <section className={`${card()} flex items-center gap-4`}>
          {photoUrl ? <img src={photoUrl} alt="Your profile photo" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F9D342] text-2xl font-black text-[#0A2342]">{initials}</span>}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-lg font-extrabold ${K.ink}`}>{rider.name}</p>
            <p className={`truncate text-sm ${K.sub}`}>{rider.phone}</p>
            <p className={`truncate text-xs ${K.faint}`}>{rider.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE[docState].cls}`}><Icon name={BADGE[docState].icon} className="h-3 w-3" />{BADGE[docState].label}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${K.ink}`}><Icon name="star" className="h-3.5 w-3.5 text-[#F9D342]" />{RATINGS.avg}</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600"><Icon name="flame" className="h-3.5 w-3.5" />{rider.streakDays}-day streak</span>
            </div>
          </div>
        </section>
        <button onClick={() => setWalletOpen(true)} className={`flex ${TAP} w-full items-center gap-3 rounded-3xl p-4 text-left ${K.card} ${K.ink} ${PRESS}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F9D342] text-[#0A2342]"><Icon name="wallet" className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block font-extrabold">Wallet</span><span className={`block text-xs ${K.sub}`}>Deposit & withdraw · GH₵ {money(walletBal)}</span></span>
          <Icon name="chevron" className={`h-5 w-5 ${K.faint}`} />
        </button>

        <Fold k={K} title="Profile photo" icon="camera" open>
          <div className="flex items-center gap-3">
            {photoUrl ? <img src={photoUrl} alt="Your profile photo" className="h-16 w-16 rounded-full object-cover" /> : <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${K.soft}`}>🧑</span>}
            <div className="min-w-0 flex-1"><p className={`text-sm font-bold ${K.ink}`}>{photoUrl ? 'Photo uploaded' : 'No photo yet'}</p>
              <p className={`text-xs ${K.sub}`}>{photoStatus === 'verified' ? '✅ Verified' : photoStatus === 'pending' ? '⏳ Pending Verification' : 'Customers see your photo to verify you.'}</p></div>
          </div>
          <button onClick={() => setPhotoOpen(true)} className={`w-full ${gold}`}>{L('camera', 'Upload Your Photo')}</button>
        </Fold>

        <Fold k={K} title="Personal details" icon="user" open>
          {field('Full name', 'name')}{field('Phone', 'phone', 'tel')}{field('Email', 'email', 'email')}
          {editing ? (
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} disabled={saving} className={`flex-1 ${ghost}`}>Cancel</button>
              <button onClick={saveProfile} disabled={saving} className={`flex flex-[2] items-center justify-center gap-2 disabled:opacity-60 ${primary}`}>{saving && <Spinner cls="h-4 w-4" />}Save changes</button>
            </div>
          ) : <button onClick={() => { setForm({ name: rider.name, phone: rider.phone, email: rider.email }); setEditing(true); }} className={ghost}>Edit details</button>}
        </Fold>

        <Fold k={K} title="Vehicles" icon="bike" open>
          {vehicles.map(v => (
            <div key={v.id} className={`rounded-2xl border p-3 ${K.line}`}>
              <div className="flex items-start justify-between gap-2">
                <div><p className={`text-sm font-extrabold ${K.ink}`}>{v.model}</p><p className={`text-xs ${K.sub}`}>{v.plate} · {v.color}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{v.active ? 'Active' : v.status === 'pending' ? 'Pending' : 'Inactive'}</span>
              </div>
              <p className={`mt-2 text-xs ${K.sub}`}>🔧 Next service due: {fmtFull(v.service)} or in {v.kmLeft} km</p>
              {!v.active && <button onClick={() => setActiveVehicle(v.id)} className={`mt-2 w-full ${ghost}`}>Set as active</button>}
            </div>
          ))}
          <button onClick={() => setAddVeh(true)} className={`w-full ${gold}`}>{L('plus', 'Add a vehicle')}</button>
        </Fold>

        <Fold k={K} title="Documents" icon="file" open>
          <ul className={`divide-y ${K.divide}`}>
            {MOCK_DOCS.map(d => (
              <li key={d.name} className="flex items-center gap-3 py-3"><Icon name={BADGE[d.status].icon} className={`h-5 w-5 shrink-0 ${d.status === 'verified' ? 'text-emerald-500' : d.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`} />
                <div className="min-w-0 flex-1"><p className={`text-sm font-bold ${K.ink}`}>{d.name}</p><p className={`text-xs ${K.faint}`}>{d.note}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${BADGE[d.status].cls}`}>{BADGE[d.status].label}</span></li>
            ))}
          </ul>
        </Fold>

        <Fold k={K} title="Safety centre" icon="shield" open>
          <button onClick={() => setSafetyOpen(true)} className={`w-full rounded-full bg-red-600 ${TAP} text-sm font-extrabold text-white ${PRESS}`}>{L('shield', 'Open safety centre')}</button>
          <p className={`text-xs ${K.sub}`}>Emergency contact: {EMERGENCY.name} · {EMERGENCY.phone}. Emergency services: {EMERGENCY.national}.</p>
        </Fold>

        <Fold k={K} title="Schedule & availability" icon="calendar">
          <p className={`rounded-2xl p-3 text-sm font-semibold ${K.soft} ${K.ink}`}>{summarize(sched)}</p>
          <p className={`text-sm ${K.sub}`}>{sched[tomorrowIdx].on ? `🔔 You’re scheduled for tomorrow at ${h12(sched[tomorrowIdx].from).replace(/(AM|PM)/, ':00 $1')}. Ready to ride?` : '🔔 Nothing scheduled for tomorrow.'}</p>
          <div className="flex items-center justify-between"><span className={`text-sm font-bold ${K.ink}`}>☕ I’m taking a break</span><Toggle k={K} on={onBreak} onChange={toggleBreak} label="Taking a break" /></div>
          <div className={`divide-y ${K.divide}`}>
            {sched.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className={`w-9 text-sm font-bold ${K.ink}`}>{DAYS[i]}</span>
                <Toggle k={K} on={s.on} onChange={v => updateSched(i, { on: v })} label={`Ride on ${DAYS[i]}`} />
                {s.on ? (<>
                  <select aria-label={`${DAYS[i]} start`} value={s.from} onChange={e => updateSched(i, { from: +e.target.value })} className={`${TAP} flex-1 rounded-xl border px-2 text-sm ${K.input}`}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h12(h)}</option>)}</select>
                  <select aria-label={`${DAYS[i]} end`} value={s.to} onChange={e => updateSched(i, { to: +e.target.value })} className={`${TAP} flex-1 rounded-xl border px-2 text-sm ${K.input}`}>{Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{h12(h)}</option>)}</select>
                </>) : <span className={`text-xs ${K.faint}`}>Day off</span>}
              </div>
            ))}
          </div>
          <div>
            <p className={`mb-2 text-xs font-semibold ${K.sub}`}>This week: scheduled vs ridden</p>
            <div className="flex h-24 items-end gap-2" role="img" aria-label="Scheduled hours compared with hours ridden each day">
              {sched.map((s, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="flex h-full w-full items-end gap-0.5"><div className={`flex-1 rounded-t ${K.soft}`} style={{ height: `${s.on ? ((s.to - s.from) / 14) * 100 : 0}%` }} /><div className="flex-1 rounded-t bg-[#F9D342]" style={{ height: `${(ACTUAL_HRS[i] / 14) * 100}%` }} /></div>
                  <span className={`text-[10px] font-semibold ${K.faint}`}>{DAYS[i][0]}</span>
                </div>
              ))}
            </div>
          </div>
        </Fold>

        <Fold k={K} title="Achievements" icon="trophy">
          {nextBadge && (<div className={`rounded-2xl p-3 ${K.soft}`}>
            <p className={`text-sm font-bold ${K.ink}`}>{nextBadge.cur}/{nextBadge.target} {nextBadge.unit} → Next: {nextBadge.icon} {nextBadge.name}</p>
            <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${dark ? 'bg-white/15' : 'bg-[#0A2342]/10'}`}><div className="h-full rounded-full bg-[#F9D342]" style={{ width: `${(nextBadge.cur / nextBadge.target) * 100}%` }} /></div>
          </div>)}
          <div className="grid grid-cols-3 gap-2">
            {BADGES.map(b => (
              <button key={b.id} onClick={() => setBadgeSel(b.id)} aria-label={`${b.name}, ${b.at ? 'unlocked' : 'locked'}`} className={`flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center ${PRESS} ${b.at ? 'bg-[#F9D342]/25' : K.soft}`}>
                <span className={`text-3xl ${b.at ? '' : 'opacity-30 grayscale'}`} aria-hidden="true">{b.icon}</span><span className={`text-[11px] font-bold leading-tight ${b.at ? K.ink : K.faint}`}>{b.name}</span>
              </button>
            ))}
          </div>
        </Fold>

        <Fold k={K} title="Settings" icon="sliders">
          <div><p className={`mb-2 text-sm font-bold ${K.ink}`}>Appearance</p>
            <div className={`grid grid-cols-3 rounded-full p-1 ${K.soft}`} role="radiogroup" aria-label="Theme">
              {([['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as [ThemePref, string][]).map(([v, l]) => <button key={v} role="radio" aria-checked={themePref === v} onClick={() => setTheme(v)} className={`${TAP} rounded-full text-xs font-bold ${themePref === v ? `${K.btn} shadow` : K.sub}`}>{l}</button>)}
            </div>
          </div>
          <div className="flex items-center justify-between"><span className={`text-sm font-bold ${K.ink}`}>Quiet hours (11 PM – 6 AM)</span><Toggle k={K} on={quiet} onChange={setQuietHours} label="Quiet hours" /></div>
        </Fold>

        <Fold k={K} title="Security" icon="lock">
          <button onClick={() => setPwOpen(true)} className={`w-full ${ghost}`}>Change password</button>
          <div className="flex items-center justify-between gap-2"><div><p className={`text-sm font-bold ${K.ink}`}>Two-factor authentication</p><p className={`text-xs ${K.sub}`}>{twoFA ? 'On: codes are sent by SMS.' : 'Add a code step when you sign in.'}</p></div>
            <Toggle k={K} on={twoFA} onChange={v => (v ? setTwoFAOpen(true) : (setTwoFA(false), notify('Two-factor authentication is off.', 'info')))} label="Two-factor authentication" /></div>
          <p className={`text-sm font-bold ${K.ink}`}>Active sessions</p>
          <ul className={`divide-y ${K.divide}`}>
            {sessions.map(s => (
              <li key={s.id} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${K.ink}`}>{s.device}</p><p className={`text-xs ${K.faint}`}>{s.where} · {s.seen}</p></div>
                {s.current ? <span className="text-xs font-bold text-emerald-500">This device</span> : <button onClick={() => { setSessions(p => p.filter(x => x.id !== s.id)); notify('Device signed out.', 'ok'); }} className={`${TAP} rounded-full border px-3 text-xs font-bold text-red-500 ${K.line}`}>Log out</button>}</li>
            ))}
          </ul>
          {sessions.length > 1 && <button onClick={() => setLogoutAll(true)} className={`w-full ${TAP} rounded-full border border-red-300 text-sm font-bold text-red-500 ${PRESS}`}>Log out all other devices</button>}
        </Fold>

        <Fold k={K} title="Help centre" icon="book">
          <input type="search" value={helpQ} onChange={e => setHelpQ(e.target.value)} placeholder="Search help articles…" aria-label="Search help articles" className={`${TAP} w-full rounded-xl border px-3 text-base outline-none focus:ring-2 focus:ring-[#F9D342] ${K.input}`} />
          <div className="-mx-1 flex flex-wrap gap-2 px-1">{HELP_CATS.map(c => <button key={c} onClick={() => setHelpCat(helpCat === c ? null : c)} aria-pressed={helpCat === c} className={chip(helpCat === c)}>{c}</button>)}</div>
          {faqs.length === 0 ? <p className={`py-3 text-center text-sm ${K.sub}`}>No articles match. Try different words or call us below.</p> : (
            <ul className={`divide-y ${K.divide}`}>
              {faqs.map(f => (
                <li key={f.q}><button onClick={() => setHelpOpen(helpOpen === f.q ? null : f.q)} aria-expanded={helpOpen === f.q} className={`flex ${TAP} w-full items-center justify-between gap-2 py-2 text-left text-sm font-bold ${K.ink}`}>{f.q}<span className={helpOpen === f.q ? 'rotate-90' : ''}>›</span></button>
                  {helpOpen === f.q && <p className={`pb-3 text-sm ${K.sub}`}>{f.a}</p>}</li>
              ))}
            </ul>
          )}
          <p className={`text-center text-xs ${K.sub}`}>Still can’t find what you need?</p>
        </Fold>

        <Fold k={K} title="Support" icon="support" open>
          <div className="flex gap-3">
            <a href={`tel:${SUPPORT_PHONE}`} className={`flex flex-1 items-center justify-center ${gold}`}>{L('phone', 'Call')}</a>
            <a href={`https://wa.me/233${SUPPORT_PHONE.slice(1)}`} target="_blank" rel="noopener noreferrer" className={`flex flex-1 items-center justify-center ${ghost}`}>{L('chat', 'WhatsApp')}</a>
          </div>
          <button onClick={() => { setGuideOpen(true); changeTab('home'); }} className={`${TAP} text-sm font-semibold underline ${K.sub}`}>Read rider guidelines again</button>
        </Fold>

        <button onClick={logout} className={`w-full ${TAP} rounded-full border border-red-300 bg-red-50 text-sm font-bold text-red-600 ${PRESS}`}>Log out</button>
      </div>
    );
  };

  const TABS: { id: Tab; label: string; icon: IconName }[] = [{ id: 'home', label: 'Home', icon: 'pin' }, { id: 'jobs', label: 'Jobs', icon: 'list' }, { id: 'account', label: 'Account', icon: 'user' }];
  const NOTE_GROUPS: [NoteGroup, string][] = [['jobs', 'New jobs'], ['earnings', 'Earnings & bonuses'], ['system', 'System updates'], ['promos', 'Promotions']];
  const sel = BADGES.find(b => b.id === badgeSel);

  // ─── RENDER ───
  return (
    <div className={`mx-auto min-h-[100dvh] max-w-lg ${K.page} ${K.ink}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Fixed header */}
      <header className={`fixed inset-x-0 top-0 z-40 mx-auto flex max-w-lg items-center gap-1.5 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] shadow-sm backdrop-blur ${K.nav}`}>
        <div className={`shrink-0 rounded-xl ${dark ? 'bg-white px-1.5' : ''}`}><Logo /></div>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-extrabold">{rider.name}</p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE[docState].cls}`}><Icon name={BADGE[docState].icon} className="mr-0.5 inline h-3 w-3" />{BADGE[docState].label}</span>
        </div>
        <div className="flex shrink-0 items-center">
          <button onClick={() => setWalletOpen(true)} className={`${TAP} rounded-full ${K.btn} px-2.5 text-xs font-extrabold ${PRESS}`} aria-label={`Wallet, balance ${money(walletBal)} cedis`}><span className="flex items-center gap-1"><Icon name="wallet" className="h-4 w-4" />₵{money(walletBal)}</span></button>
          <button onClick={() => setNotesOpen(true)} className={`relative flex h-11 w-11 items-center justify-center rounded-full ${PRESS}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Icon name="bell" className="h-5 w-5" />{unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread}</span>}</button>
          <button onClick={() => setSafetyOpen(true)} className={`flex h-11 w-11 items-center justify-center rounded-full ${PRESS}`} aria-label="Safety centre"><Icon name="shield" className="h-5 w-5" /></button>
        </div>
      </header>

      {toast && (
        <div className="fixed left-1/2 top-[calc(4.75rem+env(safe-area-inset-top))] z-[70] w-[90%] max-w-sm -translate-x-1/2" role="status" aria-live="polite">
          <p className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl ${toast.type === 'ok' ? 'bg-emerald-600' : toast.type === 'err' ? 'bg-red-600' : 'bg-[#0A2342] ring-1 ring-white/20'}`}>{toast.msg}</p>
        </div>
      )}

      <main className="px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <div className="flex justify-center overflow-hidden transition-[height]" style={{ height: refreshing ? 36 : pull / 2 }} aria-hidden={!refreshing}>{(refreshing || pull > 30) && <Spinner />}</div>
        <div className={`transition duration-150 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {tab === 'home' && homeTab()}
          {tab === 'jobs' && jobsTab()}
          {tab === 'account' && accountTab()}
        </div>
      </main>

      {/* Fixed status bar: the most important control */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4">
        <button onClick={toggleOnline} aria-pressed={online} className={`flex h-16 w-full items-center justify-center gap-3 rounded-full text-lg font-black tracking-wide text-white shadow-xl transition active:scale-[0.98] ${online ? 'bg-red-500 shadow-red-500/40' : 'bg-emerald-500 shadow-emerald-500/40'}`}>
          <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full bg-white ${online ? '' : 'animate-pulse'}`} />{online ? 'GO OFFLINE' : 'GO ONLINE'}
        </button>
      </div>

      <nav className={`fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t pb-[env(safe-area-inset-bottom)] ${K.line} ${K.nav}`} aria-label="Main">
        <div className="grid grid-cols-3">
          {TABS.map(t => (
            <button key={t.id} onClick={() => changeTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`flex min-h-[56px] flex-col items-center gap-0.5 py-2 text-xs font-bold transition active:scale-95 ${tab === t.id ? K.ink : K.faint}`}>
              <span className={`flex justify-center rounded-full px-5 py-1 transition ${tab === t.id ? 'bg-[#F9D342]' : ''}`} aria-hidden="true"><Icon name={t.icon} className="h-5 w-5" /></span>{t.label}
            </button>
          ))}
        </div>
      </nav>

      {walletOpen && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${K.page} ${K.ink}`} role="dialog" aria-modal="true" aria-label="Wallet"
          onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <div className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <header className={`sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur ${K.nav}`}>
              <button onClick={() => setWalletOpen(false)} aria-label="Back" className={`flex h-11 w-11 items-center justify-center rounded-full ${K.soft} ${PRESS}`}><Icon name="back" className="h-5 w-5" /></button>
              <h1 className="flex-1 text-lg font-extrabold">Wallet</h1>
              <Icon name="wallet" className={`h-6 w-6 ${K.faint}`} />
            </header>
            <section className={`rounded-3xl p-5 shadow-[0_10px_30px_rgba(10,35,66,0.3)] ${K.hero}`}>
              <p className="text-xs text-white/70">Wallet balance</p>
              <p className="text-4xl font-black tracking-tight text-[#F9D342]">GH₵ {money(walletBal)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70"><Icon name={dest?.type === 'card' ? 'card' : 'mobile'} className="h-4 w-4" />{dest ? `Payout method ${dest.masked}` : 'Your first deposit sets your payout method'}</p>
            </section>
            <div className="mt-4 grid grid-cols-2 gap-3" role="tablist" aria-label="Wallet action">
              {([['deposit', 'Deposit'], ['withdraw', 'Withdraw']] as const).map(([v, l]) => (
                <button key={v} role="tab" aria-selected={walletView === v} onClick={() => setWalletView(v)} className={`${TAP} flex items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${PRESS} ${walletView === v ? 'bg-[#F9D342] text-[#0A2342]' : `${K.card} ${K.ink}`}`}><Icon name={v} className="h-5 w-5" />{l}</button>
              ))}
            </div>
            <div className={card('mt-4')}>
              <WalletPanel k={K} view={walletView} balance={walletBal} totalEarnings={allTimeNet} dest={dest} notify={notify} onDeposit={onWalletDeposit} onWithdraw={onWalletWithdraw} />
            </div>
            <section className="mt-5">
              <h2 className="mb-2 flex items-center gap-2 font-extrabold"><Icon name="receipt" className="h-5 w-5" />Recent activity</h2>
              <ul className="space-y-2">
                {txList.map(t => (
                  <li key={t.id} className={`flex items-center gap-3 rounded-2xl p-3 ${K.card}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.amount < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}><Icon name={t.kind === 'deposit' ? 'deposit' : t.kind === 'withdraw' ? 'withdraw' : 'bike'} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{t.label}</span><span className={`block text-xs ${K.faint}`}>{ago(t.at)}</span></span>
                    <span className={`text-sm font-black ${t.amount < 0 ? 'text-red-500' : ''}`}>{t.amount < 0 ? '−' : '+'}GH₵ {money(Math.abs(t.amount))}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ── Sheets ── */}
      {notesOpen && (
        <Sheet k={K} title="Notifications" onClose={() => setNotesOpen(false)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button onClick={() => setNotes(p => p.map(n => ({ ...n, read: true })))} disabled={!unread} className={`${TAP} text-sm font-bold underline disabled:opacity-40`}>Mark all as read</button>
            <button onClick={() => setNotes([])} disabled={notes.length === 0} className={`${TAP} text-sm font-bold underline disabled:opacity-40`}>Clear all</button>
            <label className="flex items-center gap-1 text-xs font-semibold"><span>Quiet 11PM–6AM</span><Toggle k={K} on={quiet} onChange={setQuietHours} label="Quiet hours" /></label>
          </div>
          {notes.length === 0 ? empty('bell', 'You’re all caught up', 'New jobs, bonuses and updates show up here.') : NOTE_GROUPS.map(([g, label]) => {
            const items = notes.filter(n => n.group === g);
            return items.length === 0 ? null : (
              <div key={g} className="mb-4"><p className={`mb-2 text-xs font-extrabold ${K.faint}`}>{label}</p>
                <ul className="space-y-2">{items.map(n => (
                  <li key={n.id} className={`rounded-2xl p-3 ${n.read ? K.soft : 'bg-[#F9D342]/25'}`}>
                    <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9D342]/30"><Icon name={NOTE_ICON[n.group]} className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-bold">{n.title}</p><span className={`shrink-0 text-[11px] ${K.faint}`}>{ago(n.at)}</span></div><p className={`text-xs ${K.sub}`}>{n.msg}</p></div></div>
                    <div className="mt-2 flex justify-end gap-2">
                      {n.action && <button onClick={() => openNoteAction(n)} className={`${TAP} rounded-full ${K.btn} px-4 text-xs font-bold`}>{n.action}</button>}
                      <button onClick={() => setNotes(p => p.filter(x => x.id !== n.id))} className={`${TAP} rounded-full border px-4 text-xs font-bold ${K.line}`}>Dismiss</button>
                    </div>
                  </li>))}</ul></div>
            );
          })}
        </Sheet>
      )}

      {safetyOpen && (
        <Sheet k={K} title="Safety centre" onClose={() => setSafetyOpen(false)}>
          <button onClick={emergency} className={`flex w-full flex-col items-center rounded-3xl bg-red-600 py-5 text-white shadow-lg ${PRESS}`}><Icon name="alert" className="h-8 w-8" /><span className="text-lg font-black">Emergency</span><span className="text-xs text-white/80">Calls {EMERGENCY.name} and opens WhatsApp with your location</span></button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <a href={`https://wa.me/?text=${encodeURIComponent(tripMsg)}`} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center ${gold}`}>{L('pin', 'Share my trip')}</a>
            <a href={`sms:?&body=${encodeURIComponent(tripMsg)}`} className={`flex items-center justify-center ${ghost}`}>{L('chat', 'By SMS')}</a>
          </div>
          <p className={`mt-2 text-[11px] ${K.faint}`}>{coords ? 'Shares your position right now as a map link.' : 'Location unavailable. Turn on location so contacts can find you.'}</p>
          <a href={`tel:${EMERGENCY.national}`} className={`mt-3 flex items-center justify-center ${ghost}`}>{L('phone', `Emergency services ${EMERGENCY.national}`)}</a>
          <a href={`tel:${SUPPORT_PHONE}`} className={`mt-2 flex items-center justify-center ${ghost}`}>{L('support', `Rydnow support ${SUPPORT_PHONE}`)}</a>
          <button onClick={() => setTipsOpen(o => !o)} aria-expanded={tipsOpen} className={`mt-3 flex ${TAP} w-full items-center justify-between text-sm font-bold`}>💬 Quick safety tips<span className={tipsOpen ? 'rotate-90' : ''}>›</span></button>
          {tipsOpen && <ul className={`list-disc space-y-1 pl-5 text-sm ${K.sub}`}>{SAFETY_TIPS.map(t => <li key={t}>{t}</li>)}</ul>}
          <button onClick={() => { setSafetyOpen(false); setCheckin(true); }} className={`mt-3 ${TAP} text-xs font-semibold underline ${K.faint}`}>Preview trip safety check-in</button>
        </Sheet>
      )}

      {sel && (
        <Sheet k={K} title={sel.name} onClose={() => setBadgeSel(null)}>
          <div className="text-center"><p className={`text-6xl ${sel.at ? '' : 'opacity-30 grayscale'}`} aria-hidden="true">{sel.icon}</p>
            <p className="mt-3 font-extrabold">{sel.at ? `Unlocked · ${fmtFull(sel.at)}` : `Locked · ${sel.cur}/${sel.target} ${sel.unit}`}</p>
            <p className={`mt-1 text-sm ${K.sub}`}>{sel.desc}</p></div>
        </Sheet>
      )}

      {goalOpen && (
        <Sheet k={K} title="Daily earnings goal" onClose={() => setGoalOpen(false)}>
          <div className="mb-3 grid grid-cols-4 gap-2">{[100, 150, 200, 300].map(v => <button key={v} onClick={() => saveGoal(v)} className={`${TAP} rounded-xl border-2 text-sm font-bold ${goal === v ? 'border-[#F9D342] bg-[#F9D342] text-[#0A2342]' : K.line}`}>{v}</button>)}</div>
          {input('Or enter your own (GH₵)', goalInput, setGoalInput, 'number')}
          <button onClick={() => saveGoal(Number(goalInput))} className={`w-full ${primary}`}>Save goal</button>
        </Sheet>
      )}

      {pwOpen && (
        <Sheet k={K} title="Change password" onClose={() => setPwOpen(false)}>
          {input('Current password', pw.cur, v => setPw(p => ({ ...p, cur: v })), 'password')}
          {input('New password', pw.next, v => setPw(p => ({ ...p, next: v })), 'password')}
          <div className="mb-3 flex gap-1" role="img" aria-label={`Password strength ${sMeterLabel(strength(pw.next))}`}>{[1, 2, 3, 4].map(n => <span key={n} className={`h-1.5 flex-1 rounded-full ${strength(pw.next) >= n ? (strength(pw.next) <= 1 ? 'bg-red-500' : strength(pw.next) === 2 ? 'bg-amber-500' : 'bg-emerald-500') : K.soft}`} />)}</div>
          <p className={`-mt-2 mb-3 text-xs ${K.sub}`}>Use 8+ characters with upper and lower case, a number and a symbol. Strength: {sMeterLabel(strength(pw.next))}</p>
          {input('Confirm new password', pw.again, v => setPw(p => ({ ...p, again: v })), 'password')}
          <button onClick={submitPw} disabled={saving} className={`flex w-full items-center justify-center gap-2 disabled:opacity-60 ${primary}`}>{saving && <Spinner cls="h-4 w-4" />}Update password</button>
        </Sheet>
      )}

      {twoFAOpen && (
        <Sheet k={K} title="Turn on two-factor authentication" onClose={() => setTwoFAOpen(false)}>
          <p className={`mb-3 text-sm ${K.sub}`}>When you sign in, we’ll text a 6-digit code to {rider.phone}. This keeps your earnings safe even if someone learns your password.</p>
          {input('6-digit code (demo: any 6 digits)', code, v => setCode(v.replace(/\D/g, '').slice(0, 6)), 'text', '123456')}
          <button onClick={enable2FA} className={`w-full ${primary}`}>Turn on</button>
        </Sheet>
      )}

      {logoutAll && (
        <Sheet k={K} title="Log out other devices?" onClose={() => setLogoutAll(false)}>
          <p className={`mb-4 text-sm ${K.sub}`}>You’ll stay signed in here. Every other device will be signed out.</p>
          <div className="flex gap-3"><button onClick={() => setLogoutAll(false)} className={`flex-1 ${ghost}`}>Cancel</button>
            <button onClick={() => { setSessions(p => p.filter(s => s.current)); setLogoutAll(false); notify('Other devices signed out.', 'ok'); }} className={`flex-[1.4] ${TAP} rounded-full bg-red-600 text-sm font-bold text-white`}>Log them out</button></div>
        </Sheet>
      )}

      {addVeh && (
        <Sheet k={K} title="Add a vehicle" onClose={() => setAddVeh(false)}>
          {input('Model', vehForm.model, v => setVehForm(f => ({ ...f, model: v })), 'text', 'e.g. Haojue 125cc')}
          {input('Plate number', vehForm.plate, v => setVehForm(f => ({ ...f, plate: v })), 'text', 'GR 0000-24')}
          {input('Colour', vehForm.color, v => setVehForm(f => ({ ...f, color: v })))}
          <p className={`mb-3 text-xs ${K.sub}`}>Next you’ll upload its documents. It can be set as active once they’re verified.</p>
          <button onClick={submitVehicle} className={`w-full ${primary}`}>Add vehicle</button>
        </Sheet>
      )}

      {chatOpen && job && customerInfo && (
        <Sheet k={K} title={`Chat · ${job.customer}`} onClose={() => setChatOpen(false)}>
          <ChatPanel k={K} customer={customerInfo} msgs={msgs} onSend={sendMsg} arrived={job.stage === 'arrived'} />
        </Sheet>
      )}

      {photoOpen && (
        <Sheet k={K} title="Upload your photo" onClose={() => setPhotoOpen(false)}>
          <PhotoPanel k={K} current={photoUrl} status={photoStatus} notify={notify}
            onSave={async (_file, url) => {
              await new Promise(r => setTimeout(r, 900)); // BACKEND: POST /rider-photo/ (multipart). Admin review sets Verified.
              setPhotoUrl(url); setPhotoStatus('pending'); setPhotoOpen(false); touchSync();
              pushNote('system', '📷', 'Photo under review', 'We’ll let you know once it’s verified.');
            }} />
        </Sheet>
      )}

      {proofOpen && job && (
        <Sheet k={K} title="Proof of delivery" onClose={() => setProofOpen(false)}>
          <ProofPanel k={K} notify={notify} onSubmit={completeJob} />
        </Sheet>
      )}
    </div>
  );
}

const sMeterLabel = (n: number) => ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][n];

