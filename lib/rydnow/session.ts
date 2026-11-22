// lib/rydnow/session.ts
// Small helpers shared by the customer dashboard: session clearing, safe localStorage,
// and a fetch wrapper for non-booking endpoints (profile, phone verification).
// Everything goes through the same Next.js proxy as lib/rydnow/api.ts.

import { getToken } from "./api";

const BASE = process.env.NEXT_PUBLIC_RYDNOW_API_BASE ?? "/api/rydnow";
const AUTH_SCHEME = process.env.NEXT_PUBLIC_RYDNOW_AUTH_SCHEME ?? "Token";
const TOKEN_KEY = process.env.NEXT_PUBLIC_RYDNOW_TOKEN_KEY ?? "rydnow_token";

export function clearSession(): void {
  try {
    for (const key of [TOKEN_KEY, "rydnow_username", "authToken", "currentUser", "rydnow_profile"]) {
      localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export interface AuthResponse {
  ok: boolean;
  status: number; // 0 = network failure
  data: unknown;
}

export async function authFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<AuthResponse> {
  try {
    const token = getToken();
    const res = await fetch(`${BASE}/${path}`, {
      method: init.method ?? "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `${AUTH_SCHEME} ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** Pulls a human message out of a DRF-style error body. */
export function messageFrom(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  if (typeof o.detail === "string") return o.detail;
  if (typeof o.message === "string") return o.message;
  if (Array.isArray(o.phone) && o.phone.length) return String(o.phone[0]);
  return "";
}
