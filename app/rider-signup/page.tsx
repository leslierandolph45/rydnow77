'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RiderShell, ErrorNote } from '@/components/rider/RiderShell'

/* ───────────── Config ───────────── */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://rydnow-backend.onrender.com'
).replace(/\/+$/, '')
const REGISTER_URL = `${API_BASE}/auth/register/rider/`
const VERIFY_PATH = '/rider-verify'
const REQUEST_TIMEOUT_MS = 60000 // Render free instances can take ~50s to wake up
const SLOW_NOTICE_MS = 5000

// These keys MUST match what /rider-verify reads.
const TOKEN_KEY = 'authToken'
const RIDER_KEY = 'riderId'

/** Logs backend payloads while developing only. Never log responses in production (they can hold tokens). */
const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.debug(...args)
}

/* ───────────── Field ───────────── */

type FieldProps = {
  label: string
  name: string
  type?: string
  value: string
  placeholder: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  hint?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  autoCapitalize?: string
  extra?: ReactNode
}

function Field({ label, name, type = 'text', value, placeholder, onChange, autoComplete, hint, inputMode, autoCapitalize, extra }: FieldProps) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="rn-field">
      <label htmlFor={name}>{label}</label>
      <div className="rn-input">
        <input
          id={name}
          name={name}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            className="rn-eye"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <small>{hint}</small>}
      {extra}
    </div>
  )
}

/** Visual hint only. The real rule (8+ characters) is enforced in handleSubmit and by the backend. */
function PasswordMeter({ password }: { password: string }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  if (password.length < 8) score = 0
  const labels = ['Use at least 8 characters', 'Weak', 'Okay', 'Good', 'Strong']
  return (
    <>
      <div className="rn-meter" aria-hidden="true">
        {[1, 2, 3, 4].map(i => (
          <i key={i} className={score >= i ? 'on' : ''} />
        ))}
      </div>
      <div className="rn-meter-tx" aria-live="polite">{labels[score]}</div>
    </>
  )
}

/* ───────────── Helpers ───────────── */

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name',
  email: 'Email',
  phone: 'Phone number',
  password: 'Password',
  motorbike_model: 'Motorbike model',
  license_number: 'License number',
}

/** Walks any nested error shape (strings, arrays, objects) and returns readable "Field: message" strings. */
function flatten(value: unknown, field = ''): string[] {
  if (value == null) return []
  if (typeof value === 'string') {
    return [field ? `${FIELD_LABELS[field] ?? field}: ${value}` : value]
  }
  if (Array.isArray(value)) return value.flatMap(v => flatten(v, field))
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, k === 'non_field_errors' ? '' : k)
    )
  }
  return []
}

/** Turns whatever the API sends back into one readable sentence. Specific field errors win over generic messages. */
function extractError(data: unknown, fallback: string): string {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (typeof data !== 'object') return fallback
  const obj = data as Record<string, unknown>

  // 1. Specific details first, e.g. {"error":"Validation failed.","details":{"email":["..."]}}
  for (const k of ['errors', 'details', 'fields']) {
    const msgs = flatten(obj[k])
    if (msgs.length) return msgs.join(' ')
  }

  // 2. Plain DRF field errors, e.g. {"email":["..."],"phone":["..."]}
  const skip = ['error', 'message', 'success', 'status', 'detail']
  const rest = flatten(Object.fromEntries(Object.entries(obj).filter(([k]) => !skip.includes(k))))
  if (rest.length) return rest.join(' ')

  // 3. Generic message last
  for (const k of ['detail', 'error', 'message']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k] as string
  }
  return fallback
}

/** Reads the first string found under any of the given keys (supports nested {rider:{id}} / {data:{...}}). */
function pick(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v) return v
    if (typeof v === 'number') return String(v)
  }
  for (const nested of ['data', 'rider', 'user']) {
    const found = pick(obj[nested], keys)
    if (found) return found
  }
  return null
}

function safeStore(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    /* private mode / storage full: verification page falls back to asking again */
  }
}

/* ───────────── Page ───────────── */

