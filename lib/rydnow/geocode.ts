// lib/rydnow/geocode.ts
// Address search + "use my location". Uses OpenStreetMap Nominatim (free, fine for launch traffic).
// For production volume swap the two fetches below for Google Places or Mapbox; nothing else changes.

import type { Place } from "./config";

const NOMINATIM = "https://nominatim.openstreetmap.org";

interface NominatimHit {
  display_name?: string;
  lat?: string;
  lon?: string;
}

function shorten(name: string): string {
  return name.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 3).join(", ");
}

function toPlace(hit: NominatimHit): Place | null {
  const lat = parseFloat(hit.lat ?? "");
  const lng = parseFloat(hit.lon ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !hit.display_name) return null;
  return { address: shorten(hit.display_name), lat, lng };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const qs = new URLSearchParams({
    format: "jsonv2",
    countrycodes: "gh",
    limit: "5",
    "accept-language": "en",
    q: query,
  });
  const res = await fetch(`${NOMINATIM}/search?${qs}`, { signal });
  if (!res.ok) throw new Error("search failed");
  const hits = (await res.json()) as NominatimHit[];
  return hits.map(toPlace).filter((p): p is Place => p !== null);
}

export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<Place> {
  try {
    const qs = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      "accept-language": "en",
    });
    const res = await fetch(`${NOMINATIM}/reverse?${qs}`, { signal });
    if (res.ok) {
      const hit = (await res.json()) as NominatimHit;
      if (hit.display_name) return { address: shorten(hit.display_name), lat, lng };
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
  }
  return { address: "My current location", lat, lng };
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

