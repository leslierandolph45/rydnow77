'use client';


/**
 * Live map for the customer dashboard.
 *
 * Uses Leaflet + OpenStreetMap tiles. Leaflet is loaded from a CDN the first time a map mounts,
 * so there is nothing to `npm install`. Routes come from the public OSRM demo server; if it is
 * unreachable the route falls back to a straight line. For production, swap in your own routing.
 */


import { useEffect, useRef, useState } from 'react';


export interface LatLng {
  lat: number;
  lng: number;
}


export interface MapRider extends LatLng {
  id: string | number;
}


/** Kept for older imports (the previous rider dashboard used this name). */
export type RiderMarker = MapRider;


/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    L?: any;
  }
}


const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';


let leafletPromise: Promise<any> | null = null;


function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;


  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error('Map failed to load'));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}


const dot = (bg: string, size = 16, border = '#fff') =>
  `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`;


const square = (bg: string) =>
  `<span style="display:block;width:16px;height:16px;border-radius:3px;background:${bg};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`;


const riderPin =
  '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#F5B82E;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);font-size:15px">🏍️</span>';


// ─── Route line ───


/**
 * Road route through `points` (pickup, stops..., destination).
 * Returns a straight line straight away, then swaps in the real road geometry when it arrives.
 */
export function useRouteLine(points: LatLng[]): LatLng[] {
  const [coords, setCoords] = useState<LatLng[]>([]);
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');


  useEffect(() => {
    if (points.length < 2) {
      setCoords([]);
      return;
    }


    const ctrl = new AbortController();
    setCoords(points.map((p) => ({ lat: p.lat, lng: p.lng })));


    const path = points.map((p) => `${p.lng},${p.lat}`).join(';');
    fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('route'))))
      .then((data) => {
        const line = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(line) && line.length > 1) {
          setCoords(line.map(([lng, lat]: [number, number]) => ({ lat, lng })));
        }
      })
      .catch(() => undefined); // keep the straight line


    return () => ctrl.abort();
    // `key` stands in for `points`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);


  return coords;
}


// ─── Map ───


interface RiderMapProps {
  center: LatLng;
  user?: LatLng | null;
  pickup?: LatLng | null;
  stops?: LatLng[];
  destination?: LatLng | null;
  riders?: MapRider[];
  routeCoords?: LatLng[];
  height?: number;
  /** Pixels at the bottom covered by the sheet that overlaps the map. */
  bottomInset?: number;
}


export function RiderMap({
  center,
  user = null,
  pickup = null,
  stops = [],
  destination = null,
  riders = [],
  routeCoords = [],
  height = 300,
  bottomInset = 0,
}: RiderMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const lastFit = useRef('');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);


  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current || mapRef.current) return;
        const map = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        setReady(true);
        setTimeout(() => map.invalidateSize(), 0);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });


    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
      setReady(false);
    };
    // The initial centre is only used once; later moves are handled by the fit logic below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Redraw markers and the route whenever the trip changes.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;


    layer.clearLayers();
    const icon = (html: string, size: number) => L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });


    if (routeCoords.length > 1) {
      L.polyline(routeCoords.map((p) => [p.lat, p.lng]), { color: '#1E3FCE', weight: 5, opacity: 0.85 }).addTo(layer);
    }
    if (user) L.marker([user.lat, user.lng], { icon: icon(dot('#2563EB', 14), 20), interactive: false }).addTo(layer);
    stops.forEach((s) => L.marker([s.lat, s.lng], { icon: icon(dot('#9CA3AF', 14), 20), interactive: false }).addTo(layer));
    if (pickup) L.marker([pickup.lat, pickup.lng], { icon: icon(dot('#1E3FCE', 18), 24), interactive: false }).addTo(layer);
    if (destination) L.marker([destination.lat, destination.lng], { icon: icon(square('#111827'), 22), interactive: false }).addTo(layer);
    riders.forEach((r) => L.marker([r.lat, r.lng], { icon: icon(riderPin, 30), interactive: false }).addTo(layer));


    // Re-fit only when the trip itself changes, not on every rider poll.
    const fitKey = [pickup, destination, ...stops].map((p) => (p ? `${p.lat},${p.lng}` : '-')).join('|') + `#${routeCoords.length > 1 ? 'r' : ''}`;
    if (fitKey === lastFit.current) return;
    lastFit.current = fitKey;


    const pts: [number, number][] = routeCoords.length > 1 ? routeCoords.map((p) => [p.lat, p.lng]) : [];
    if (pts.length === 0) {
      [pickup, ...stops, destination].forEach((p) => p && pts.push([p.lat, p.lng]));
    }
    if (pts.length > 1) {
      map.fitBounds(pts, { paddingTopLeft: [40, 70], paddingBottomRight: [40, 40 + bottomInset], maxZoom: 17 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    } else if (user) {
      map.setView([user.lat, user.lng], 15);
    }
  }, [ready, user, pickup, stops, destination, riders, routeCoords, bottomInset]);


  return (
    // isolate keeps Leaflet's internal z-indexes below the buttons the dashboard overlays on the map.
    <div className="relative z-0 w-full overflow-hidden bg-slate-200" style={{ height, isolation: 'isolate' }}>
      <div ref={el} className="h-full w-full" aria-label="Map" />
      {!ready && !failed && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 px-6 text-center text-sm text-gray-600">
          The map couldn’t load. You can still enter your addresses and book.
        </div>
      )}
    </div>
  );
}


export default RiderMap;


