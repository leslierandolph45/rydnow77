'use client'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'


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


type FieldProps = {
  label: string
  name: string
  type?: string
  value: string
  placeholder: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  hint?: string
}


function Field({ label, name, type = 'text', value, placeholder, onChange, autoComplete, hint }: FieldProps) {
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
        />
        {isPassword && (
          <button type="button" className="rn-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  )
}


// ─── helpers ──────────────────────────────────────────────────────────────────
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


export default function RiderSignupPage() {
  const router = useRouter()


  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    motorbikeModel: '',
    licenseNumber: ''
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

      // Shows the exact backend payload in DevTools > Console while you debug.
      console.error('Register response', res.status, data)


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
        console.error('Registration succeeded but the response had no token:', data)
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
      console.error('Rider signup error:', err)
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
    <div className="rn-page">
      <style>{css}</style>


      <header className="rn-nav">
        <Link href="/" className="rn-logo">RYD<b>NOW</b></Link>
        <Link href="/" className="rn-back">← Back</Link>
      </header>


      <main className="rn-wrap">
        <span className="rn-eyebrow">Rider signup</span>
        <h1>Become a Rider</h1>
        <p className="rn-sub">Join RYDNOW and start earning today.</p>


        <div className="rn-steps" aria-label="Progress">
          <span className="on">1 Details</span>
          <span>2 Verification</span>
          <span>3 Start riding</span>
        </div>


        {error && <div className="rn-error" role="alert">{error}</div>}


        <form onSubmit={handleSubmit} className="rn-form">
          <Field label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Your full name" autoComplete="name" />
          <Field label="Email address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" autoComplete="email" />
          <Field label="Phone number" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+233 XX XXX XXXX" autoComplete="tel" />
          <Field label="Password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Create a strong password" autoComplete="new-password" hint="At least 8 characters." />
          <Field label="Confirm password" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" autoComplete="new-password" />


          <div className="rn-divider"><span>Your motorbike</span></div>


          <Field label="Motorbike model" name="motorbikeModel" value={formData.motorbikeModel} onChange={handleChange} placeholder="e.g. Honda CG 125" />
          <Field label="Motor vehicle license no." name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="Your license number" />


          <label className="rn-check">
            <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setError('') }} />
            <span>I agree to the <Link href="/terms">Terms & Conditions</Link> and <Link href="/privacy">Privacy Policy</Link></span>
          </label>


          <button type="submit" disabled={isSubmitting} className="rn-submit">
            {isSubmitting ? 'Please wait...' : 'Continue →'}
          </button>
          {slow && <p className="rn-signin" role="status">Waking up the server… this can take up to a minute.</p>}


          <p className="rn-signin">Already a rider? <Link href="/login">Sign in</Link></p>
        </form>
      </main>
    </div>
  )
}


const css =
`
.rn-page{--bg:#fff;--ink:#0B1540;--muted:#5B6385;--line:#E3E6F0;--field:#F2F4FA;--blue:#1E3FCE;--gold:#F5B82E;
  min-height:100dvh;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;line-height:1.5}
@media(prefers-color-scheme:dark){.rn-page{--bg:#0A0F2B;--ink:#fff;--muted:#A5ACCB;--line:#232B57;--field:#151C42}}
.rn-page *{box-sizing:border-box}
.rn-nav{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--line)}
.rn-logo{font-weight:900;font-style:italic;font-size:24px;letter-spacing:-.5px;color:var(--ink);text-decoration:none}
.rn-logo b{color:var(--gold)}
.rn-back{color:var(--muted);text-decoration:none;font-size:14px;font-weight:600}
.rn-wrap{max-width:440px;margin:0 auto;padding:36px 24px 56px}
.rn-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:8px}
.rn-wrap h1{font-size:34px;line-height:1.1;letter-spacing:-.03em;font-weight:800;margin:0 0 6px}
.rn-sub{color:var(--muted);margin:0 0 20px}
.rn-steps{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
.rn-steps span{font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--field);color:var(--muted)}
.rn-steps span.on{background:var(--ink);color:var(--bg)}
.rn-error{background:#FDECEC;border:1px solid #F5B5B5;color:#B42318;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:14px}
@media(prefers-color-scheme:dark){.rn-error{background:#3A1216;border-color:#7F1D1D;color:#FCA5A5}}
.rn-form{display:flex;flex-direction:column;gap:16px}
.rn-field label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
.rn-input{display:flex;align-items:center;background:var(--field);border:2px solid transparent;border-radius:10px;padding:0 14px}
.rn-input:focus-within{border-color:var(--blue);background:var(--bg)}
.rn-input input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:16px;padding:15px 0}
.rn-input input::placeholder{color:var(--muted)}
.rn-eye{border:0;background:transparent;color:var(--blue);font-weight:700;font-size:13px;cursor:pointer;padding:6px}
.rn-field small{display:block;margin-top:4px;color:var(--muted);font-size:12px}
.rn-divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:13px;font-weight:600;margin-top:4px}
.rn-divider:before,.rn-divider:after{content:"";flex:1;height:1px;background:var(--line)}
.rn-check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--muted);cursor:pointer}
.rn-check input{margin-top:3px;width:18px;height:18px;accent-color:var(--blue)}
.rn-check a{color:var(--blue);font-weight:600;text-decoration:none}
.rn-submit{margin-top:4px;padding:16px;background:var(--blue);color:#fff;border:0;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit}
.rn-submit:disabled{opacity:.7;cursor:not-allowed}
.rn-signin{text-align:center;color:var(--muted);font-size:14px;margin:4px 0 0}
.rn-signin a{color:var(--blue);font-weight:700;text-decoration:none}
`

