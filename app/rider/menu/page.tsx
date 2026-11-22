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
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  pending: '#F59E0B',
  expired: '#EF4444',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
} as const

const DEFAULT_AVATAR = '/rider-avatar.png'

const ICONS = {
  home: '/Home.png',
  discover: '/discover.png',
  earnings: '/earnup.png',
  inbox: '/inbox.png',
  menu: '/menu.png',
  star: '/icons/star.svg',
  chevron: '/icons/chevron-right.svg',
  help: '/icons/help.svg',
  shield: '/icons/shield.svg',
  settings: '/icons/settings.svg',
  bike: '/icons/bike.svg',
  docs: '/icons/document.svg',
  referral: '/icons/gift.svg',
  receipt: '/icons/receipt.svg',
  withdraw: '/icons/withdraw.svg',
  upload: '/icons/camera.svg',
  check: '/icons/check-circle.svg',
  clock: '/icons/clock.svg',
  alert: '/icons/alert-circle.svg',
}

type Tab = 'home' | 'discover' | 'earnings' | 'inbox' | 'menu'
type DocStatus = 'verified' | 'pending' | 'expired'

interface RiderProfile {
  name: string
  rating: string
  photoUrl: string
  vehicleModel: string
  plateNumber: string
}

interface DocumentItem {
  id: string
  name: string
  status: DocStatus
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

function StatusBadge({ status }: { status: DocStatus }) {
  const config = {
    verified: { label: 'Verified', color: BRAND.success, bg: BRAND.successBg, icon: ICONS.check },
    pending: { label: 'Pending', color: BRAND.pending, bg: BRAND.warningBg, icon: ICONS.clock },
    expired: { label: 'Expired', color: BRAND.expired, bg: '#FEF2F2', icon: ICONS.alert },
  }[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <IconImg src={config.icon} size={12} />
      {config.label}
    </span>
  )
}

export default function RiderMenuPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('menu')

  // ─── RIDER PROFILE ───
  const [profile, setProfile] = useState<RiderProfile>({
    name: 'Emmanuel Asante',
    rating: '4.92',
    photoUrl: DEFAULT_AVATAR,
    vehicleModel: 'Honda CBF 150',
    plateNumber: 'GN-1234-23',
  })

