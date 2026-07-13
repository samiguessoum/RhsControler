import { useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Intervention } from '@/types';

// Fix default marker icons (webpack/vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Geocoding cache (module-level, persists across re-renders) ──
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
let geocodeQueue: Array<{ key: string; resolve: (v: { lat: number; lng: number } | null) => void }> = [];
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;

async function geocodeAddress(adresse: string, codePostal?: string, ville?: string): Promise<{ lat: number; lng: number } | null> {
  const parts = [adresse, codePostal, ville].filter(Boolean).join(', ') + ', Algérie';
  if (geocodeCache.has(parts)) return geocodeCache.get(parts)!;

  return new Promise((resolve) => {
    geocodeQueue.push({ key: parts, resolve });
    if (geocodeTimer) clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(flushGeocodeQueue, 300);
  });
}

async function flushGeocodeQueue() {
  const batch = [...geocodeQueue];
  geocodeQueue = [];
  geocodeTimer = null;

  for (const { key, resolve } of batch) {
    if (geocodeCache.has(key)) {
      resolve(geocodeCache.get(key)!);
      continue;
    }
    try {
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/s
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=dz&q=${encodeURIComponent(key)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data = await res.json();
      const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
      geocodeCache.set(key, result);
      resolve(result);
    } catch {
      geocodeCache.set(key, null);
      resolve(null);
    }
  }
}

// ── Statut → marker color ──
function getMarkerColor(statuts: string[]): string {
  if (statuts.some((s) => s === 'EN_RETARD')) return '#ef4444';
  if (statuts.every((s) => s === 'REALISEE')) return '#16a34a';
  if (statuts.some((s) => s === 'REALISEE')) return '#f59e0b';
  if (statuts.some((s) => s === 'ANNULEE')) return '#9ca3af';
  return '#3b82f6';
}

function createDotIcon(color: string, count: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${count > 1 ? 36 : 28}px;
        height:${count > 1 ? 36 : 28}px;
        background:${color};
        border:2.5px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,.25);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:11px;font-weight:700;
      ">${count > 1 ? count : ''}</div>`,
    iconSize: [count > 1 ? 36 : 28, count > 1 ? 36 : 28],
    iconAnchor: [count > 1 ? 18 : 14, count > 1 ? 18 : 14],
  });
}

// ── Types ──
interface SiteGroup {
  siteId: string;
  siteName: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  lat?: number;
  lng?: number;
  interventions: Intervention[];
}

interface Props {
  interventions: Intervention[];
  onInterventionClick: (i: Intervention) => void;
}

export function PlanningMap({ interventions, onInterventionClick }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Group interventions by site
  const siteGroups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, SiteGroup>();
    for (const interv of interventions) {
      const key = interv.siteId || `client-${interv.clientId}`;
      const site = interv.site as any;
      if (!map.has(key)) {
        map.set(key, {
          siteId: key,
          siteName: site?.nom || interv.client?.nomEntreprise || 'Site inconnu',
          adresse: site?.adresse,
          codePostal: site?.codePostal,
          ville: site?.ville,
          lat: site?.latitude ?? undefined,
          lng: site?.longitude ?? undefined,
          interventions: [],
        });
      }
      map.get(key)!.interventions.push(interv);
    }
    return Array.from(map.values());
  }, [interventions]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [28.0, 2.5], // Centre Algérie
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const addMarkers = useCallback(
    async (groups: SiteGroup[]) => {
      const map = mapRef.current;
      if (!map) return;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds: [number, number][] = [];

      for (const group of groups) {
        let lat = group.lat;
        let lng = group.lng;

        // Geocode if no coords
        if (!lat || !lng) {
          if (group.adresse || group.ville) {
            const geo = await geocodeAddress(group.adresse || group.ville!, group.codePostal, group.ville);
            if (geo) { lat = geo.lat; lng = geo.lng; }
          }
        }

        if (!lat || !lng) continue;

        const statuts = group.interventions.map((i) => i.statut);
        const color = getMarkerColor(statuts);
        const marker = L.marker([lat, lng], { icon: createDotIcon(color, group.interventions.length) });

        // Popup content
        const lines = group.interventions
          .slice(0, 8)
          .map((i) => {
            const date = i.datePrevue ? new Date(i.datePrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';
            const prestation = i.prestation || i.type || '';
            return `<div style="padding:2px 0;border-bottom:1px solid #f3f4f6;cursor:pointer;" data-id="${i.id}">
              <span style="color:#6b7280;font-size:10px;">${date}</span>
              <span style="margin-left:6px;font-size:11px;">${prestation}</span>
            </div>`;
          })
          .join('');
        const more = group.interventions.length > 8 ? `<div style="color:#6b7280;font-size:10px;padding-top:4px;">+${group.interventions.length - 8} autres</div>` : '';

        const popup = L.popup({ maxWidth: 260, minWidth: 200 }).setContent(`
          <div style="font-family:system-ui,sans-serif;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${group.siteName}</div>
            ${group.ville ? `<div style="color:#6b7280;font-size:11px;margin-bottom:6px;">${[group.adresse, group.codePostal, group.ville].filter(Boolean).join(' ')}</div>` : ''}
            <div style="margin-top:4px;">${lines}${more}</div>
          </div>
        `);

        marker.bindPopup(popup);

        // Click on intervention row inside popup
        popup.on('add', () => {
          const el = popup.getElement();
          if (!el) return;
          el.querySelectorAll('[data-id]').forEach((row) => {
            (row as HTMLElement).addEventListener('click', () => {
              const id = (row as HTMLElement).dataset.id;
              const found = group.interventions.find((i) => i.id === id);
              if (found) { map.closePopup(); onInterventionClick(found); }
            });
          });
        });

        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 13 });
      }
    },
    [onInterventionClick]
  );

  useEffect(() => {
    addMarkers(siteGroups);
  }, [siteGroups, addMarkers]);

  const total = interventions.length;
  const realisees = interventions.filter((i) => i.statut === 'REALISEE').length;
  const enRetard = interventions.filter((i) => (i.statut as string) === 'EN_RETARD').length;
  const sites = siteGroups.length;

  return (
    <div className="relative bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
      {/* Legend */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs space-y-1 border border-gray-100">
        <div className="font-semibold text-gray-700 mb-1.5">{sites} site{sites > 1 ? 's' : ''} · {total} intervention{total > 1 ? 's' : ''}</div>
        <div className="flex items-center gap-1.5"><span style={{ background: '#16a34a' }} className="w-3 h-3 rounded-full inline-block" /> Réalisé</div>
        <div className="flex items-center gap-1.5"><span style={{ background: '#f59e0b' }} className="w-3 h-3 rounded-full inline-block" /> Partiel</div>
        <div className="flex items-center gap-1.5"><span style={{ background: '#3b82f6' }} className="w-3 h-3 rounded-full inline-block" /> Planifié</div>
        <div className="flex items-center gap-1.5"><span style={{ background: '#ef4444' }} className="w-3 h-3 rounded-full inline-block" /> En retard</div>
        <div className="flex items-center gap-1.5"><span style={{ background: '#9ca3af' }} className="w-3 h-3 rounded-full inline-block" /> Annulé</div>
        {realisees > 0 && <div className="pt-1 border-t border-gray-100 text-green-700 font-medium">{realisees}/{total} réalisées</div>}
        {enRetard > 0 && <div className="text-red-600 font-medium">{enRetard} en retard</div>}
      </div>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
