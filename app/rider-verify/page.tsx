'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RiderShell, ErrorNote, type RiderStep } from '@/components/rider/RiderShell';

/* ───────────── Config ───────────── */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://rydnow-backend.onrender.com'
).replace(/\/+$/, '');

const VERIFY_URL = `${API_BASE}/rider/verify/`;
// Endpoint: backend/verification_status_view.py. Must be registered in urls.py.
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

/* ───────────── Types ───────────── */

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
  { field: 'vehicleReg', label: 'Vehicle registration', desc: 'Your motorbike registration document', apiName: 'vehicle_registration' },
];

const EMPTY_FILES: Files = { ghanaCardFront: null, ghanaCardBack: null, passportPhoto: null, licenseDoc: null, vehicleReg: null };
const EMPTY_STATUS: Record<DocField, Status> = {
  ghanaCardFront: 'pending',
  ghanaCardBack: 'pending',
  passportPhoto: 'pending',
  licenseDoc: 'pending',
  vehicleReg: 'pending',
};

/* ───────────── Helpers ───────────── */

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
  error: 'Failed',
};

/* ───────────── Upload card ───────────── */

function FileUploadBox({
  label, desc, note, file, status, onPick, onRemove, disabled,
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
  const badgeClass = status === 'done' ? 'ok' : status === 'error' || (!file && note) ? 'err' : status === 'uploading' ? 'busy' : file ? 'ready' : '';
  const descText = !file
    ? (note || desc)
    : status === 'done' ? 'Sent to RYDNOW'
    : status === 'error' ? 'Upload failed, tap the button below to retry'
    : 'Ready to send';

  return (
    <div className={`rv-card${file ? ' has-file' : ''}${status === 'error' ? ' failed' : ''}`}>
      <div className="rv-card-top">
        <div className="rv-card-tx">
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
          <span className="rv-plus" aria-hidden="true">+</span> Upload or take photo
        </button>
      )}
    </div>
  );
}

/* ───────────── Status panels (after submit) ───────────── */

