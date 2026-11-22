'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// ─── BRAND IDENTITY — UBER PREMIUM STANDARD ───
const BRAND = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceDark: '#F1F5F9',
  primary: '#0F52BA',
  primaryDark: '#0A3C8C',
  accent: '#F5A623',
  accentDark: '#D4880E',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.75)',
} as const

const API = {
  status: '/api/rider-status',
  earnings: '/api/rider/earnings',
}

const LOGO_SRC = '/logo.png'

const ICONS = {
  home: '/Home.png',
  discover: '/discover.png',
  earnings: '/earnup.png',
  inbox: '/inbox.png',
  menu: '/menu.png',
  goOnline: '/goonline.png',
  earn: '/earn.png',
  shield: '/icons/shield.svg',
  settingsFilter: '/icons/settings-filter.svg',
  expand: '/icons/expand.svg',
  search: '/icons/search.svg',
  navigate: '/icons/navigate.svg',
  userAvatar: '/icons/user-avatar.svg',
  help: '/icons/help.svg',
  shieldCheck: '/icons/shield-check.svg',
  gear: '/icons/gear.svg',
  compass: '/icons/compass.svg',
  gift: '/icons/gift.svg',
  motor: '/icons/motor.svg',
  document: '/icons/document.svg',
  bonusStar: '/icons/bonus-star.svg',
  lightning: '/icons/lightning-bolt.svg',
  giftBox: '/icons/gift-box.svg',
  target: '/icons/target.svg',
  messageDot: '/icons/message-dot.svg',
  message: '/icons/message.svg',
  star: '/icons/star.svg',
  chevron: '/icons/chevron.svg',
  logout: '/icons/logout.svg',
  pickup: '/icons/pickup.svg',
  dropoff: '/icons/dropoff.svg',
  accept: '/icons/accept.svg',
  decline: '/icons/decline.svg',
  calendar: '/icons/calendar.svg',
  mapPin: '/icons/map-pin.svg',
  clock: '/icons/clock.svg',
  // Discover-specific icons
  rocket: '/icons/rocket.svg',
  clockFill: '/icons/clock-fill.svg',
  users: '/icons/users.svg',
  lightbulb: '/icons/lightbulb.svg',
  info: '/icons/info.svg',
}

type Tab = 'home' | 'discover' | 'earnings' | 'inbox' | 'menu'
type RiderStatus = 'offline' | 'online' | 'en_route_pickup' | 'at_pickup' | 'en_route_dropoff' | 'at_dropoff' | 'completed'

interface Job {
  id: string
  status: RiderStatus
  pickup: string
  dropoff: string
  customerName: string
  customerInitials: string
  earnings: string
  acceptedAt?: string
  distance?: string
  eta?: string
}

interface PendingJob {
  id: string
  pickup: string
  dropoff: string
  earnings: string
  distance: string
  expiresAt: number
}

interface InboxMessage {
  id: string
  title: string
  body: string
  time: string
  unread: boolean
}

interface DiscoverCard {
  id: string
  icon: string
  title: string
  description: string
  subText?: string
  tag?: { label: string; color: string }
  href: string
}

const getStatusStyle = (status: RiderStatus) => {
  const styles: Record<RiderStatus, { bg: string; text: string; label: string; dot: string }> = {
    offline: { bg: BRAND.surfaceDark, text: BRAND.textMuted, label: 'Offline', dot: BRAND.textMuted },
    online: { bg: '#ECFDF5', text: '#065F46', label: 'Online — Ready', dot: BRAND.success },
    en_route_pickup: { bg: '#DBEAFE', text: '#1E40AF', label: 'Heading to Pickup', dot: BRAND.primary },
    at_pickup: { bg: '#FEF3C7', text: '#92400E', label: 'At Pickup', dot: BRAND.accent },
    en_route_dropoff: { bg: '#ECFDF5', text: '#065F46', label: 'On Route to Dropoff', dot: BRAND.success },
    at_dropoff: { bg: '#EDE9FE', text: '#5B21B6', label: 'Arrived at Dropoff', dot: '#8B5CF6' },
    completed: { bg: BRAND.surfaceDark, text: BRAND.textMuted, label: 'Completed', dot: BRAND.textMuted },
  }
  return styles[status]
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
      <span className="font-extrabold tracking-tight hidden sm:block" style={{ color: BRAND.primary, fontSize: size === 'lg' ? '1.5rem' : size === 'md' ? '1.125rem' : '1rem' }}>
        RYDNOW
      </span>
    </Link>
  )
}

