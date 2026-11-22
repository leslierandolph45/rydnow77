'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// ─── BRAND IDENTITY ───
const BRAND = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceDark: '#F1F5F9',
  primary: '#0F52BA',
  primaryLight: '#EFF6FF',
  accent: '#F5A623',
  success: '#10B981',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
} as const

const LOGO_SRC = '/logo.png'
const ICONS = {
  home: '/Home.png',
  discover: '/discover.png',
  earnings: '/earnup.png',
  inbox: '/inbox.png',
  menu: '/menu.png',
  announcement: '/icons/bullhorn.svg',
  receipt: '/icons/receipt.svg',
  account: '/icons/user-avatar.svg',
  chevron: '/icons/chevron.svg',
}

type Tab = 'home' | 'discover' | 'earnings' | 'inbox' | 'menu'
type Category = 'all' | 'announcements' | 'receipts' | 'account'

interface InboxMessage {
  id: string
  category: 'announcements' | 'receipts' | 'account'
  title: string
  preview: string
  fullText: string
  time: string
  unread: boolean
}

function IconImg({ src, size = 20, className = '' }: { src: string; size?: number; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
    />
  )
}

function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = {
    sm: { w: 28, h: 28 },
    md: { w: 40, h: 40 },
    lg: { w: 56, h: 56 },
  }[size]
  
  return (
    <Link href="/" aria-label="RYDNOW — Home" className="flex items-center gap-2">
      <Image
        src={LOGO_SRC}
        alt="RYDNOW Logo"
        width={dimensions.w}
        height={dimensions.h}
        className="object-contain"
        priority
      />
      <span className="font-extrabold tracking-tight hidden sm:block" style={{ color: BRAND.primary, fontSize: size === 'lg' ? '1.5rem' : '1.125rem' }}>
        RYDNOW
      </span>
    </Link>
  )
}

const categoryConfig = {
  announcements: { label: 'Announcements', icon: ICONS.announcement },
  receipts: { label: 'Trip Receipts', icon: ICONS.receipt },
  account: { label: 'Account Updates', icon: ICONS.account },
} as const

