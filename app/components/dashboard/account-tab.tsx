'use client';

// components/dashboard/AccountTab.tsx
// Profile, phone verification (OTP), saved places and menu.
// Name is read-only: only an admin can change it, and the server must also reject full_name edits.
// The phone is only saved locally AFTER the server confirmed the code.

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Place } from '@/lib/rydnow/config';
import { authFetch, messageFrom } from '@/lib/rydnow/session';
import { SAVED_PLACE_META, type SavedPlaceId, type SavedPlaces, type UserProfile } from './hooks';
import PlaceField from './PlaceField';
import { Icon, inputCls, type ToastType } from './ui';

const OTP_LENGTH = 6;
const OTP_RESEND_SECONDS = 45;
const SUPPORT_PATH = '/help-support';
const OTP_SEND_PATH = 'auth/phone/send-otp/'; // ASSUMED: match your Django urls
const OTP_VERIFY_PATH = 'auth/phone/verify-otp/'; // ASSUMED: match your Django urls

type PhoneStep = 'idle' | 'enter' | 'code';

const normalizePhone = (raw: string): string => {
  const c = (raw || '').trim().replace(/[\s\-()]/g, '');
  let out = c;
  if (/^0\d{9}$/.test(c)) out = `+233${c.slice(1)}`;
  else if (/^233\d{9}$/.test(c)) out = `+${c}`;
  return /^\+\d{9,15}$/.test(out) ? out : '';
};

