'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ————————————————————————— */
/*  Config                    */
/* ————————————————————————— */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://rydnow-backend.onrender.com'
);

const VERIFY_URL = `${API_BASE}/rider/verify/`;
// NEW endpoint: see backend/verification_status_view.py. Must be added to urls.py.
const STATUS_URL = `${API_BASE}/rider/verification-status/`;
const AUTH_SCHEME = 'Token';

// These keys MUST match what /rider-signup writes.
const TOKEN_KEY = 'authToken';
const RIDER_KEY = 'riderId';

const HOME_PATH = '/';
const SIGNUP_PATH = '/rider-signup';

const UPLOAD_TIMEOUT_MS = 60000;
const STATUS_POLL_MS = 30000;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/* ————————————————————————— */
/*  Types                     */
/* ————————————————————————— */

type DocField = 'ghanaCardFront' | 'ghanaCardBack' | 'passportPhoto' | 'licenseDoc' | 'vehicleReg';
type Files = Record<DocField, File | null>;
type Status = 'pending' | 'uploading' | 'done' | 'error';

// Values produced by the status endpoint (backend decides the stage).
type Stage = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'suspended';
type DocState = 'missing' | 'uploaded' | 'approved' | 'rejected';
type ServerDoc = { document_type: string; state: DocState; note: string };
type StatusPayload = { stage: Stage; documents: ServerDoc[]; rejection_reason?: string };

// apiName values MUST match RiderDocument.DocumentType values in models.py.
const DOCS: { field: DocField; label: string; desc: string; apiName: string }[] = [
  { field: 'ghanaCardFront', label: 'Ghana Card (Front) / National ID', desc: 'Clear photo of the front of your card', apiName: 'ghana_card_front' },
  { field: 'ghanaCardBack', label: 'Ghana Card (Back)', desc: 'Clear photo of the back of your card', apiName: 'ghana_card_back' },
  { field: 'passportPhoto', label: 'Passport-sized photo', desc: 'A clear, front-facing photo of your face', apiName: 'passport_photo' },
  { field: 'licenseDoc', label: 'Riding licence', desc: 'Your valid motor vehicle licence', apiName: 'riding_license' },
  { field: 'vehicleReg', label: 'Vehicle registration', desc: 'Your motorbike registration document', apiName: 'vehicle_registration' }
];

const EMPTY_FILES: Files = { ghanaCardFront: null, ghanaCardBack: null, passportPhoto: null, licenseDoc: null, vehicleReg: null };
const EMPTY_STATUS: Record<DocField, Status> = {
  ghanaCardFront: 'pending',
  ghanaCardBack: 'pending',
  passportPhoto: 'pending',
  licenseDoc: 'pending',
  vehicleReg: 'pending'
};

/* ————————————————————————— */
/*  Helpers                   */
/* ————————————————————————— */

const getStored = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
};