export default function RiderInboxPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)

  // ─── MESSAGES DATA ───
  const [messages, setMessages] = useState<InboxMessage[]>([
    {
      id: 'M001',
      category: 'announcements',
      title: 'New Bonus: Complete 12 Trips, Earn GHS 35 Extra',
      preview: 'Valid now through Wednesday — don\'t miss out!',
      fullText: 'Complete 12 trips between now and Wednesday 11th October at 11:59 PM and earn an extra GHS 35 added to your next payout. This applies to all completed deliveries in the Greater Accra area. Keep an eye on the Discover tab for real-time progress tracking.',
      time: '2h ago',
      unread: true,
    },
    {
      id: 'M002',
      category: 'receipts',
      title: 'Trip Receipt — Kaneshie → Osu',
      preview: 'GHS 18.50 · Completed 9:12 AM',
      fullText: 'Trip: RYD-JOB-2610701\nPickup: Kaneshie Market, Accra\nDropoff: Osu Oxford Street\nDistance: 2.4 km\nTrip Fare: GHS 18.50\nPayment: Collected via client payment\nThank you for delivering with RYDNOW!',
      time: 'Today, 09:12 AM',
      unread: false,
    },
    {
      id: 'M003',
      category: 'account',
      title: 'Your Weekly Earnings Are Ready',
      preview: 'GHS 312.00 earned this week — withdraw anytime',
      fullText: 'Great week! You earned GHS 312.00 across 14 completed trips.\n\nBreakdown:\n• Trip fares: GHS 262.00\n• Bonuses: GHS 55.00\n• Adjustments: -GHS 5.00\n\nAvailable to withdraw: GHS 287.50\nTap the Earnings tab to send to your Mobile Money.',
      time: 'Yesterday',
      unread: false,
    },
    {
      id: 'M004',
      category: 'announcements',
      title: 'Peak Hour Boost: 5–8 PM Daily',
      preview: '+GHS 4 extra per trip in Accra Central',
      fullText: 'Evening peak hours are now active. Earn an extra GHS 4.00 on every trip completed between 5:00 PM and 8:00 PM within the Accra Central zone. This bonus applies automatically — no action needed.',
      time: '3d ago',
      unread: true,
    },
    {
      id: 'M005',
      category: 'account',
      title: 'Account Verified ✓',
      preview: 'Your rider documents approved — go online anytime',
      fullText: 'Your Ghana Card and riding license have been verified. You are now fully approved as a RYDNOW rider.\n\nTap "Go Online" on your dashboard to start receiving delivery requests.',
      time: '5d ago',
      unread: false,
    },
  ])

  // ─── SESSION CHECK ───
  useEffect(() => {
    const session = localStorage.getItem('rydnow_rider_session')
    if (!session) {
      router.push('/login')
      return
    }
    setIsLoading(false)
  }, [router])

  // ─── FILTER MESSAGES ───
  const filteredMessages = activeCategory === 'all'
    ? messages
    : messages.filter(m => m.category === activeCategory)

  const unreadCount = messages.filter(m => m.unread).length

  // ─── MARK AS READ ON OPEN ───
  const openMessage = (msg: InboxMessage) => {
    if (msg.unread) {
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, unread: false } : m
      ))
    }
    setSelectedMessage(msg)
  }

  const closeMessage = () => {
    setSelectedMessage(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.surfaceDark }}>
        <div className="flex flex-col items-center gap-5">
          <BrandLogo size="lg" />
          <div className="w-10 h-10 rounded-full animate-spin border-4 border-solid" style={{ borderColor: `${BRAND.primary} transparent transparent transparent` }} />
          <p className="font-medium" style={{ color: BRAND.text }}>Loading Inbox…</p>
        </div>
      </div>
    )
  }

  // ─── MESSAGE DETAIL VIEW ───
  if (selectedMessage) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <header className="px-4 sm:px-6 pt-4 pb-4 border-b sticky top-0 z-40" style={{ borderColor: BRAND.border }}>
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={closeMessage}
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: BRAND.primary }}
            >
              ← Back
            </button>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: BRAND.surfaceAlt, color: BRAND.textMuted }}>
              {categoryConfig[selectedMessage.category].label}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-6 pb-28">
          <div className="max-w-lg mx-auto">
            <p className="text-xs" style={{ color: BRAND.textMuted }}>{selectedMessage.time}</p>
            <h2 className="text-xl font-bold mt-2 mb-4" style={{ color: BRAND.text }}>{selectedMessage.title}</h2>
            <div
              className="whitespace-pre-line text-sm leading-relaxed"
              style={{ color: BRAND.text, lineHeight: '1.6' }}
            >
              {selectedMessage.fullText}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ═══════ TOP HEADER ═══════ */}
      <header className="px-4 sm:px-6 pt-4 pb-3 border-b sticky top-0 z-40" style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: BRAND.border }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <BrandLogo size="md" />
          {unreadCount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: BRAND.primary }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="mt-3 max-w-lg mx-auto">
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: BRAND.text }}>Inbox</h1>
          <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>Updates from RYDNOW</p>
        </div>
        {/* ─── CATEGORY TABS ─── */}
        <div className="max-w-lg mx-auto mt-4 flex gap-2 overflow-x-auto pb-1">
          {(['all', 'announcements', 'receipts', 'account'] as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                backgroundColor: activeCategory === cat ? BRAND.primary : BRAND.surfaceAlt,
                color: activeCategory === cat ? '#FFFFFF' : BRAND.textMuted,
              }}
            >
              {cat === 'all' ? 'All' : categoryConfig[cat].label}
            </button>
          ))}
        </div>
      </header>

      {/* ═══════ MESSAGE LIST ═══════ */}
      <main className="flex-1 px-4 sm:px-6 pb-28 overflow-auto">
        <div className="max-w-lg mx-auto pt-3">
          {filteredMessages.length === 0 ? (
            // ─── EMPTY STATE ───
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: BRAND.surfaceAlt }}>
                <IconImg src={ICONS.inbox} size={28} style={{ opacity: 0.5 }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: BRAND.text }}>No new messages</h3>
              <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>
                You're all caught up — we'll notify you when there's an update
              </p>
            </div>
          ) : (
            // ─── MESSAGE ITEMS ───
            <div className="space-y-2">
              {filteredMessages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className="w-full p-4 rounded-xl border text-left transition-all hover:shadow-sm"
                  style={{
                    borderColor: BRAND.border,
                    backgroundColor: msg.unread ? `${BRAND.primary}05` : BRAND.surface,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread Indicator — Blue Dot */}
                    <div className="mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: msg.unread ? BRAND.primary : 'transparent' }} />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`truncate ${msg.unread ? 'font-bold' : 'font-normal'}`}
                        style={{ color: BRAND.text }}
                      >
                        {msg.title}
                      </p>
                      <p className="text-sm mt-1 truncate" style={{ color: BRAND.textMuted }}>
                        {msg.preview}
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: BRAND.textMuted }}>
                        {msg.time}
                      </p>
                    </div>
                    
                    {/* Chevron */}
                    <IconImg src={ICONS.chevron} size={14} className="flex-shrink-0 mt-1" style={{ opacity: 0.4 }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ═══════ BOTTOM NAVIGATION — INBOX ACTIVE ═══════ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50" style={{ borderColor: BRAND.border }}>
        <div className="max-w-lg mx-auto flex justify-around py-2.5 px-2">
          {([
            { key: 'home' as Tab, label: 'Home', icon: ICONS.home },
            { key: 'discover' as Tab, label: 'Discover', icon: ICONS.discover },
            { key: 'earnings' as Tab, label: 'Earnings', icon: ICONS.earnings },
            { key: 'inbox' as Tab, label: 'Inbox', icon: ICONS.inbox, badge: unreadCount },
            { key: 'menu' as Tab, label: 'Menu', icon: ICONS.menu },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center gap-1 transition-all px-2 py-1.5 rounded-xl relative"
              style={{
                color: activeTab === tab.key ? BRAND.primary : BRAND.textMuted,
                backgroundColor: activeTab === tab.key ? BRAND.primaryLight : 'transparent',
              }}
            >
              <div className="relative">
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={24}
                  height={24}
                  className="object-contain"
                  style={{
                    filter: activeTab === tab.key ? 'none' : 'grayscale(100%) opacity(0.6)',
                  }}
                />
                {tab.badge && tab.badge > 0 && (
                  <span
                    className="absolute -top-1 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}