const resizeImage = (file: File, max = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

interface Props {
  profile: UserProfile;
  onProfileUpdate: (patch: Partial<UserProfile>) => boolean;
  saved: SavedPlaces;
  onSavePlace: (id: SavedPlaceId, place: Place | null) => void;
  editing: SavedPlaceId | null;
  onEditing: (id: SavedPlaceId | null) => void;
  notify: (message: string, type?: ToastType) => void;
  onInvite: () => void;
  onLogout: () => void;
  onUnauthorized: () => void;
}

export default function AccountTab({
  profile,
  onProfileUpdate,
  saved,
  onSavePlace,
  editing,
  onEditing,
  notify,
  onInvite,
  onLogout,
  onUnauthorized,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<PhoneStep>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const resetFlow = useCallback(() => {
    setStep('idle');
    setNewPhone('');
    setPendingPhone('');
    setCode('');
    setError('');
    setSending(false);
    setVerifying(false);
    setResendIn(0);
  }, []);

  const sendOtp = useCallback(
    async (phone: string): Promise<boolean> => {
      setSending(true);
      setError('');
      const res = await authFetch(OTP_SEND_PATH, { method: 'POST', body: { phone } });
      setSending(false);
      if (res.status === 401) {
        onUnauthorized();
        return false;
      }
      if (res.ok) {
        setPendingPhone(phone);
        setCode('');
        setResendIn(OTP_RESEND_SECONDS);
        setStep('code');
        return true;
      }
      setError(
        res.status === 0
          ? 'Connection error. Check your internet and try again.'
          : messageFrom(res.data) ||
              (res.status === 429
                ? 'Too many attempts. Please wait a few minutes and try again.'
                : 'We couldn’t send the code. Check the number and try again.'),
      );
      return false;
    },
    [onUnauthorized],
  );

  const handleSend = async () => {
    const phone = normalizePhone(newPhone);
    if (!phone) return setError('Enter a valid phone number, for example 055 123 4567.');
    if (profile.phoneVerified && phone === normalizePhone(profile.phone)) {
      return setError('This number is already verified on your account.');
    }
    await sendOtp(phone);
  };

  const verifyExisting = async () => {
    const phone = normalizePhone(profile.phone);
    if (!phone) {
      setStep('enter');
      setNewPhone('');
      setError('The number on your account looks invalid. Enter it again.');
      return;
    }
    if (!(await sendOtp(phone))) setStep('idle');
  };

  const handleVerify = async () => {
    if (verifying) return;
    if (code.length !== OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code we sent you.`);
    setVerifying(true);
    setError('');
    const res = await authFetch(OTP_VERIFY_PATH, { method: 'POST', body: { phone: pendingPhone, code } });
    setVerifying(false);
    if (res.status === 401) return onUnauthorized();
    if (res.ok) {
      const d = (res.data ?? {}) as Record<string, unknown>;
      onProfileUpdate({ phone: typeof d.phone === 'string' ? d.phone : pendingPhone, phoneVerified: true });
      notify('Phone number verified', 'success');
      resetFlow();
      return;
    }
    setError(
      res.status === 0
        ? 'Connection error. Check your internet and try again.'
        : messageFrom(res.data) ||
            (res.status === 429
              ? 'Too many attempts. Please wait a few minutes and try again.'
              : 'That code isn’t right or has expired. Try again or request a new one.'),
    );
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const photoUrl = await resizeImage(file);
      if (onProfileUpdate({ photoUrl })) notify('Photo updated', 'success');
      else notify('Could not save. Your device storage may be full.', 'error');
    } catch {
      notify('Could not use that photo. Try a different image.', 'error');
    }
  };

  const hasPhone = !!profile.phone;
  const spinnerBtn = (busy: boolean) =>
    busy && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;

  const menu: { label: string; icon: string; href?: string; onClick?: () => void }[] = [
    { label: 'Invite friends', icon: 'gift', onClick: onInvite },
    { label: 'Payment methods', icon: 'card', href: '/payment-methods' },
    { label: 'Help & support', icon: 'help', href: SUPPORT_PATH },
    { label: 'Settings', icon: 'settings', href: '/settings' },
  ];

  return (
    <div className="px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h2 className="mb-4 text-xl font-bold text-gray-900">My account</h2>

      <section className="mb-4 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="relative shrink-0">
          {profile.photoUrl ? (
            <Image src={profile.photoUrl} alt="Profile" width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E3FCE] text-white">
              <Icon name="user" className="h-7 w-7" />
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1E3FCE] text-white"
          >
            <Icon name="camera" className="h-3.5 w-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-bold text-gray-900">{profile.fullName || 'Customer'}</h3>
          <p className="truncate text-sm text-gray-500">{profile.email || 'Not set'}</p>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold text-gray-500">Personal details</h3>
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
          <p className="text-xs text-gray-600">
            Your name is locked to keep accounts secure. To change it,{' '}
            <button onClick={() => router.push(SUPPORT_PATH)} className="font-semibold text-[#1E3FCE] underline">
              contact support
            </button>
            .
          </p>
        </div>

        <p className="text-xs text-gray-400">Phone number</p>

        {step === 'idle' && (
          <>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{profile.phone || 'No phone number added yet'}</p>
                {hasPhone && (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      profile.phoneVerified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {profile.phoneVerified && <Icon name="check" className="h-3 w-3" />}
                    {profile.phoneVerified ? 'Verified' : 'Not verified'}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {hasPhone && !profile.phoneVerified && (
                  <button onClick={verifyExisting} disabled={sending} className="py-2 text-sm font-semibold text-[#1E3FCE] disabled:opacity-50">
                    {sending ? 'Sending…' : 'Verify'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setNewPhone('');
                    setError('');
                    setStep('enter');
                  }}
                  className="py-2 text-sm font-semibold text-[#1E3FCE]"
                >
                  {hasPhone ? 'Change' : 'Add'}
                </button>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
          </>
        )}

        {step === 'enter' && (
          <div className="mt-1 space-y-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Phone number"
              placeholder="e.g. 055 123 4567"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className={inputCls}
            />
            <p className="text-xs text-gray-500">We’ll text you a {OTP_LENGTH}-digit code to confirm this number.</p>
            {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button onClick={resetFlow} disabled={sending} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !newPhone.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E3FCE] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {spinnerBtn(sending)}
                Send code
              </button>
            </div>
          </div>
        )}

        {step === 'code' && (
          <div className="mt-1 space-y-2">
            <p className="text-sm text-gray-700">
              Enter the code we sent to <span className="font-semibold">{pendingPhone || profile.phone}</span>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              aria-label="Verification code"
              placeholder={'•'.repeat(OTP_LENGTH)}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              className={`${inputCls} text-center text-xl font-bold tracking-[0.5em]`}
            />
            {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button onClick={() => setStep('enter')} disabled={verifying} className="py-2 font-semibold text-gray-500">
                Use a different number
              </button>
              <button
                onClick={() => sendOtp(pendingPhone)}
                disabled={resendIn > 0 || sending || verifying}
                className="py-2 font-semibold text-[#1E3FCE] disabled:text-gray-400"
              >
                {sending ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={resetFlow} disabled={verifying} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={verifying || code.length !== OTP_LENGTH}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E3FCE] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {spinnerBtn(verifying)}
                Verify
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold text-gray-500">Saved places</h3>
        <div className="space-y-3">
          {SAVED_PLACE_META.map((meta) => {
            const place = saved[meta.id];
            const isEditing = editing === meta.id;
            return (
              <div key={meta.id}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{meta.name}</p>
                    <p className="truncate text-xs text-gray-500">{place ? place.address : 'Not set'}</p>
                  </div>
                  <button onClick={() => onEditing(isEditing ? null : meta.id)} className="py-2 text-sm font-semibold text-[#1E3FCE]">
                    {isEditing ? 'Close' : place ? 'Edit' : 'Add'}
                  </button>
                </div>
                {isEditing && (
                  <div className="ml-12 mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
                    <PlaceField
                      label={`${meta.name} address`}
                      placeholder={`Search for your ${meta.name.toLowerCase()} address`}
                      value={null}
                      onChange={(p) => {
                        if (!p) return;
                        onSavePlace(meta.id, p);
                        onEditing(null);
                        notify(`${meta.name} saved`, 'success');
                      }}
                    />
                  </div>
                )}
                {place && !isEditing && (
                  <button onClick={() => onSavePlace(meta.id, null)} className="ml-12 mt-1 py-1 text-xs text-gray-400">
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 divide-y divide-gray-50 rounded-2xl border border-gray-100 bg-white">
        {menu.map((item) => (
          <button
            key={item.label}
            onClick={() => (item.onClick ? item.onClick() : item.href && router.push(item.href))}
            className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-gray-50"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                item.icon === 'gift' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-[#1E3FCE]'
              }`}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1 text-sm font-semibold text-gray-900">{item.label}</span>
            <Icon name="chevron" className="h-4 w-4 text-gray-400" />
          </button>
        ))}
      </section>

      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600"
      >
        <Icon name="logout" className="h-[18px] w-[18px]" />
        Log out
      </button>
    </div>
  );
}