  // ─── DOCUMENTS ───
  const [documents] = useState<DocumentItem[]>([
    { id: 'doc1', name: 'Ghana Card', status: 'verified' },
    { id: 'doc2', name: 'Riding License', status: 'verified' },
    { id: 'doc3', name: 'Roadworthy Certificate', status: 'pending' },
    { id: 'doc4', name: 'Insurance', status: 'verified' },
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

  // ─── AVATAR UPLOAD ───
  const handleAvatarUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setProfile(p => ({ ...p, photoUrl: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.surfaceDark }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-10 h-10 rounded-full animate-spin border-4 border-solid" style={{ borderColor: `${BRAND.primary} transparent transparent transparent` }} />
          <p className="font-medium" style={{ color: BRAND.text }}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ═══════ PROFILE CARD ═══════ */}
      <header className="px-4 sm:px-6 pt-6 pb-5 border-b" style={{ borderColor: BRAND.border }}>
        <div className="max-w-lg mx-auto">
          {/* Photo — Tap to change */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleAvatarUpload}
              className="relative group flex-shrink-0"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2" style={{ borderColor: BRAND.border }}>
                <Image
                  src={profile.photoUrl}
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                <IconImg src={ICONS.upload} size={20} className="brightness-200" />
              </div>
            </button>

            {/* Name & Rating */}
            <div>
              <h1 className="text-xl font-bold" style={{ color: BRAND.text }}>{profile.name}</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <IconImg src={ICONS.star} size={16} />
                <span className="font-semibold" style={{ color: BRAND.text }}>{profile.rating}</span>
                <span className="text-xs" style={{ color: BRAND.textMuted }}>Rating</span>
              </div>
            </div>
          </div>

          {/* Help · Safety · Settings */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: 'Help', icon: ICONS.help, href: '/rider/help' },
              { label: 'Safety', icon: ICONS.shield, href: '/rider/safety' },
              { label: 'Settings', icon: ICONS.settings, href: '/rider/settings' },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors"
                style={{ backgroundColor: BRAND.surfaceAlt }}
              >
                <IconImg src={item.icon} size={20} />
                <span className="text-sm font-medium" style={{ color: BRAND.text }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════ MENU SECTIONS ═══════ */}
      <main className="flex-1 px-4 sm:px-6 pb-28 overflow-auto">
        <div className="max-w-lg mx-auto space-y-5 mt-4">

          {/* Vehicle */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.textMuted }}>Vehicle</h2>
            <Link
              href="/rider/vehicle"
              className="flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-slate-50"
              style={{ borderColor: BRAND.border }}
            >
              <div className="flex items-center gap-3">
                <IconImg src={ICONS.bike} size={20} />
                <div>
                  <p className="font-medium" style={{ color: BRAND.text }}>{profile.vehicleModel}</p>
                  <p className="text-sm mt-0.5" style={{ color: BRAND.textMuted }}>{profile.plateNumber}</p>
                </div>
              </div>
              <IconImg src={ICONS.chevron} size={16} />
            </Link>
          </section>

          {/* Documents */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.textMuted }}>Documents</h2>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              {documents.map((doc, index) => (
                <Link
                  key={doc.id}
                  href={`/rider/documents/${doc.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
                  style={{ borderBottom: index < documents.length - 1 ? `1px solid ${BRAND.border}` : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    <IconImg src={ICONS.docs} size={20} />
                    <span className="font-medium" style={{ color: BRAND.text }}>{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.status} />
                    <IconImg src={ICONS.chevron} size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Referrals */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.textMuted }}>Referrals</h2>
            <Link
              href="/rider/referrals"
              className="flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-slate-50"
              style={{ borderColor: BRAND.border }}
            >
              <div className="flex items-center gap-3">
                <IconImg src={ICONS.referral} size={20} />
                <div>
                  <p className="font-medium" style={{ color: BRAND.text }}>Invite Friends</p>
                  <p className="text-sm mt-0.5" style={{ color: BRAND.textMuted }}>Earn rewards when they ride</p>
                </div>
              </div>
              <IconImg src={ICONS.chevron} size={16} />
            </Link>
          </section>

          {/* Payment History */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.textMuted }}>Earnings</h2>
            <Link
              href="/rider/earnings"
              className="flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-slate-50"
              style={{ borderColor: BRAND.border }}
            >
              <div className="flex items-center gap-3">
                <IconImg src={ICONS.receipt} size={20} />
                <span className="font-medium" style={{ color: BRAND.text }}>Payment History</span>
              </div>
              <IconImg src={ICONS.chevron} size={16} />
            </Link>
          </section>

          {/* Withdraw */}
          <section>
            <Link
              href="/rider/earnings"
              className="flex items-center justify-between p-4 rounded-xl transition-colors"
              style={{ backgroundColor: BRAND.successBg }}
            >
              <div className="flex items-center gap-3">
                <IconImg src={ICONS.withdraw} size={20} style={{ filter: 'hue-rotate(140deg) saturate(1.5)' }} />
                <div>
                  <p className="font-bold" style={{ color: BRAND.success }}>Withdraw to Mobile Money</p>
                  <p className="text-sm mt-0.5" style={{ color: BRAND.success }}>Send balance to MTN / AirtelTigo</p>
                </div>
              </div>
              <IconImg src={ICONS.chevron} size={16} style={{ filter: 'brightness(0.5) saturate(2)' }} />
            </Link>
          </section>
        </div>
      </main>

      {/* ═══════ BOTTOM NAV — MENU ACTIVE ═══════ */}
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
                backgroundColor: activeTab === tab.key ? BRAND.primaryLight : 'transparent',
              }}
            >
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
              <span className="text-[11px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}