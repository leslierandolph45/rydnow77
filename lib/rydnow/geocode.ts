/**
 * RYDNOW geocoding: lib/rydnow/geocode.ts
 *
 *  - currentPosition()  GPS location of the customer's phone
 *  - reversePlace()     turns GPS coordinates into a readable address riders can recognise
 *  - searchPlaces()     address / landmark suggestions while the customer types
 *
 * Uses Photon (OpenStreetMap data), which is free, needs no API key and is built for
 * search-as-you-type. Results are limited to Ghana and biased toward the customer's area.
 *
 * To switch to Google Places or Mapbox later, only the two fetch calls in this file change.
 * Every other file keeps using the same three functions.
 */


import type { Place } from '@/lib/rydnow/config';


// ─── Settings ───
const PHOTON = 'https://photon.komoot.io';
const GHANA_BBOX = '-3.3,4.7,1.3,11.2'; // minLon,minLat,maxLon,maxLat
const ACCRA = { lat: 5.6037, lng: -0.187 };
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 6;
const CACHE_LIMIT = 60;


// ─── Types ───
export interface DevicePosition {
  lat: number;
  lng: number;
  /** Accuracy radius in metres, as reported by the device. */
  accuracy: number;
}


export interface SearchOptions {
  signal?: AbortSignal;
  /** Bias results toward this point. Defaults to the customer's last GPS fix, then Accra. */
  near?: { lat: number; lng: number };
}


interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  state?: string;
  countrycode?: string;
}


interface PhotonFeature {
  properties?: PhotonProps;
  geometry?: { coordinates?: [number, number] };
}


interface PhotonResponse {
  features?: PhotonFeature[];
}


// ─── Internal state ───
let lastKnown: { lat: number; lng: number } | null = null;
const cache = new Map<string, Place[]>();


// ─── Helpers ───


/** fetch + JSON with a timeout. A timeout throws a normal Error, so it is never mistaken for a cancelled search. */
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();


  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }


  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Location service responded with ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (timedOut) throw new Error('Location search timed out');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}


/**
 * Builds the address a rider will read: "Name, street, area, city".
 * Landmarks and area names come first because that is how people in Accra describe where they are.
 */
function formatAddress(p: PhotonProps): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const area = p.district || p.locality;
  const parts = [p.name, street, area, p.city || p.county || p.state];


  const seen = new Set<string>();
  const clean: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
  }
  return clean.slice(0, 4).join(', ');
}


function toPlace(f: PhotonFeature): Place | null {
  const coords = f.geometry?.coordinates;
  const props = f.properties;
  if (!coords || !props) return null;
  if (props.countrycode && props.countrycode.toUpperCase() !== 'GH') return null;


  const [lng, lat] = coords;
  const address = formatAddress(props);
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { address, lat, lng };
}


const normalise = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');


// ─── Public API ───


/**
 * The customer's current GPS position.
 * Rejects with the browser's GeolocationPositionError, so `error.code === 1` means "permission denied".
 * Needs HTTPS (or localhost).
 */
export function currentPosition(): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 0, message: 'Location is not supported on this device' });
      return;
    }


    const done = (pos: GeolocationPosition) => {
      lastKnown = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    };


    // First try GPS. If that is slow or unavailable indoors, fall back to network location.
    navigator.geolocation.getCurrentPosition(
      done,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return reject(err);
        navigator.geolocation.getCurrentPosition(done, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 60_000,
        });
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 15_000 },
    );
  });
}


/**
 * Coordinates -> Place. The returned lat/lng are the customer's exact pin (not the nearest map feature),
 * so the rider is sent to where the customer really is. If the address lookup fails the booking still works.
 */
export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<Place> {
  try {
    const data = await getJson<PhotonResponse>(`${PHOTON}/reverse?lon=${lng}&lat=${lat}&lang=en&limit=1`, signal);
    const feature = data.features?.[0];
    const address = feature?.properties ? formatAddress(feature.properties) : '';
    if (address) return { address, lat, lng };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
  }
  return { address: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng };
}


/**
 * Address and landmark suggestions for what the customer is typing.
 * Returns [] for very short queries. Pass an AbortSignal so old searches are cancelled as the customer types.
 */
export async function searchPlaces(query: string, options: SearchOptions = {}): Promise<Place[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];


  const near = options.near ?? lastKnown ?? ACCRA;
  const key = `${normalise(q)}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;


  const url =
    `${PHOTON}/api/?q=${encodeURIComponent(q)}` +
    `&lat=${near.lat}&lon=${near.lng}` +
    `&bbox=${GHANA_BBOX}&lang=en&limit=${MAX_SUGGESTIONS + 4}`;


  const data = await getJson<PhotonResponse>(url, options.signal);


  const seen = new Set<string>();
  const places: Place[] = [];
  for (const feature of data.features ?? []) {
    const place = toPlace(feature);
    if (!place) continue;
    const dedupe = place.address.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    places.push(place);
    if (places.length >= MAX_SUGGESTIONS) break;
  }


  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, places);
  return places;
}


