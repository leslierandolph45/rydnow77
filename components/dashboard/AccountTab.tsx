'use client';


import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Place } from '@/lib/rydnow/config';
import { SAVED_PLACE_META, type Profile, type SavedPlaceId } from '@/lib/rydnow/hooks';
import PlaceField from '@/components/PlaceField';
import { Icon, inputCls, type ToastType } from '@/components/dashboard/ui';


const SUPPORT = {
  phoneLabel: '+233 59 411 6155',
  phoneHref: 'tel:+233594116155',
  whatsappHref: 'https://wa.me/233594116155',
  email: 'support@rydnow.app',
} as const;


interface AccountTabProps {
  profile: Profile;
  onProfileUpdate: (patch: Partial<Profile>) => void;
  saved: Record<SavedPlaceId, Place | null>;
  onSavePlace: (id: SavedPlaceId, place: Place | null) => void;
  editing: SavedPlaceId | null;
  onEditing: (id: SavedPlaceId | null) => void;
  notify: (message: string, type?: ToastType) => void;
  onInvite: () => void;
  onLogout: () => void;
  /** Reserved for when profile changes are synced to the backend. */
  onUnauthorized?: () => void;
}


const isGhPhone = (v: string) => /^(\+233|233|0)\d{9}$/.test(v.replace(/[\s\-()]/g, ''));
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);


/** Shrinks a chosen photo to a small square JPEG so it fits comfortably in localStorage. */
function resizeImage(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}


function Row({ icon, label, hint, onClick, href, danger }: { icon: ReactNode; label: string; hint?: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${danger ? 'text-red-600' : 'text-gray-900'}`;
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
      </span>
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-gray-300" />
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}


export default function AccountTab({ profile, onProfileUpdate, saved, onSavePlace, editing, onEditing, notify, onInvite, onLogout }: AccountTabProps) {
  const [draft, setDraft] = useState({ fullName: profile.fullName, phone: profile.phone, email: profile.email });
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; email?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);


  // Follow the stored profile when it loads or changes elsewhere.
  useEffect(() => {
    setDraft({ fullName: profile.fullName, phone: profile.phone, email: profile.email });
  }, [profile.fullName, profile.phone, profile.email]);


  const dirty = draft.fullName !== profile.fullName || draft.phone !== profile.phone || draft.email !== profile.email;


  const saveProfile = () => {
    const next: typeof errors = {};
    if (!draft.fullName.trim()) next.fullName = 'Enter your name.';
    if (draft.phone.trim() && !isGhPhone(draft.phone)) next.phone = 'Enter a valid Ghana phone number.';
    if (draft.email.trim() && !isEmail(draft.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onProfileUpdate({ fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim() });
    notify('Profile saved', 'success');
  };


  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Please choose an image file', 'error');
    try {
      onProfileUpdate({ photoUrl: await resizeImage(file) });
      notify('Photo updated', 'success');
    } catch {
      notify('We couldn’t use that photo. Try another one.', 'error');
    }
  };


  const initials = profile.fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'R';


  return (
    <div className="space-y-5 px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-extrabold text-gray-900">Account</h1>


      {/* Profile header */}
      <section className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Profile">
        <div className="relative shrink-0">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1E3FCE] text-2xl font-extrabold text-white">
            {profile.photoUrl ? <Image src={profile.photoUrl} alt="Your photo" width={80} height={80} unoptimized className="h-20 w-20 object-cover" /> : initials}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Change photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#F5B82E] text-gray-900 shadow"
          >
            <Icon name="camera" className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold text-gray-900">{profile.fullName || 'Your name'}</p>
          <p className="truncate text-sm text-gray-500">{profile.phone || profile.email || 'Add your contact details'}</p>
          {profile.photoUrl && (
            <button type="button" onClick={() => onProfileUpdate({ photoUrl: '' })} className="mt-1 py-1 text-xs font-bold text-gray-500 underline">
              Remove photo
            </button>
          )}
        </div>
      </section>


      {/* Edit details */}
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Your details">
        <h2 className="text-sm font-extrabold text-gray-900">Your details</h2>
        {(
          [
            { key: 'fullName', label: 'Full name', type: 'text', mode: 'text', auto: 'name' },
            { key: 'phone', label: 'Phone number', type: 'tel', mode: 'tel', auto: 'tel' },
            { key: 'email', label: 'Email (optional)', type: 'email', mode: 'email', auto: 'email' },
          ] as const
        ).map((f) => (
          <div key={f.key}>
            <label htmlFor={`acc-${f.key}`} className="text-xs font-semibold text-gray-700">
              {f.label}
            </label>
            <input
              id={`acc-${f.key}`}
              type={f.type}
              inputMode={f.mode}
              autoComplete={f.auto}
              className={`${inputCls} mt-1`}
              value={draft[f.key]}
              aria-invalid={!!errors[f.key]}
              onChange={(e) => {
                setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                setErrors((er) => ({ ...er, [f.key]: undefined }));
              }}
            />
            {errors[f.key] && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={saveProfile}
          disabled={!dirty}
          className="w-full rounded-xl bg-[#1E3FCE] py-3.5 text-sm font-extrabold text-white disabled:bg-gray-200 disabled:text-gray-500"
        >
          Save changes
        </button>
      </section>


      {/* Saved places */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Saved places">
        <h2 className="mb-1 text-sm font-extrabold text-gray-900">Saved places</h2>
        <p className="mb-3 text-xs text-gray-500">Book faster with one tap from the home screen.</p>
        <div className="divide-y divide-gray-100">
          {SAVED_PLACE_META.map((meta) => {
            const place = saved[meta.id];
            const open = editing === meta.id;
            return (
              <div key={meta.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{meta.name}</p>
                    <p className="truncate text-xs text-gray-500">{place ? place.address : 'Not set'}</p>
                  </div>
                  <button type="button" onClick={() => onEditing(open ? null : meta.id)} className="py-2 pl-2 text-xs font-bold text-[#1E3FCE]">
                    {open ? 'Done' : place ? 'Change' : 'Add'}
                  </button>
                  {place && !open && (
                    <button
                      type="button"
                      onClick={() => {
                        onSavePlace(meta.id, null);
                        notify(`${meta.name} removed`, 'info');
                      }}
                      className="py-2 pl-1 text-xs font-bold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {open && (
                  <div className="mt-2 rounded-xl border border-gray-200 px-3 pb-1">
                    <PlaceField
                      label={`${meta.name} address`}
                      placeholder={`Search for your ${meta.name.toLowerCase()} address`}
                      value={place}
                      onChange={(p) => {
                        if (!p) return;
                        onSavePlace(meta.id, p);
                        onEditing(null);
                        notify(`${meta.name} saved`, 'success');
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>


      {/* Menu */}
      <section className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-label="More">
        <Row icon="🎁" label="Invite friends" hint="Share your code and you both save" onClick={onInvite} />
        <Row icon="☎️" label="Call support" hint={SUPPORT.phoneLabel} href={SUPPORT.phoneHref} />
        <Row icon="💬" label="Chat on WhatsApp" hint="Fast help with a booking or payment" href={SUPPORT.whatsappHref} />
        <Row icon="✉️" label="Email us" hint={SUPPORT.email} href={`mailto:${SUPPORT.email}`} />
        <Row icon={<Icon name="logout" className="h-4 w-4" />} label="Log out" onClick={onLogout} danger />
      </section>
    </div>
  );
}