export default function RiderSignupPage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    motorbikeModel: '',
    licenseNumber: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false) // blocks double-taps before state updates

  // Warm up the next page so the redirect feels instant.
  useEffect(() => {
    router.prefetch(VERIFY_PATH)
  }, [router])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inFlight.current) return
    setError('')

    // Client-side checks
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!agreed) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.')
      return
    }

    inFlight.current = true
    setIsSubmitting(true)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let success = false

    try {
      // Step 1: register the rider
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.replace(/\s+/g, ''),
          password: formData.password,
          motorbike_model: formData.motorbikeModel.trim(),
          license_number: formData.licenseNumber.trim(),
        }),
      })

      // The API must answer with JSON. HTML means a proxy/server error page (wrong URL, crash, cold start).
      const isJson = (res.headers.get('content-type') || '').includes('application/json')
      const data: unknown = isJson ? await res.json().catch(() => null) : null

      debug('Register response', res.status, data)

      if (!res.ok) {
        if (!isJson) {
          throw new Error(
            res.status >= 500
              ? 'Our server is having a problem. Please try again in a moment.'
              : 'Could not reach the registration service. Please try again.'
          )
        }
        throw new Error(extractError(data, 'Registration failed. Please check your details and try again.'))
      }

      // Registration succeeded: keep what the verification page needs.
      const riderId = pick(data, ['rider_id', 'id', 'pk'])
      const token = pick(data, ['token', 'key', 'access', 'access_token'])

      if (!token) {
        // The verification page needs this token to upload documents.
        debug('Registration succeeded but the response had no token:', data)
        throw new Error(
          'Your account was created, but we could not start verification automatically. Please sign in to continue.'
        )
      }

      // Same keys that /rider-verify reads. Stored in both so a refresh or new tab still works.
      safeStore(sessionStorage, TOKEN_KEY, token)
      safeStore(localStorage, TOKEN_KEY, token)
      if (riderId) {
        safeStore(sessionStorage, RIDER_KEY, riderId)
        safeStore(localStorage, RIDER_KEY, riderId)
      }

      // Never store the password.
      const safeData = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        motorbikeModel: formData.motorbikeModel,
        licenseNumber: formData.licenseNumber,
      }
      safeStore(sessionStorage, 'riderSignupData', JSON.stringify(safeData))

      // Step 2: continue to document verification
      success = true
      router.push(VERIFY_PATH)
    } catch (err) {
      debug('Rider signup error:', err)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The server is taking too long to respond. Please try again in a minute.')
      } else if (err instanceof TypeError) {
        // fetch() network failure: offline, blocked by CORS, or server down
        setError('Cannot reach the server. Check your internet connection and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      clearTimeout(slowTimer)
      clearTimeout(abortTimer)
      setSlow(false)
      inFlight.current = false
      // Keep the button disabled while the redirect is happening so it can't be tapped twice.
      if (!success) setIsSubmitting(false)
    }
  }

  return (
    <RiderShell
      step={1}
      headline="Your bike. Your hours. Your road."
      lead="Create your rider account in about two minutes, then verify once and start taking jobs."
      backHref="/"
    >
      <section className="rn-sheet">
        <h2>Create your rider account</h2>
        <p className="rn-sheet-sub">Step 1 of 3. Tell us who you are and what you ride.</p>

        <ErrorNote message={error} />

        <form onSubmit={handleSubmit} className="rn-form">
          <Field label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Your full name" autoComplete="name" autoCapitalize="words" />
          <Field label="Email address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" autoComplete="email" inputMode="email" autoCapitalize="none" />
          <Field label="Phone number" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+233 XX XXX XXXX" autoComplete="tel" inputMode="tel" />
          <Field
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a strong password"
            autoComplete="new-password"
            hint="At least 8 characters."
            extra={<PasswordMeter password={formData.password} />}
          />
          <Field label="Confirm password" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" autoComplete="new-password" />

          <div className="rn-divider"><span>Your motorbike</span></div>

          <Field label="Motorbike model" name="motorbikeModel" value={formData.motorbikeModel} onChange={handleChange} placeholder="e.g. Honda CG 125" autoCapitalize="words" />
          <Field label="Motor vehicle license no." name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="Your license number" autoComplete="off" autoCapitalize="characters" />

          <label className="rn-check">
            <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setError('') }} />
            <span>I agree to the <Link href="/terms">Terms &amp; Conditions</Link> and <Link href="/privacy">Privacy Policy</Link></span>
          </label>

          <button type="submit" disabled={isSubmitting} className="rn-submit">
            {isSubmitting ? 'Creating your account…' : 'Continue to verification'}
          </button>
          {slow && <p className="rn-signin" role="status">Waking up the server… this can take up to a minute.</p>}

          <p className="rn-signin">Already a rider? <Link href="/login">Sign in</Link></p>
        </form>
      </section>
    </RiderShell>
  )
}

