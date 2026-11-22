'use client';

// components/dashboard/RiderMap.tsx
// Leaflet + OpenStreetMap. Public OSM tiles / OSRM are for light use: move to a paid provider before scale.

import 'leaflet/dist/leaflet.css';
import type { Map as LMap, Marker, Polyline } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';

type Leaflet = typeof import('leaflet');

export type LatLng = { lat: number; lng: number };
export type MapRider = LatLng & { id: string };

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const key = (p?: LatLng | null) => (p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : '');

// ---- driving route line (drawing only, the price never depends on it) -------------------
export function useRouteLine(points: LatLng[]): [number, number][] | undefined {
  const k = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const [coords, setCoords] = useState<[number, number][] | undefined>();

  useEffect(() => {
    if (points.length < 2) {
      setCoords(undefined);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${k}?overview=full&geometries=geojson`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error('route failed');
        const data = await res.json();
        const line = data?.routes?.[0]?.geometry?.coordinates;
        setCoords(Array.isArray(line) ? line.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]) : undefined);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setCoords(undefined);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  return coords;
}

// ---- map ------------------------------------------------------------------------------
interface Layers {
  user?: Marker;
  pickup?: Marker;
  dest?: Marker;
  route?: Polyline;
  stops: Marker[];
  riders: Map<string, Marker>;
}
const newLayers = (): Layers => ({ stops: [], riders: new Map() });

interface RiderMapProps {
  center: LatLng;
  user?: LatLng | null;
  pickup?: LatLng | null;
  stops?: LatLng[];
  destination?: LatLng | null;
  riders?: MapRider[];
  routeCoords?: [number, number][];
  tracking?: boolean;
  height?: number;
  /** Lifts the OSM attribution so an overlapping sheet never hides it. */
  bottomInset?: number;
}

export function RiderMap({
  center,
  user,
  pickup,
  stops = [],
  destination,
  riders = [],
  routeCoords,
  tracking = false,
  height = 300,
  bottomInset = 0,
}: RiderMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const LRef = useRef<Leaflet | null>(null);
  const layersRef = useRef<Layers>(newLayers());
  const [ready, setReady] = useState(false);
  const stopsKey = stops.map(key).join('|');

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    (async () => {
      const L = (await import('leaflet')).default as Leaflet;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        // One-finger drag stays with the page scroll on touch devices; pinch still zooms.
        dragging: !L.Browser.mobile,
        attributionControl: true,
      }).setView([center.lat, center.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);
      const attribution = map.attributionControl.getContainer();
      if (attribution) attribution.style.marginBottom = `${bottomInset}px`;
      mapRef.current = map;
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(elRef.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = newLayers();
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers, riders and route line
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const layers = layersRef.current;

    const dot = (size: number, style: string) =>
      L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;${style}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    const userIcon = dot(18, 'border-radius:9999px;background:#1E3FCE;border:3px solid #fff;box-shadow:0 0 0 7px rgba(30,63,206,.25)');
    const pickupIcon = dot(16, 'border-radius:9999px;background:#1E3FCE;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)');
    const destIcon = dot(16, 'background:#111827;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)');
    const riderIcon = L.divIcon({
      className: '',
      html: '<div style="width:36px;height:36px;border-radius:9999px;background:#fff;border:2px solid #F5B82E;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:19px">🏍️</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const stopIcon = (n: number) =>
      L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#fff;border:2px solid #6b7280;color:#111827;font:700 11px/18px system-ui;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

    const setMarker = (name: 'user' | 'pickup' | 'dest', pos: LatLng | null | undefined, icon: ReturnType<typeof dot>, z: number) => {
      const existing = layers[name];
      if (!pos) {
        existing?.remove();
        layers[name] = undefined;
        return;
      }
      if (existing) existing.setLatLng([pos.lat, pos.lng]);
      else layers[name] = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: z, interactive: false }).addTo(map);
    };
    setMarker('user', user, userIcon, 100);
    setMarker('pickup', pickup, pickupIcon, 200);
    setMarker('dest', destination, destIcon, 200);

    layers.stops.forEach((m) => m.remove());
    layers.stops = stops.map((p, i) => L.marker([p.lat, p.lng], { icon: stopIcon(i + 1), interactive: false, zIndexOffset: 250 }).addTo(map));

    const seen = new Set<string>();
    riders.forEach((r) => {
      seen.add(r.id);
      const m = layers.riders.get(r.id);
      if (m) m.setLatLng([r.lat, r.lng]);
      else layers.riders.set(r.id, L.marker([r.lat, r.lng], { icon: riderIcon, interactive: false, zIndexOffset: 500 }).addTo(map));
    });
    layers.riders.forEach((m, id) => {
      if (!seen.has(id)) {
        m.remove();
        layers.riders.delete(id);
      }
    });

    layers.route?.remove();
    layers.route = undefined;
    if (routeCoords && routeCoords.length > 1) {
      layers.route = L.polyline(routeCoords, { color: '#1E3FCE', weight: 5, opacity: 0.85 }).addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, pickup, destination, riders, routeCoords, stopsKey]);

  // Camera only moves when the trip changes, never on rider ticks.
  const hasRider = riders.length > 0;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const fit = (pts: LatLng[]) =>
      map.fitBounds(pts.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40], maxZoom: 16, animate: true });
    if (pickup && (destination || stops.length)) fit([pickup, ...stops, ...(destination ? [destination] : [])]);
    else if (tracking && pickup && riders[0]) fit([pickup, riders[0]]);
    else {
      const focus = pickup || user;
      if (focus) map.setView([focus.lat, focus.lng], 15, { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key(user), key(pickup), key(destination), stopsKey, tracking, hasRider]);

  return (
    <div
      ref={elRef}
      style={{ height }}
      className="isolate w-full bg-blue-50"
      role="img"
      aria-label="Map showing your trip and nearby riders"
    />
  );
}

/** Map for an active booking, with a live ETA chip when the rider position is known. */
export function TrackingMap({ pickup, rider }: { pickup: LatLng; rider: LatLng | null }) {
  const eta = rider ? Math.max(1, Math.round(((distanceKm(rider, pickup) * 1.3) / 25) * 60)) : null;
  const riders = useMemo<MapRider[]>(
    () => (rider ? [{ id: 'tracked', lat: rider.lat, lng: rider.lng }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rider?.lat, rider?.lng],
  );
  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-gray-100">
      <RiderMap center={pickup} pickup={pickup} riders={riders} tracking height={200} />
      {eta !== null && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-gray-900 shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Rider about {eta} min away
        </div>
      )}
    </div>
  );
}
