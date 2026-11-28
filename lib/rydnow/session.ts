// lib/rydnow/session.ts


/**
 * Typed, SSR-safe wrapper around localStorage for Rydnow session data.
 *
 * - Never throws: storage can be missing (SSR), blocked (private mode,
 *   cookie settings) or full (quota), so every call fails soft.
 * - All keys are namespaced with STORAGE_PREFIX so clearSession() only
 *   removes Rydnow data.
 * - The auth token is stored as a plain string under "rydnow_token" so the
 *   login page and both dashboards read the same value. localStorage is
 *   readable by any script on the page, so move to an httpOnly cookie
 *   before production.
 */


const STORAGE_PREFIX = 'rydnow_';
const TOKEN_KEY = 'token'; // stored as "rydnow_token"
const LEGACY_KEYS = ['authtoken', 'currentUser']; // older keys the login page also writes


type Validator<T> = (value: unknown) => value is T;


const prefixed = (key: string): string => `${STORAGE_PREFIX}${key}`;


/** Returns localStorage, or null when unavailable (SSR or access blocked). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Accessing localStorage can throw a SecurityError when blocked.
    return null;
  }
}


/** Reads and parses a stored JSON value. Returns null if missing or corrupt. */
export function readJSON<T>(key: string, validate?: Validator<T>): T | null {
  const storage = getStorage();
  if (!storage) return null;


  try {
    const raw = storage.getItem(prefixed(key));
    if (raw === null) return null;


    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      storage.removeItem(prefixed(key));
      return null;
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      try {
        storage.removeItem(prefixed(key));
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}


/** Serialises and stores a value. Returns true on success. */
export function writeJSON<T>(key: string, value: T): boolean {
  const storage = getStorage();
  if (!storage) return false;


  try {
    const serialised = JSON.stringify(value);
    if (serialised === undefined) return false;
    storage.setItem(prefixed(key), serialised);
    return true;
  } catch {
    return false;
  }
}


/** Reads a plain (non-JSON) string value. */
export function readString(key: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(prefixed(key));
  } catch {
    return null;
  }
}


/** Stores a plain (non-JSON) string value. Returns true on success. */
export function writeString(key: string, value: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(prefixed(key), value);
    return true;
  } catch {
    return false;
  }
}


/** Removes a single Rydnow key. */
export function removeItem(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(prefixed(key));
  } catch {
    /* ignore */
  }
}


// ─── AUTH TOKEN ──────────────────────────────────────────────────


/** Returns the saved auth token, or null if signed out / storage unavailable. */
export function getAuthToken(): string | null {
  const token = readString(TOKEN_KEY);
  return token && token.trim() ? token : null;
}


/** Saves the auth token (also writes the legacy "authtoken" key). */
export function setAuthToken(token: string): boolean {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem('authtoken', token);
    } catch {
      /* ignore */
    }
  }
  return writeString(TOKEN_KEY, token);
}


/** Removes the auth token and the legacy keys. */
export function clearAuthToken(): void {
  removeItem(TOKEN_KEY);
  const storage = getStorage();
  if (!storage) return;
  try {
    LEGACY_KEYS.forEach((k) => storage.removeItem(k));
  } catch {
    /* ignore */
  }
}


/** Removes every Rydnow key, leaving other apps' data on the origin alone. */
export function clearSession(): void {
  const storage = getStorage();
  if (!storage) return;


  try {
    // Collect first: removing while iterating by index would skip entries.
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
    LEGACY_KEYS.forEach((k) => storage.removeItem(k));
  } catch {
    /* ignore */
  }
}


/**
 * Calls `callback` when another tab changes or clears a Rydnow key, which is
 * useful for logging out in every tab at once. `key` is the unprefixed key,
 * or null when storage was cleared. Returns an unsubscribe function.
 */
export function subscribe(callback: (key: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;


  const handler = (event: StorageEvent) => {
    if (event.key === null) {
      callback(null);
    } else if (event.key.startsWith(STORAGE_PREFIX)) {
      callback(event.key.slice(STORAGE_PREFIX.length));
    }
  };


  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}