const clearStored = (key: string) => {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

/** Walks any nested error shape and returns readable messages. */
const flatten = (value: unknown, field = ''): string[] => {
  if (value == null) return [];
  if (typeof value === 'string') return [field ? `${field}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap(v => flatten(v, field));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, k === 'non_field_errors' ? '' : k.replace(/_/g, ' '))
    );
  }
  return [];
};

const extractError = (data: unknown): string => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;

  for (const k of ['errors', 'details', 'fields']) {
    const msgs = flatten(obj[k]);
    if (msgs.length) return msgs.join(' ');
  }
  const skip = ['error', 'message', 'success', 'status', 'detail'];
  const rest = flatten(Object.fromEntries(Object.entries(obj).filter(([k]) => !skip.includes(k))));
  if (rest.length) return rest.join(' ');
  for (const k of ['detail', 'error', 'message']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k] as string;
  }
  return '';
};

const BADGE: Record<Status, string> = {
  pending: '',
  uploading: 'Sending…',
  done: '✓ Sent',
  error: 'Failed'
};

/* ————————————————————————— */
/*  File Upload Component     */
/* ————————————————————————— */

function FileUploadBox({
  label, desc, note, file, status, onPick, onRemove, disabled
}: {
  label: string;
  desc: string;
  note: string;
  file: File | null;
  status: Status;
  onPick: (f: File) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview('');
  }, [file]);

  const badgeText = !file ? (note ? 'Re-upload' : 'Required') : BADGE[status] || 'Ready';
  const badgeClass = status === 'done' ? 'ok' : status === 'error' || (!file && note) ? 'err' : status === 'uploading' ? 'busy' : '';
  const descText = !file
    ? (note || desc)
    : status === 'done' ? 'Sent to RYDNOW'
    : status === 'error' ? 'Upload failed, tap Submit to retry'
    : 'Ready to send';

  return (
    <div className="rv-card">
      <div className="rv-card-top">
        <div>
          <div className="rv-label">{label}</div>
          <div className="rv-desc">{descText}</div>
        </div>
        <span className={`rv-badge ${badgeClass}`}>{badgeText}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />

      {file ? (
        <div className="rv-file">
          {preview ? <img src={preview} alt="" className="rv-thumb" /> : <div className="rv-thumb rv-pdf">PDF</div>}
          <div className="rv-fileinfo">
            <div className="rv-filename">{file.name}</div>
            <div className="rv-filesize">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <div className="rv-actions">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>Replace</button>
            <button type="button" onClick={onRemove} disabled={disabled} className="rm">Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="rv-drop" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <span className="rv-plus">+</span> Upload or take photo
        </button>
      )}
    </div>
  );
}

/* ————————————————————————— */
/*  Status screens (Step 3)   */
/* ————————————————————————— */

function StatusScreen({
  stage, onHome, onRefresh, refreshing
}: {
  stage: Exclude<Stage, 'not_started' | 'rejected'>;
  onHome: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (stage === 'approved') {
    return (
      <main className="rv-wrap rv-done">
        <div className="rv-check">✓</div>
        <h1>You&apos;re verified</h1>
        <p className="rv-sub">Great news! Your account is verified. Sign in and start earning.</p>
        <button className="rv-submit" onClick={onHome}>Back to home</button>
      </main>
    );
  }

  if (stage === 'suspended') {
    return (
      <main className="rv-wrap rv-done">
        <div className="rv-check rv-check-err">!</div>
        <h1>Account suspended</h1>
        <p className="rv-sub">Your rider account is suspended, so documents cannot be changed. Contact RYDNOW support for help.</p>
        <button className="rv-submit" onClick={onHome}>Back to home</button>
      </main>
    );
  }

  // under_review = Step 3 of 3
  return (
    <main className="rv-wrap rv-done">
      <div className="rv-check">✓</div>
      <span className="rv-eyebrow">Step 3 of 3</span>
      <h1>Documents submitted successfully</h1>
      <p className="rv-sub">Your account is being reviewed. We&apos;ll email you within 24–48 hours.</p>

      <ol className="rv-steps">
        <li><b>We check your documents.</b> An admin verifies each one.</li>
        <li><b>You get an email.</b> It tells you if you&apos;re approved or need to resend something.</li>
        <li><b>Approved means you can start earning.</b> Sign in and go online.</li>
      </ol>

      <p className="rv-lock">Documents cannot be changed while your account is under review.</p>

      <button className="rv-submit" onClick={onHome}>Back to home</button>
      <button className="rv-ghost" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Checking…' : 'Check status'}
      </button>
    </main>
  );
}

/* ————————————————————————— */
/*  Main Page Component       */
/* ————————————————————————— */

export default function RiderVerifyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>('not_started');
  const [reason, setReason] = useState('');
  const [serverDocs, setServerDocs] = useState<Record<string, ServerDoc>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<Files>(EMPTY_FILES);
  const [uploadStatus, setUploadStatus] = useState<Record<DocField, Status>>(EMPTY_STATUS);

  // Which documents the rider must (re)send right now.
  const rejected = DOCS.filter(d => serverDocs[d.apiName]?.state === 'rejected');
  const editableDocs =
    stage === 'rejected'
      ? rejected.length
        ? rejected
        : DOCS.filter(d => serverDocs[d.apiName]?.state !== 'approved')
      : DOCS;

  const addedCount = editableDocs.filter(d => files[d.field]).length;

  /** Reads the current status from the backend. Returns false if it could not. */
  const refreshStatus = useCallback(async (): Promise<boolean> => {
    const token = getStored(TOKEN_KEY);
    if (!token) {
      router.replace(SIGNUP_PATH);
      return false;
    }

    try {
      const res = await fetch(STATUS_URL, {
        headers: { Accept: 'application/json', Authorization: `${AUTH_SCHEME} ${token}` },
        cache: 'no-store'
      });
      if (res.status === 401 || res.status === 403) {
        clearStored(TOKEN_KEY);
        clearStored(RIDER_KEY);
        router.replace(SIGNUP_PATH);
        return false;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as Partial<StatusPayload>;
      if (!data.stage) return false;
      setStage(data.stage);
      setReason(data.rejection_reason || '');
      setServerDocs(Object.fromEntries((data.documents || []).map(d => [d.document_type, d])));
      return true;
    } catch {
      return false;
    }
  }, [router]);

  // On load: no token means the rider skipped signup. Otherwise sync with the server.
  useEffect(() => {
    if (!getStored(TOKEN_KEY)) {
      router.replace(SIGNUP_PATH);
      return;
    }
    refreshStatus().finally(() => setReady(true));
  }, [router, refreshStatus]);

  // While under review, pick up the admin's decision without the rider reloading.
  useEffect(() => {
    if (stage !== 'under_review') return;
    const tick = () => { if (document.visibilityState === 'visible') refreshStatus(); };
    const id = setInterval(tick, STATUS_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [stage, refreshStatus]);

  // A rejected rider starts with an empty form for the documents to resend.
  useEffect(() => {
    if (stage === 'rejected') {
      setFiles(EMPTY_FILES);
      setUploadStatus(EMPTY_STATUS);
    }
  }, [stage]);

  const handlePick = (field: DocField) => (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, WEBP or PDF file.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`That file is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError('');
    setFiles(prev => ({ ...prev, [field]: file }));
    setUploadStatus(prev => ({ ...prev, [field]: 'pending' }));
  };

  const handleRemove = (field: DocField) => () => {
    setFiles(prev => ({ ...prev, [field]: null }));
    setUploadStatus(prev => ({ ...prev, [field]: 'pending' }));
  };

  // Upload a single document
  const uploadDocument = async (docField: DocField, file: File) => {
    const authToken = getStored(TOKEN_KEY);
    if (!authToken) throw new Error('Your session has expired. Please sign up again.');

    const docConfig = DOCS.find(d => d.field === docField);
    if (!docConfig) throw new Error('Invalid document type');

    setUploadStatus(prev => ({ ...prev, [docField]: 'uploading' }));

    const body = new FormData();
    body.append('document_type', docConfig.apiName);
    body.append('document_file', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(VERIFY_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${AUTH_SCHEME} ${authToken}`
          },
          body,
          signal: controller.signal
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('Upload timed out. Please try again.');
        }
        throw new Error('Cannot reach the server. Check your connection and try again.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Your session has expired. Please sign up again.');
      }
      if (response.status === 413) {
        throw new Error(`That file is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (response.ok) {
          setUploadStatus(prev => ({ ...prev, [docField]: 'done' }));
          return true;
        }
        const text = await response.text().catch(() => '');
        console.error('Non-JSON response', response.status, text.slice(0, 300));
        if (response.status >= 502 && response.status <= 504) {
          throw new Error('The server is waking up. Please tap Submit again in a few seconds.');
        }
        throw new Error(`Server error (${response.status}). Please try again.`);
      }

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('Verify response', response.status, result);
        throw new Error(extractError(result) || 'Upload failed');
      }

      setUploadStatus(prev => ({ ...prev, [docField]: 'done' }));
      return true;
    } catch (err) {
      setUploadStatus(prev => ({ ...prev, [docField]: 'error' }));
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  // Send documents one at a time so the backend's auto-submit fires on the last one.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      for (const doc of editableDocs) {
        const file = files[doc.field];
        if (!file) throw new Error(`Please select your ${doc.label}`);
        if (uploadStatus[doc.field] === 'done') continue;
        await uploadDocument(doc.field, file);
      }

      // Keep the token so the rider can come back and see the decision.
      const synced = await refreshStatus();
      if (!synced) setStage('under_review');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      // e.g. a 409 because the account is already under review: show the real state.
      refreshStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStatus();
    setRefreshing(false);
  };

  // Loading state
  if (!ready) {
    return (
      <div className="rv-page">
        <style>{css}</style>
        <main className="rv-wrap"><p className="rv-sub">Loading…</p></main>
      </div>
    );
  }

  // Step 3 and final states
  if (stage === 'under_review' || stage === 'approved' || stage === 'suspended') {
    return (
      <div className="rv-page">
        <style>{css}</style>
        <StatusScreen
          stage={stage}
          onHome={() => router.push(HOME_PATH)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      </div>
    );
  }

  // Step 2: upload form (first time, or resend after rejection)
  const isResend = stage === 'rejected';

  return (
    <div className="rv-page">
      <style>{css}</style>

      <header className="rv-nav">
        <Link href="/" className="rv-logo">RYD<b>NOW</b></Link>
        <Link href={SIGNUP_PATH} className="rv-back">← Back</Link>
      </header>

      <form onSubmit={handleSubmit} className="rv-wrap">
        <span className="rv-eyebrow">{isResend ? 'Action needed' : 'Step 2 of 3'}</span>
        {isResend && (
          <div className="rv-error" role="alert" style={{ marginBottom: 16 }}>
            ⚠️ Update needed: {reason || 'Please re-upload the documents below.'}
          </div>
        )}

        <h1>{isResend ? 'We need new documents' : 'Verify your identity'}</h1>
        <p className="rv-sub">
          {isResend
            ? 'We need a clearer photo. Please re-upload the documents below and we will review them again.'
            : 'Upload these documents so we can approve your rider account.'}
        </p>

        <div className="rv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={editableDocs.length} aria-valuenow={addedCount}>
          <div style={{ width: `${editableDocs.length ? (addedCount / editableDocs.length) * 100 : 0}%` }} />
        </div>
        <div className="rv-count">{addedCount} of {editableDocs.length} documents added</div>

        {editableDocs.map(d => (
          <FileUploadBox
            key={d.field}
            label={d.label}
            desc={d.desc}
            note={isResend ? serverDocs[d.apiName]?.note || `Please re-upload your ${d.label}.` : ''}
            file={files[d.field]}
            status={uploadStatus[d.field]}
            onPick={handlePick(d.field)}
            onRemove={handleRemove(d.field)}
            disabled={isSubmitting}
          />
        ))}

        {isResend && DOCS.some(d => serverDocs[d.apiName]?.state === 'approved') && (
          <p className="rv-note">
            Already approved: {DOCS.filter(d => serverDocs[d.apiName]?.state === 'approved').map(d => d.label).join(', ')}.
          </p>
        )}

        <p className="rv-note">🔒 Your documents are stored securely and used only for verification. JPG, PNG, WEBP or PDF, up to {MAX_SIZE_MB} MB each.</p>

        <div className="rv-bar">
          {error && <div className="rv-error" role="alert">{error}</div>}
          <button
            type="submit"
            disabled={isSubmitting || editableDocs.length === 0 || addedCount < editableDocs.length}
            className="rv-submit"
          >
            {isSubmitting ? 'Submitting...' : isResend ? 'Send new documents' : 'Submit for review'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ————————————————————————— */
/*  Styles                    */
/* ————————————————————————— */

const css = `
.rv-page {
  --bg: #fff; --ink: #0B1540; --muted: #5B6385; --line: #E3E6F0; --field: #F2F4FA;
  --blue: #1E3FCE; --gold: #F5B82E; --ok: #0E8A4F; --err: #B42318;
  min-height: 100dvh; background: var(--bg); color: var(--ink);
  font-family: Inter, -apple-system, "Segoe UI", Roboto, system-ui, sans-serif; line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  .rv-page {
    --bg: #0A0F2B; --ink: #fff; --muted: #A5ACCB; --line: #232B57; --field: #151C42;
    --ok: #3DD68C; --err: #F87171;
  }
}
.rv-page * { box-sizing: border-box; }
.rv-nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 20px; border-bottom: 1px solid var(--line);
}
.rv-logo {
  font-weight: 900; font-style: italic; font-size: 24px; letter-spacing: -0.5px;
  color: var(--ink); text-decoration: none;
}
.rv-logo b { color: var(--gold); }
.rv-back {
  color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; padding: 8px 0;
}
.rv-wrap {
  max-width: 440px; margin: 0 auto;
  padding: 28px 20px calc(160px + env(safe-area-inset-bottom, 0px));
}
.rv-eyebrow {
  display: inline-block; font-size: 12px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--blue); margin-bottom: 8px;
}
.rv-wrap h1 {
  font-size: 32px; line-height: 1.1; letter-spacing: -0.03em;
  font-weight: 800; margin: 0 0 6px;
}
.rv-sub { color: var(--muted); margin: 0 0 20px; }
.rv-progress {
  height: 6px; background: var(--field); border-radius: 3px; overflow: hidden;
}
.rv-progress div {
  height: 100%; background: var(--blue); border-radius: 3px; transition: width 0.25s;
}
.rv-count {
  font-size: 13px; color: var(--muted); margin: 8px 0 20px; font-weight: 600;
}
.rv-error {
  background: #FDECEC; border: 1px solid #F5B5B5; color: #B42318;
  padding: 12px 16px; border-radius: 10px; margin: 0 auto 10px; max-width: 400px; font-size: 14px;
}
@media (prefers-color-scheme: dark) {
  .rv-error {
    background: #3A1216; border-color: #7F1D1D; color: #FCA5A5;
  }
}
.rv-card {
  border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 14px;
}
.rv-card-top {
  display: flex; justify-content: space-between; gap: 12px;
  align-items: flex-start; margin-bottom: 12px;
}
.rv-label { font-weight: 700; font-size: 16px; }
.rv-desc { color: var(--muted); font-size: 13px; }
.rv-badge {
  font-size: 12px; font-weight: 700; padding: 4px 10px;
  border-radius: 999px; background: var(--field);
  color: var(--muted); white-space: nowrap;
}
.rv-badge.ok { background: var(--ok); color: #fff; }
.rv-badge.busy { background: var(--blue); color: #fff; }
.rv-badge.err { background: var(--err); color: #fff; }
.rv-drop {
  width: 100%; min-height: 56px; border: 2px dashed var(--blue);
  background: transparent; color: var(--blue); border-radius: 10px;
  font: inherit; font-weight: 700; font-size: 15px; cursor: pointer;
}
.rv-drop:disabled { opacity: 0.5; cursor: not-allowed; }
.rv-plus { font-size: 20px; margin-right: 6px; vertical-align: -2px; }
.rv-file { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.rv-thumb {
  width: 64px; height: 64px; border-radius: 10px;
  object-fit: cover; background: var(--field); flex: none;
}
.rv-pdf {
  display: grid; place-items: center; font-weight: 800;
  color: var(--blue); font-size: 14px;
}
.rv-fileinfo { flex: 1; min-width: 0; }
.rv-filename {
  font-weight: 600; font-size: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rv-filesize { color: var(--muted); font-size: 12px; }
.rv-actions { display: flex; gap: 8px; width: 100%; }
.rv-actions button {
  flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--line);
  background: transparent; color: var(--ink); font: inherit;
  font-weight: 600; font-size: 14px; cursor: pointer;
}
.rv-actions button.rm { color: var(--err); }
.rv-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.rv-note { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.rv-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--bg); border-top: 1px solid var(--line);
}
.rv-submit {
  display: block; width: 100%; max-width: 400px; margin: 0 auto; padding: 16px;
  background: var(--blue); color: #fff; border: 0; border-radius: 10px;
  font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
}
.rv-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.rv-ghost {
  display: block; width: 100%; max-width: 400px; margin: 10px auto 0; padding: 14px;
  background: transparent; color: var(--blue); border: 1px solid var(--line); border-radius: 10px;
  font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
}
.rv-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.rv-done { text-align: center; padding-top: 72px; padding-bottom: 56px; }
.rv-done .rv-submit { margin-top: 24px; }
.rv-check {
  width: 72px; height: 72px; border-radius: 50%; background: var(--ok); color: #fff;
  display: grid; place-items: center; font-size: 36px; font-weight: 800; margin: 0 auto 20px;
}
.rv-check-err { background: var(--err); }
.rv-steps {
  text-align: left; margin: 20px 0 0; padding: 16px 16px 16px 36px;
  border: 1px solid var(--line); border-radius: 14px; font-size: 14px; color: var(--muted);
}
.rv-steps li + li { margin-top: 10px; }
.rv-steps b { color: var(--ink); }
.rv-lock {
  margin: 16px 0 0; padding: 12px 14px; border-radius: 10px;
  background: var(--field); font-size: 13px; font-weight: 600; color: var(--muted);
}
`;