export default function RiderDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('discover')
  const [riderOnline, setRiderOnline] = useState(false)
  const [todayEarnings, setTodayEarnings] = useState('GHS 43.50')
  const [weeklyEarnings, setWeeklyEarnings] = useState('GHS 312.00')
  const [rating, setRating] = useState('4.92')
  const [totalTrips, setTotalTrips] = useState(47)
  const [jobs, setJobs] = useState<Job[]>([])
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([])
  const [apiMessage, setApiMessage] = useState('')
  const [bypassEnabled, setBypassEnabled] = useState(false)
  
  const discoverCards: DiscoverCard[] = [
    {
      id: 'promotions',
      icon: ICONS.rocket,
      title: 'Active Promotions',
      description: 'Limited-time bonuses in your area',
      subText: '3 offers available now',
      tag: { label: 'Live', color: BRAND.success },
      href: '/rider/discover/promotions',
    },
    {
      id: 'peaks',
      icon: ICONS.clockFill,
      title: 'Peak Times & Zones',
      description: 'When and where earnings go up',
      subText: 'Evening peak: 5PM–8PM',
      tag: { label: 'High Demand', color: BRAND.accent },
      href: '/rider/discover/peaks',
    },
    {
      id: 'referral',
      icon: ICONS.users,
      title: 'Refer a Friend',
      description: 'Invite riders — earn together',
      subText: 'Your code: RYDNOW-ACCRA-24',
      tag: { label: 'GHS 30 reward', color: BRAND.primary },
      href: '/rider/discover/referral',
    },
    {
      id: 'tips',
      icon: ICONS.lightbulb,
      title: 'Earnings Tips',
      description: 'Strategies to maximize every trip',
      subText: 'Best routes · timing · customer ratings',
      tag: { label: 'Guide', color: BRAND.textMuted },
      href: '/rider/discover/tips',
    },
  ]

  const [messages, setMessages] = useState<InboxMessage[]>([
    { id: '1', title: 'Welcome to RYDNOW', body: 'Your account is verified. Go online to start receiving trips.', time: '2h ago', unread: true },
    { id: '2', title: 'Weekly Earnings Ready', body: 'You earned GHS 312.00 this week. Withdraw anytime.', time: '1d ago', unread: false },
    { id: '3', title: 'New Bonus Available', body: 'Complete 12 trips before Wednesday to earn GHS 35 extra.', time: '2d ago', unread: false },
  ])

  useEffect(() => {
    const session = localStorage.getItem('rydnow_rider_session')
    const bypass = localStorage.getItem('rydnow_rider_bypass') === 'true'
    
    if (!session) {
      router.push('/login')
      return
    }
    
    if (bypass) {
      setBypassEnabled(true)
      setJobs([
        { id: 'RYD-JOB-2610701', status: 'completed', pickup: 'Kaneshie Market, Accra', dropoff: 'Osu Oxford Street', customerName: 'Ama Serwaa', customerInitials: 'AS', earnings: 'GHS 18.50', acceptedAt: '09:12 AM' },
        { id: 'RYD-JOB-2610702', status: 'completed', pickup: 'Accra Mall, Tetteh Quarshie', dropoff: 'East Legon, Boundary Road', customerName: 'Kofi Mensah', customerInitials: 'KM', earnings: 'GHS 25.00', acceptedAt: '10:05 AM' },
      ])
    }
    
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    if (!riderOnline) {
      setPendingJobs([])
      return
    }
    const samplePending: PendingJob[] = [
      { id: 'JOB-001', pickup: 'Kaneshie Market, Accra', dropoff: 'Osu Oxford Street', earnings: 'GHS 18.50', distance: '2.4 km', expiresAt: Date.now() + 30000 },
      { id: 'JOB-002', pickup: 'Accra Mall, Tetteh Quarshie', dropoff: 'East Legon, Boundary Road', earnings: 'GHS 25.00', distance: '5.1 km', expiresAt: Date.now() + 25000 },
    ]
    setPendingJobs(samplePending)
    
    const interval = setInterval(() => {
      setPendingJobs(prev => prev.map(job => ({ ...job, expiresAt: job.expiresAt })).filter(job => job.expiresAt > Date.now()))
    }, 1000)
    return () => clearInterval(interval)
  }, [riderOnline])

  const updateRiderStatus = useCallback(async (online: boolean) => {
    setApiMessage('')
    try {
      const res = await fetch(API.status, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: online }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiMessage(data.message || 'Status update failed')
        return
      }
      setRiderOnline(online)
      setApiMessage(data.message)
    } catch {
      setRiderOnline(online)
      setApiMessage(online ? '✅ You are now online — requests will appear below' : 'You are now offline')
    }
  }, [])

  const handleAcceptJob = (jobId: string) => {
    setApiMessage(`✅ Job ${jobId} accepted — heading to pickup…`)
    setPendingJobs(prev => prev.filter(j => j.id !== jobId))
  }

  const handleDeclineJob = (jobId: string) => {
    setPendingJobs(prev => prev.filter(j => j.id !== jobId))
    setApiMessage('Job declined')
  }

  const handleLogout = () => {
    localStorage.removeItem('rydnow_rider_session')
    localStorage.removeItem('rydnow_rider_bypass')
    localStorage.removeItem('rydnow_account_type')
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.surfaceDark }}>
        <div className="flex flex-col items-center gap-5">
          <BrandLogo size="lg" />
          <div className="w-10 h-10 rounded-full animate-spin border-4 border-solid" style={{ borderColor: `${BRAND.primary} transparent transparent transparent` }} />
          <p className="font-medium" style={{ color: BRAND.text }}>Loading RYDNOW…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ─── TOP HEADER ─── */}
      <header className="px-4 sm:px-6 pt-4 pb-4 border-b sticky top-0 z-40 backdrop-blur-md" style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: BRAND.border }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2">
            {bypassEnabled && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: BRAND.accent }}>TEST</span>
            )}
            <button aria-label="Safety" className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100" style={{ backgroundColor: BRAND.surfaceAlt }}>
              <IconImg src={ICONS.shield} size={20} />
            </button>
            <button aria-label="Settings" className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100" style={{ backgroundColor: BRAND.surfaceAlt }}>
              <IconImg src={ICONS.settingsFilter} size={20} />
            </button>
          </div>
        </div>
        
        <div className="mt-3 max-w-lg mx-auto">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: BRAND.text }}>
            Discover
          </h1>
          <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>
            Boost your earnings with bonuses and tips
          </p>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 px-4 sm:px-6 pb-28 overflow-auto">
        <div className="max-w-lg mx-auto">
          {/* ─── DISCOVER SCREEN — FULLY UPDATED ─── */}
          {activeTab === 'discover' && (
            <div className="space-y-4 pt-2">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: BRAND.text }}>Ways to Earn More</h2>
                <button className="text-sm font-medium" style={{ color: BRAND.primary }}>
                  <IconImg src={ICONS.info} size={16} className="inline mr-1" />
                  Help
                </button>
              </div>

              {/* Cards Grid */}
              <div className="space-y-3">
                {discoverCards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="block p-4 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                    style={{ borderColor: BRAND.border, backgroundColor: BRAND.surface }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${BRAND.primary}10` }}
                      >
                        <IconImg src={card.icon} size={20} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-base" style={{ color: BRAND.text }}>
                            {card.title}
                          </h3>
                          {card.tag && (
                            <span
                              className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: `${card.tag.color}15`, color: card.tag.color }}
                            >
                              {card.tag.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>
                          {card.description}
                        </p>
                        {card.subText && (
                          <p className="text-xs mt-2 font-medium" style={{ color: BRAND.primary }}>
                            {card.subText}
                          </p>
                        )}
                      </div>

                      {/* Chevron */}
                      <IconImg src={ICONS.chevron} size={16} className="shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Quick Summary Card */}
              <div
                className="mt-2 p-4 rounded-2xl"
                style={{ backgroundColor: BRAND.surfaceAlt }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.textMuted }}>
                  Today's Best Opportunity
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color: BRAND.text }}>
                      Evening Peak — +GHS 4 extra per trip
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND.textMuted }}>
                      5:00 PM – 8:00 PM · Accra Central
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold" style={{ color: BRAND.accent }}>
                      +GHS 4
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── HOME SCREEN ─── */}
          {activeTab === 'home' && (
            <div className="space-y-5 pt-2">
              {/* Profile Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ backgroundColor: BRAND.surfaceAlt }}>
                  <p className="text-xs font-bold" style={{ color: BRAND.textMuted }}>Rating</p>
                  <p className="text-lg font-bold mt-1 flex items-center justify-center gap-1" style={{ color: BRAND.text }}>
                    <IconImg src={ICONS.star} size={14} /> {rating}
                  </p>
                </div>
                <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ backgroundColor: BRAND.surfaceAlt }}>
                  <p className="text-xs font-bold" style={{ color: BRAND.textMuted }}>Trips</p>
                  <p className="text-lg font-bold mt-1" style={{ color: BRAND.text }}>{totalTrips}</p>
                </div>
                <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ backgroundColor: BRAND.surfaceAlt }}>
                  <p className="text-xs font-bold" style={{ color: BRAND.textMuted }}>Today</p>
                  <p className="text-lg font-bold mt-1" style={{ color: BRAND.accent }}>{todayEarnings}</p>
                </div>
              </div>

              {/* Map Area */}
              <div className="relative w-full rounded-2xl overflow-hidden shadow-md" style={{ height: 300, backgroundColor: '#E8EDF2' }}>
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: `
                    linear-gradient(#CBD5E1 1px, transparent 1px),
                    linear-gradient(90deg, #CBD5E1 1px, transparent 1px)
                  `,
                  backgroundSize: '30px 30px'
                }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="w-6 h-6 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: riderOnline ? BRAND.success : BRAND.textMuted }} />
                  {riderOnline && (
                    <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: BRAND.success, transform: 'scale(2)' }} />
                  )}
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: riderOnline ? BRAND.success : BRAND.textMuted }} />
                    <span style={{ color: BRAND.text }}>{riderOnline ? `${pendingJobs.length} request${pendingJobs.length !== 1 ? 's' : ''} nearby` : 'Currently offline'}</span>
                  </div>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => updateRiderStatus(!riderOnline)}
                className="w-full py-4 rounded-2xl font-extrabold text-lg text-white flex items-center justify-center gap-3 transition-all hover:opacity-95 active:scale-98 shadow-lg"
                style={{ backgroundColor: riderOnline ? BRAND.success : BRAND.primary }}
              >
                <Image src={ICONS.goOnline} alt="" width={28} height={28} className="object-contain" />
                {riderOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
          )}

          {/* ─── EARNINGS SCREEN ─── */}
          {activeTab === 'earnings' && (
            <div className="space-y-5 pt-2">
              <h2 className="text-xl font-bold" style={{ color: BRAND.text }}>Earnings</h2>
              <div className="p-6 rounded-2xl text-white shadow-lg" style={{ backgroundColor: BRAND.primary }}>
                <p className="text-sm font-medium opacity-80">Today's Earnings</p>
                <p className="text-4xl font-bold mt-2">{todayEarnings}</p>
                <p className="text-sm mt-3 opacity-60">{jobs.length} completed deliveries</p>
              </div>
            </div>
          )}

          {/* ─── INBOX SCREEN ─── */}
          {activeTab === 'inbox' && (
            <div className="space-y-4 pt-2">
              <h2 className="text-xl font-bold" style={{ color: BRAND.text }}>Inbox</h2>
              {messages.map(msg => (
                <Link key={msg.id} href="#" className="p-4 rounded-2xl border flex items-start gap-3 transition-all hover:shadow-md" style={{ borderColor: BRAND.border }}>
                  <IconImg src={msg.unread ? ICONS.messageDot : ICONS.message} size={20} />
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${msg.unread ? '' : 'font-normal'}`} style={{ color: msg.unread ? BRAND.text : BRAND.textMuted }}>
                      {msg.title}
                    </p>
                    <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>{msg.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* ─── MENU SCREEN ─── */}
          {activeTab === 'menu' && (
            <div className="space-y-5 pt-2">
              <h2 className="text-xl font-bold" style={{ color: BRAND.text }}>Account</h2>
              <button onClick={handleLogout} className="w-full py-3.5 rounded-xl font-bold border-2 flex items-center justify-center gap-2 mt-4" style={{ borderColor: '#FECACA', color: BRAND.error }}>
                <IconImg src={ICONS.logout} size={18} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ─── BOTTOM NAVIGATION ─── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50" style={{ borderColor: BRAND.border }}>
        <div className="max-w-lg mx-auto flex justify-around py-2.5 px-2">
          {([
            { key: 'home' as Tab, label: 'Home', icon: ICONS.home },
            { key: 'discover' as Tab, label: 'Discover', icon: ICONS.discover },
            { key: 'earnings' as Tab, label: 'Earnings', icon: ICONS.earnings },
            { key: 'inbox' as Tab, label: 'Inbox', icon: ICONS.inbox },
            { key: 'menu' as Tab, label: 'Menu', icon: ICONS.menu },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center gap-1 transition-all px-2 py-1.5 rounded-xl"
              style={{
                color: activeTab === tab.key ? BRAND.primary : BRAND.textMuted,
                backgroundColor: activeTab === tab.key ? `${BRAND.primary}10` : 'transparent'
              }}
            >
              <Image
                src={tab.icon}
                alt={tab.label}
                width={24}
                height={24}
                className="object-contain"
                style={{
                  filter: activeTab === tab.key ? 'none' : 'grayscale(100%) opacity(0.6)'
                }}
              />
              <span className="text-[11px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}