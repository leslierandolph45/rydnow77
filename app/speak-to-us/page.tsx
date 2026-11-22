'use client'
import Link from 'next/link'

const BRAND_NAVY = '#0A2342'
const BRAND_GOLD = '#F5A623'

export default function SpeakToUsPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: BRAND_NAVY }}>
          Speak To Us
        </h1>
        <p className="mb-6 text-gray-600">
          Contact us at help.rydnow@outlook.com
        </p>
        <Link href="/" className="font-bold" style={{ color: BRAND_GOLD }}>
          ← Back to Home
        </Link>
      </div>
    </main>
  )
}