function StatusPanel({
  stage, onHome, onRefresh, refreshing,
}: {
  stage: Exclude<Stage, 'not_started' | 'rejected'>;
  onHome: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (stage === 'approved') {
    return (
      <section className="rn-sheet rv-status">
        <div className="rv-badge-lg">✓</div>
        <h2>You&apos;re verified</h2>
        <p className="rn-sheet-sub">Your account is approved. Sign in, go online and start earning.</p>
        <button className="rn-submit" onClick={onHome}>Back to home</button>
      </section>
    );
  }

  if (stage === 'suspended') {
    return (
      <section className="rn-sheet rv-status">
        <div className="rv-badge-lg bad">!</div>
        <h2>Account suspended</h2>
        <p className="rn-sheet-sub">Your rider account is suspended, so documents cannot be changed. Email support and we will explain what happens next.</p>
        <button className="rn-submit" onClick={onHome}>Back to home</button>
      </section>
    );
  }

  // under_review
  return (
    <section className="rn-sheet rv-status">
      <div className="rv-badge-lg">✓</div>
      <h2>Documents submitted</h2>
      <p className="rn-sheet-sub">Your account is being reviewed. We&apos;ll email you within 24–48 hours.</p>

      <ol className="rv-steps">
        <li><b>We check your documents.</b> An admin verifies each one.</li>
        <li><b>You get an email.</b> It tells you if you&apos;re approved or need to resend something.</li>
        <li><b>Approved means you can start earning.</b> Sign in and go online.</li>
      </ol>

      <p className="rv-lock">Documents cannot be changed while your account is under review.</p>

      <button className="rn-submit" onClick={onHome}>Back to home</button>
      <button className="rn-ghost" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Checking…' : 'Check status'}
      </button>
    </section>
  );
}

/* ───────────── Page ───────────── */

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
        cache: 'no-store',
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
            Authorization: `${AUTH_SCHEME} ${authToken}`,
          },
          body,
          signal: controller.signal,
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
        if (response.status >= 502 && response.status <= 504) {
          throw new Error('The server is waking up. Please tap the button again in a few seconds.');
        }
        throw new Error(`Server error (${response.status}). Please try again.`);
      }

      const result = await response.json().catch(() => null);
      if (!response.ok) {
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
      document.getElementById('rn-scroll')?.scrollTo({ top: 0 });
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

  /* ── Render ── */

  const isResend = stage === 'rejected';
  const isFinal = stage === 'under_review' || stage === 'approved' || stage === 'suspended';

  let step: RiderStep = 2;
  let headline = 'Show us who is riding.';
  let lead = 'Upload five clear documents. We review them within 24–48 hours.';
  if (!ready) {
    headline = 'Checking your account…';
    lead = 'One moment while we load your verification status.';
  } else if (isResend) {
    headline = 'A few documents need another look.';
    lead = 'Re-upload the documents below and we will review them again.';
  } else if (stage === 'under_review') {
    step = 3;
    headline = 'You are in the queue.';
    lead = 'An admin is checking your documents. You will hear from us within 24–48 hours.';
  } else if (stage === 'approved') {
    step = 3;
    headline = 'You are verified. Time to ride.';
    lead = 'Sign in, go online and take your first job.';
  } else if (stage === 'suspended') {
    step = 3;
    headline = 'Your account is on hold.';
    lead = 'Documents cannot be changed right now.';
  }

  return (
    <RiderShell
      step={step}
      allDone={stage === 'approved'}
      headline={headline}
      lead={lead}
      backHref={isFinal ? HOME_PATH : SIGNUP_PATH}
      backLabel={isFinal ? 'Home' : 'Back'}
    >
      <style>{verifyCss}</style>

      {!ready && (
        <section className="rn-sheet" aria-busy="true">
          <p className="rn-sheet-sub" style={{ margin: 0 }}>Loading…</p>
        </section>
      )}

      {ready && isFinal && (
        <StatusPanel
          stage={stage as Exclude<Stage, 'not_started' | 'rejected'>}
          onHome={() => router.push(HOME_PATH)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {ready && !isFinal && (
        <form onSubmit={handleSubmit} className="rn-sheet">
          <h2>{isResend ? 'Send new documents' : 'Verify your identity'}</h2>
          <p className="rn-sheet-sub">
            {isResend
              ? 'We need a clearer photo of the documents below.'
              : 'Step 2 of 3. Take a clear photo or upload a file for each document.'}
          </p>

          {isResend && (
            <div className="rn-error" role="alert">
              <span>Update needed: {reason || 'Please re-upload the documents below.'}</span>
            </div>
          )}

          <div
            className="rv-progress"
            role="progressbar"
            aria-label="Documents added"
            aria-valuemin={0}
            aria-valuemax={editableDocs.length}
            aria-valuenow={addedCount}
          >
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

          <p className="rv-note">
            Your documents are stored securely and used only for verification. JPG, PNG, WEBP or PDF, up to {MAX_SIZE_MB} MB each.
          </p>

          <div className="rv-bar">
            <ErrorNote message={error} />
            <button
              type="submit"
              disabled={isSubmitting || editableDocs.length === 0 || addedCount < editableDocs.length}
              className="rn-submit"
            >
              {isSubmitting ? 'Sending documents…' : isResend ? 'Send new documents' : 'Submit for review'}
            </button>
          </div>
        </form>
      )}
    </RiderShell>
  );
}

/* ───────────── Styles (verify-only; shared styles live in RiderShell) ───────────── */

const verifyCss = `
.rv-progress{height:8px;border-radius:4px;background:var(--field);overflow:hidden}
.rv-progress div{height:100%;border-radius:4px;background:var(--orange);transition:width .25s}
.rv-count{margin:8px 0 18px;font-size:13px;font-weight:700;color:var(--muted)}
.rv-card{margin-bottom:14px;padding:16px;border:2px solid var(--line);border-radius:16px;background:var(--card);transition:border-color .15s}
.rv-card.has-file{border-color:var(--navy)}
.rv-card.failed{border-color:var(--err)}
@media(prefers-color-scheme:dark){.rv-card.has-file{border-color:var(--orange)}}
.rv-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
.rv-card-tx{min-width:0}
.rv-label{font-weight:800;font-size:16px;line-height:1.3}
.rv-desc{color:var(--muted);font-size:13px;margin-top:2px}
.rv-badge{flex:none;padding:5px 10px;border-radius:999px;background:var(--field);color:var(--muted);font-size:12px;font-weight:800;white-space:nowrap}
.rv-badge.ready{background:var(--navy);color:#fff}
.rv-badge.ok{background:var(--ok);color:#fff}
.rv-badge.busy{background:var(--orange);color:var(--navy)}
.rv-badge.err{background:var(--err);color:#fff}
@media(prefers-color-scheme:dark){.rv-badge.ok,.rv-badge.err{color:#0A1224}}
.rv-drop{width:100%;min-height:60px;border:2px dashed var(--navy);border-radius:14px;background:transparent;color:var(--ink);font:inherit;font-weight:800;font-size:15px;cursor:pointer}
@media(prefers-color-scheme:dark){.rv-drop{border-color:var(--orange)}}
.rv-drop:disabled{opacity:.5;cursor:not-allowed}
.rv-plus{display:inline-grid;place-items:center;width:26px;height:26px;margin-right:8px;border-radius:50%;background:var(--orange);color:var(--navy);font-size:20px;line-height:1;vertical-align:middle}
.rv-file{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.rv-thumb{flex:none;width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--field)}
.rv-pdf{display:grid;place-items:center;font-weight:800;font-size:14px;color:var(--ink)}
.rv-fileinfo{flex:1;min-width:0}
.rv-filename{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;font-size:14px}
.rv-filesize{color:var(--muted);font-size:12px}
.rv-actions{display:flex;gap:8px;width:100%}
.rv-actions button{flex:1;min-height:46px;padding:10px;border:2px solid var(--line);border-radius:12px;background:transparent;color:var(--ink);font:inherit;font-weight:700;font-size:14px;cursor:pointer}
.rv-actions button.rm{color:var(--err)}
.rv-actions button:disabled{opacity:.5;cursor:not-allowed}
.rv-note{margin:10px 0 0;color:var(--muted);font-size:12.5px}
.rv-bar{position:sticky;bottom:0;z-index:5;margin:18px calc(var(--pad-x) * -1) calc(var(--pad-y) * -1);padding:14px var(--pad-x) calc(14px + env(safe-area-inset-bottom));background:var(--card);border-top:1px solid var(--line);border-radius:0 0 22px 22px}
.rv-bar .rn-error{margin-bottom:10px}
.rv-status{text-align:center}
.rv-status .rn-submit{margin-top:20px}
.rv-badge-lg{width:76px;height:76px;margin:4px auto 16px;border-radius:50%;display:grid;place-items:center;background:var(--orange);color:var(--navy);font-size:38px;font-weight:800}
.rv-badge-lg.bad{background:var(--err);color:#fff}
.rv-steps{margin:20px 0 0;padding:16px 16px 16px 36px;border:2px solid var(--line);border-radius:16px;text-align:left;font-size:14px;color:var(--muted)}
.rv-steps li+li{margin-top:10px}
.rv-steps b{color:var(--ink)}
.rv-lock{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:var(--field);font-size:13px;font-weight:700;color:var(--muted)}
`;

