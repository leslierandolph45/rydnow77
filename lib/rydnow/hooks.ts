'use client';


/**
 * Small client-side hooks for the customer dashboard.
 * Profile and saved places are kept in localStorage (namespaced "rydnow_") via lib/rydnow/session.
 */


import { useCallback, useEffect, useState } from 'react';
import type { Place } from '@/lib/rydnow/config';
import { readJSON, writeJSON } from '@/lib/rydnow/session';


// ─── Saved places ───
export type SavedPlaceId = 'home' | 'work';


export const SAVED_PLACE_META: readonly { id: SavedPlaceId; name: string; icon: string }[] = [
  { id: 'home', name: 'Home', icon: '🏠' },
  { id: 'work', name: 'Work', icon: '💼' },
];


const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);


const isPlace = (v: unknown): v is Place =>
  isObject(v) && typeof v.address === 'string' && typeof v.lat === 'number' && typeof v.lng === 'number';


const MAX_RECENT = 5;


type SavedMap = Record<SavedPlaceId, Place | null>;
const EMPTY_SAVED: SavedMap = { home: null, work: null };


export function usePlaces() {
  const [saved, setSaved] = useState<SavedMap>(EMPTY_SAVED);
  const [recent, setRecent] = useState<Place[]>([]);


  // Read after mount so server and client render the same first frame.
  useEffect(() => {
    const s = readJSON<Record<string, unknown>>('saved_places', isObject);
    setSaved({
      home: s && isPlace(s.home) ? s.home : null,
      work: s && isPlace(s.work) ? s.work : null,
    });
    const r = readJSON<unknown[]>('recent_places', isArray);
    setRecent((r ?? []).filter(isPlace).slice(0, MAX_RECENT));
  }, []);


  /** Save (or clear, with null) one of the named places. */
  const saveOne = useCallback((id: SavedPlaceId, place: Place | null) => {
    setSaved((prev) => {
      const next = { ...prev, [id]: place };
      writeJSON('saved_places', next);
      return next;
    });
  }, []);


  /** Remember a destination for the "Recent places" list (newest first, no duplicates). */
  const remember = useCallback((place: Place) => {
    setRecent((prev) => {
      const next = [place, ...prev.filter((p) => !(p.lat === place.lat && p.lng === place.lng))].slice(0, MAX_RECENT);
      writeJSON('recent_places', next);
      return next;
    });
  }, []);


  return { saved, recent, saveOne, remember };
}


// ─── Profile ───
export interface Profile {
  fullName: string;
  phone: string;
  email: string;
  photoUrl: string;
}


const EMPTY_PROFILE: Profile = { fullName: '', phone: '', email: '', photoUrl: '' };


/** The login page stores the user object as plain JSON under "currentUser". */
function storedUser(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem('currentUser');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}


const str = (v: unknown) => (typeof v === 'string' ? v : '');


export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);


  useEffect(() => {
    const u = storedUser();
    const saved = readJSON<Record<string, unknown>>('profile', isObject) ?? {};
    setProfile({
      fullName: str(saved.fullName) || str(u.full_name) || str(u.name) || str(u.username),
      phone: str(saved.phone) || str(u.phone) || str(u.phone_number),
      email: str(saved.email) || str(u.email),
      photoUrl: str(saved.photoUrl),
    });
  }, []);


  const update = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      writeJSON('profile', next);
      return next;
    });
  }, []);


  return { profile, update };
}


// ─── Countdown ───
/** Whole seconds left until `expiresAtMs`. Ticks once a second; 0 when there is no deadline. */
export function useCountdown(expiresAtMs?: number): number {
  const compute = useCallback(() => (expiresAtMs ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)) : 0), [expiresAtMs]);
  const [left, setLeft] = useState(compute);


  useEffect(() => {
    setLeft(compute());
    if (!expiresAtMs) return;
    const id = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(id);
  }, [expiresAtMs, compute]);


  return left;
}


// ─── Scroll lock ───
/** The dashboard is a fixed-height app shell, so the page behind it must not scroll. */
export function useLockPageScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
    };
  }, []);
}


