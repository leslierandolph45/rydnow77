import type { ReactNode } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

/**
 * Shared layout for the rider onboarding pages (/rider-signup, /rider-verify).
 *
 * Phone:        blue hero on top, form card overlapping it.
 * Tablet/iPad:  (>= 768px) fixed hero panel on the left, form card on the right.
 *
 * Layout fix: the form column used to shrink to its content (auto side margins on a grid item
 * disable stretching), which squeezed the card and wrapped headings one word per line.
 * The form column now has an explicit width and is centred with justify-self, and every layout
 * element sets display/width/margin/padding itself so global CSS (globals.css) cannot collapse it.
 */

export const SUPPORT_EMAIL = 'support@rydnow.app'
const SUPPORT_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Rider help')}`

export type RiderStep = 1 | 2 | 3
const STEP_LABELS = ['Your details', 'Documents', 'Go online'] as const

/* ───────────── Route progress ───────────── */

export function RouteSteps({ step, allDone = false }: { step: RiderStep; allDone?: boolean }) {
  return (
    <ol className="rn-route" aria-label="Signup progress">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const state = allDone || n < step ? 'done' : n === step ? 'now' : 'todo'
        return (
          <li key={label} className={`rn-stop ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="rn-pin">{state === 'done' ? '✓' : n}</span>
            <span className="rn-stoplabel">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ───────────── Support ───────────── */

export function SupportCard() {
  return (
    <aside className="rn-help" aria-label="Support">
      <span className="rn-help-ic" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 8 8 6 8-6" />
        </svg>
      </span>
      <span className="rn-help-tx">
        <b>Having trouble?</b>
        <span>Email us and we will help you get on the road.</span>
        <a href={SUPPORT_HREF}>{SUPPORT_EMAIL}</a>
      </span>
    </aside>
  )
}

/** Error box that always shows the support address. */
export function ErrorNote({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="rn-error" role="alert">
      <span>{message}</span>
      <small>
        Still stuck? <a href={SUPPORT_HREF}>{SUPPORT_EMAIL}</a>
      </small>
    </div>
  )
}

function Perk({ title, text }: { title: string; text: string }) {
  return (
    <li>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#F9D342" />
        <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#0A2342" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <b>{title}</b>
        {text}
      </span>
    </li>
  )
}

/* ───────────── Shell ───────────── */

export function RiderShell({
  step,
  allDone = false,
  headline,
  lead,
  backHref,
  backLabel = 'Back',
  children,
}: {
  step: RiderStep
  allDone?: boolean
  headline: string
  lead: string
  backHref: string
  backLabel?: string
  children: ReactNode
}) {
  return (
    <div className="rn" id="rn-scroll">
      <style>{shellCss}</style>
      <div className="rn-grid">
        <header className="rn-hero">
          <div className="rn-top">
            <span className="rn-chip">
              <Logo />
            </span>
            <Link href={backHref} className="rn-back">
              ← {backLabel}
            </Link>
          </div>

          <h1>{headline}</h1>
          <p className="rn-lead">{lead}</p>
          <RouteSteps step={step} allDone={allDone} />

          <ul className="rn-perks">
            <Perk title="You choose when to ride" text="Go online when it suits you." />
            <Perk title="Okada and Parcel jobs" text="Rides and deliveries near you." />
            <Perk title="Verified once" text="Documents reviewed within 24–48 hours." />
          </ul>
        </header>

        <main className="rn-main">
          {children}
          <SupportCard />
        </main>
      </div>
    </div>
  )
}

/* ───────────── Styles ───────────── */

export const shellCss = `
.rn{--navy:#0A2342;--blue:#1E5EDC;--orange:#F9D342;--orange-deep:#C79A0C;--paper:#F2F5FB;--card:#fff;--ink:#0A2342;--muted:#58657F;
  --line:#DAE1EE;--edge:#9FADC7;--field:#F6F8FC;--focus:#1E5EDC;--ok:#0E8A4F;--err:#B42318;--errbg:#FDECEC;--errline:#F5B5B5;
  --pad-x:18px;--pad-y:22px;
  position:fixed;inset:0;z-index:1000;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  display:block;margin:0;padding:0;background:var(--paper);color:var(--ink);-webkit-text-size-adjust:100%;
  font-family:"Plus Jakarta Sans",Inter,-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;line-height:1.5}
@media(prefers-color-scheme:dark){.rn{--paper:#071428;--card:#0E1D3A;--ink:#F3F6FC;--muted:#A3B0CB;--line:#233358;--edge:#4A5C8C;--field:#09152C;
  --focus:#F9D342;--ok:#3DD68C;--err:#F87171;--errbg:#3A1216;--errline:#7F1D1D}}
html,body{overflow:hidden!important}
.rn *,.rn *:before,.rn *:after{box-sizing:border-box}
.rn a{-webkit-tap-highlight-color:transparent}
.rn :focus-visible{outline:3px solid var(--orange);outline-offset:2px}

/* ── layout (every element sets its own display/width so global CSS cannot collapse it) ── */
.rn .rn-grid{display:block;width:100%;margin:0;padding:0}
.rn .rn-hero{display:block;position:relative;width:100%;max-width:none;margin:0;color:#fff;border-radius:0 0 28px 28px;
  background:linear-gradient(165deg,#0A2342 0%,#143A86 55%,#1E5EDC 120%);
  padding:max(16px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) 62px max(20px,env(safe-area-inset-left))}
.rn .rn-top{display:flex;justify-content:space-between;align-items:center;margin:0 0 26px}
.rn .rn-chip{display:inline-flex;background:#fff;border-radius:14px;padding:6px 12px 6px 6px}
.rn .rn-back{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;color:#fff;opacity:.9;text-decoration:none;font-size:14px;font-weight:700}
.rn .rn-hero h1{width:auto;max-width:none;margin:0 0 10px;padding:0;font-size:clamp(30px,8.4vw,42px);line-height:1.05;letter-spacing:-.035em;font-weight:800;text-wrap:balance;color:#fff}
.rn .rn-lead{max-width:36ch;margin:0 0 28px;color:rgba(255,255,255,.8);font-size:16px}
.rn .rn-perks{display:none;list-style:none;margin:0;padding:0}
.rn .rn-main{display:block;position:relative;width:100%;min-width:0;max-width:540px;margin:-32px auto 0;
  padding:0 max(16px,env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}

/* ── route progress ── */
.rn .rn-route{display:flex;list-style:none;margin:0;padding:0}
.rn .rn-stop{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.rn .rn-stop+.rn-stop:before{content:"";position:absolute;top:17px;right:50%;width:100%;border-top:3px dashed rgba(255,255,255,.3)}
.rn .rn-stop.done:before,.rn .rn-stop.now:before{border-top:3px solid var(--orange)}
.rn .rn-pin{position:relative;z-index:1;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;
  font-weight:800;font-size:15px;background:#1B4AA8;color:rgba(255,255,255,.85);border:2px solid rgba(255,255,255,.25)}
.rn .rn-stop.done .rn-pin{background:#fff;color:var(--navy);border-color:#fff}
.rn .rn-stop.now .rn-pin{background:var(--orange);color:var(--navy);border-color:var(--orange)}
.rn .rn-stop.now .rn-pin:after{content:"";position:absolute;inset:-7px;border-radius:50%;border:2px solid var(--orange);animation:rn-pulse 1.9s ease-out infinite}
.rn .rn-stoplabel{font-size:13px;font-weight:700;color:rgba(255,255,255,.7)}
.rn .rn-stop.now .rn-stoplabel,.rn .rn-stop.done .rn-stoplabel{color:#fff}
@keyframes rn-pulse{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.35);opacity:0}}

/* ── form card ── */
.rn .rn-sheet{display:block;width:100%;min-width:0;max-width:none;margin:0;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:var(--pad-y) var(--pad-x);box-shadow:0 12px 32px rgba(10,35,66,.16)}
.rn .rn-sheet h2{width:auto;max-width:none;margin:0 0 4px;padding:0;font-size:22px;line-height:1.2;letter-spacing:-.02em;font-weight:800;color:var(--ink);overflow-wrap:normal;word-break:normal}
.rn .rn-sheet-sub{max-width:none;margin:0 0 20px;color:var(--muted);font-size:15px}

/* ── form ── */
.rn .rn-form{display:flex;flex-direction:column;gap:16px;width:100%;min-width:0;margin:0;padding:0}
.rn .rn-field{display:block;width:100%;min-width:0}
.rn .rn-field label{display:block;margin:0 0 6px;font-size:14px;font-weight:700}
.rn .rn-input{display:flex;align-items:center;width:100%;min-height:58px;background:var(--field);border:2px solid var(--edge);border-radius:14px;padding:0 14px;transition:border-color .15s,box-shadow .15s}
.rn .rn-input:hover{border-color:var(--blue)}
.rn .rn-input:focus-within{border-color:var(--focus);box-shadow:0 0 0 4px rgba(30,94,220,.22)}
@media(prefers-color-scheme:dark){.rn .rn-input:focus-within{box-shadow:0 0 0 4px rgba(249,211,66,.28)}}
.rn .rn-input input{display:block;flex:1 1 auto;width:100%;min-width:0;height:auto;min-height:54px;margin:0;padding:0;border:0;outline:0;border-radius:0;
  background:transparent;color:var(--ink);-webkit-text-fill-color:var(--ink);opacity:1;visibility:visible;-webkit-appearance:none;appearance:none;font:inherit;font-size:16px;box-shadow:none}
.rn .rn-input input:-webkit-autofill{-webkit-text-fill-color:var(--ink);-webkit-box-shadow:0 0 0 100px var(--field) inset;caret-color:var(--ink)}
.rn .rn-input input::placeholder{color:var(--muted);opacity:.8}
.rn .rn-eye{flex:none;min-width:56px;min-height:44px;border:0;background:transparent;color:var(--ink);font:inherit;font-weight:700;font-size:13px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.rn .rn-field small{display:block;margin-top:5px;color:var(--muted);font-size:12.5px}
.rn .rn-meter{display:flex;gap:5px;margin-top:8px}
.rn .rn-meter i{flex:1;height:5px;border-radius:3px;background:var(--line)}
.rn .rn-meter i.on{background:var(--orange)}
.rn .rn-meter-tx{margin-top:5px;font-size:12.5px;color:var(--muted)}
.rn .rn-divider{display:flex;align-items:center;gap:12px;margin-top:6px;color:var(--muted);font-size:14px;font-weight:700}
.rn .rn-divider:before,.rn .rn-divider:after{content:"";flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 8px,transparent 8px 14px)}
.rn .rn-check{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--muted);cursor:pointer;padding:4px 0}
.rn .rn-check input{flex:none;margin:2px 0 0;width:22px;height:22px;accent-color:var(--blue)}
.rn .rn-check a{color:var(--ink);font-weight:700;text-underline-offset:3px}

/* ── buttons ── */
.rn .rn-submit{display:block;width:100%;min-height:56px;margin:0;padding:15px 18px;border:0;border-radius:14px;background:var(--orange);color:var(--navy);
  font:inherit;font-size:17px;font-weight:800;letter-spacing:-.01em;cursor:pointer;box-shadow:0 4px 0 var(--orange-deep);
  transition:transform .08s,box-shadow .08s}
.rn .rn-submit:active:not(:disabled){transform:translateY(3px);box-shadow:0 1px 0 var(--orange-deep)}
.rn .rn-submit:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.rn .rn-ghost{display:block;width:100%;min-height:52px;margin:12px 0 0;padding:13px;border:2px solid var(--line);border-radius:14px;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.rn .rn-ghost:disabled{opacity:.55;cursor:not-allowed}
.rn .rn-signin{margin:6px 0 0;text-align:center;color:var(--muted);font-size:14px}
.rn .rn-signin a{color:var(--ink);font-weight:800;text-underline-offset:3px}

/* ── errors + help ── */
.rn .rn-error{display:flex;flex-direction:column;gap:4px;margin:0 0 16px;padding:12px 14px;border:1px solid var(--errline);border-radius:12px;background:var(--errbg);color:var(--err);font-size:14px;font-weight:600}
.rn .rn-error small{font-size:12.5px;font-weight:500;opacity:.9}
.rn .rn-error a{color:inherit;font-weight:700}
.rn .rn-help{display:flex;gap:14px;align-items:flex-start;width:100%;margin:16px 0 0;padding:16px;border-radius:18px;background:var(--navy);color:#fff;border:1px solid #1D3560}
.rn .rn-help-ic{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--orange);color:var(--navy)}
.rn .rn-help-tx{display:flex;flex-direction:column;gap:2px;min-width:0;font-size:14px;color:rgba(255,255,255,.8)}
.rn .rn-help-tx b{color:#fff;font-size:15px}
.rn .rn-help-tx a{margin-top:4px;color:var(--orange);font-weight:800;font-size:16px;text-underline-offset:3px;overflow-wrap:anywhere}

/* ── tablet / iPad and up: the form column is the bigger one (about 60%) ── */
@media(min-width:768px){
  .rn{--pad-x:32px;--pad-y:36px}
  .rn .rn-grid{display:grid;grid-template-columns:minmax(260px,2fr) minmax(0,3fr);align-items:start;min-height:100%}
  .rn .rn-hero{position:sticky;top:0;height:100dvh;display:flex;flex-direction:column;border-radius:0;padding:32px 36px;overflow-y:auto}
  .rn .rn-top{margin-bottom:48px}
  .rn .rn-hero h1{font-size:clamp(30px,3.4vw,46px)}
  .rn .rn-route{max-width:380px}
  .rn .rn-perks{display:grid;gap:16px;margin-top:auto;padding-top:32px}
  .rn .rn-perks li{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:rgba(255,255,255,.78)}
  .rn .rn-perks svg{flex:none;margin-top:1px}
  .rn .rn-perks b{display:block;color:#fff;font-size:15px}
  /* explicit width + justify-self (NOT auto margins) so the card never shrinks to its content */
  .rn .rn-main{width:100%;max-width:780px;margin:0;justify-self:center;align-self:start;padding:48px 40px}
  .rn .rn-sheet{box-shadow:0 4px 18px rgba(10,35,66,.08)}
  .rn .rn-sheet h2{font-size:28px}
  .rn .rn-sheet-sub{font-size:16px}
  .rn .rn-form{gap:20px}
  .rn .rn-field label{font-size:15px}
  .rn .rn-input input{min-height:60px;font-size:17px}
  .rn .rn-submit{min-height:62px;font-size:18px}
}
@media(min-width:1280px){
  .rn{--pad-x:44px;--pad-y:44px}
  .rn .rn-main{max-width:860px;padding:64px 48px}
  .rn .rn-hero{padding:40px 56px}
  .rn .rn-hero h1{font-size:clamp(40px,3.4vw,58px)}
}
@media(min-width:1680px){
  .rn{--pad-x:52px;--pad-y:52px}
  .rn .rn-main{max-width:960px}
  .rn .rn-input{min-height:64px}
  .rn .rn-input input{min-height:60px;font-size:18px}
  .rn .rn-sheet h2{font-size:32px}
}
@media(min-width:768px) and (max-height:700px){.rn .rn-perks{display:none}}
@media(prefers-reduced-motion:reduce){.rn *,.rn *:before,.rn *:after{animation:none!important;transition:none!important}}
`

