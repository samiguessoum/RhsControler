import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Intervention } from '@/types';

// ── Geocoding cache ──────────────────────────────────────────────────────────
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
let geocodeQueue: Array<{ key: string; resolve: (v: { lat: number; lng: number } | null) => void }> = [];
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;

async function geocodeAddress(adresse?: string, codePostal?: string, ville?: string): Promise<{ lat: number; lng: number } | null> {
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
    if (geocodeCache.has(key)) { resolve(geocodeCache.get(key)!); continue; }
    try {
      await new Promise((r) => setTimeout(r, 1100));
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=dz&q=${encodeURIComponent(key)}`,
        { headers: { 'Accept-Language': 'fr' } }
      );
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

// ── Status helpers ────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

function isEnRetard(i: Intervention) {
  return new Date(i.datePrevue) < today && i.statut !== 'REALISEE' && i.statut !== 'ANNULEE';
}

type MapStatus = 'retard' | 'annulee' | 'planifiee' | 'realisee' | 'partiel';

function groupStatus(interventions: Intervention[]): MapStatus {
  if (interventions.some(isEnRetard)) return 'retard';
  if (interventions.every((i) => i.statut === 'REALISEE')) return 'realisee';
  if (interventions.some((i) => i.statut === 'REALISEE')) return 'partiel';
  if (interventions.every((i) => i.statut === 'ANNULEE')) return 'annulee';
  return 'planifiee';
}

const STATUS_COLOR: Record<MapStatus, string> = {
  retard:   '#ef4444',
  annulee:  '#9ca3af',
  planifiee:'#3b82f6',
  realisee: '#16a34a',
  partiel:  '#f59e0b',
};
const STATUS_LABEL: Record<MapStatus, string> = {
  retard:   'En retard',
  annulee:  'Annulé',
  planifiee:'Planifié',
  realisee: 'Réalisé',
  partiel:  'Partiel',
};

const STATUT_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  REALISEE:   { bg: '#dcfce7', text: '#15803d', label: 'Réalisée' },
  PLANIFIEE:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Planifiée' },
  A_PLANIFIER:{ bg: '#fef9c3', text: '#854d0e', label: 'À planifier' },
  REPORTEE:   { bg: '#f3e8ff', text: '#7e22ce', label: 'Reportée' },
  ANNULEE:    { bg: '#f1f5f9', text: '#64748b', label: 'Annulée' },
};

// ── Custom SVG pin marker ─────────────────────────────────────────────────────
function createPinIcon(color: string, count: number, pulse = false): L.DivIcon {
  const size = count > 1 ? 40 : 32;
  const badge = count > 1
    ? `<div style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:white;border:2px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${color};">${count}</div>`
    : '';
  const pulseRing = pulse
    ? `<div style="position:absolute;inset:-6px;border-radius:50% 50% 50% 0;border:3px solid ${color};opacity:.4;animation:pulse 1.5s ease-in-out infinite;transform:rotate(-45deg);"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <style>@keyframes pulse{0%,100%{transform:rotate(-45deg) scale(1);opacity:.4}50%{transform:rotate(-45deg) scale(1.25);opacity:.1}}</style>
      <div style="position:relative;width:${size}px;height:${size + 10}px;">
        ${pulseRing}
        <svg width="${size}" height="${size + 10}" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.3))">
          <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30S40 35 40 20C40 9 31 0 20 0z" fill="${color}"/>
          <circle cx="20" cy="19" r="9" fill="white" opacity=".95"/>
        </svg>
        ${badge}
      </div>`,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -(size + 10)],
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SiteGroup {
  siteId: string;
  siteName: string;
  clientName: string;
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

// ── Component ─────────────────────────────────────────────────────────────────
export function PlanningMap({ interventions, onInterventionClick }: Props) {
  const mapRef       = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef   = useRef<L.Marker[]>([]);
  const boundsRef    = useRef<[number, number][]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [placed, setPlaced]       = useState(0);

  const siteGroups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, SiteGroup>();
    for (const iv of interventions) {
      const key = iv.siteId || `client-${iv.clientId}`;
      const site = iv.site as any;
      if (!map.has(key)) {
        map.set(key, {
          siteId:     key,
          siteName:   site?.nom || 'Site principal',
          clientName: iv.client?.nomEntreprise || '—',
          adresse:    site?.adresse,
          codePostal: site?.codePostal,
          ville:      site?.ville,
          lat:        site?.latitude  ?? undefined,
          lng:        site?.longitude ?? undefined,
          interventions: [],
        });
      }
      map.get(key)!.interventions.push(iv);
    }
    return Array.from(map.values());
  }, [interventions]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [28.0, 2.5],
      zoom: 5,
      zoomControl: false,
    });

    // CartoDB Positron — propre et lisible
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Zoom controls en bas à gauche
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const fitBounds = useCallback(() => {
    if (mapRef.current && boundsRef.current.length > 0) {
      mapRef.current.fitBounds(boundsRef.current as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 13 });
    }
  }, []);

  const buildPopup = useCallback((group: SiteGroup): string => {
    const status = groupStatus(group.interventions);
    const color  = STATUS_COLOR[status];
    const addr   = [group.adresse, group.codePostal, group.ville].filter(Boolean).join(', ');

    const rows = group.interventions.slice(0, 10).map((i) => {
      const date  = new Date(i.datePrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const heure = i.heurePrevue ? ` ${i.heurePrevue.slice(0, 5)}` : '';
      const badge = STATUT_BADGE[i.statut] || STATUT_BADGE.PLANIFIEE;
      const retard = isEnRetard(i);
      return `
        <div data-id="${i.id}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6;cursor:pointer;" class="map-iv-row">
          <div style="min-width:36px;text-align:right;font-size:10px;color:#9ca3af;font-variant-numeric:tabular-nums;">${date}${heure}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${retard ? '#ef4444' : '#111827'};">
              ${i.prestation || i.type || '—'}
            </div>
          </div>
          <div style="shrink:0;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;background:${badge.bg};color:${badge.text};">
            ${retard ? '⚠ retard' : badge.label}
          </div>
        </div>`;
    }).join('');

    const more = group.interventions.length > 10
      ? `<div style="padding:4px 0;font-size:10px;color:#6b7280;text-align:center;">+${group.interventions.length - 10} autres</div>`
      : '';

    return `
      <div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:280px;">
        <div style="border-left:3px solid ${color};padding-left:8px;margin-bottom:8px;">
          <div style="font-weight:800;font-size:13px;color:#111827;line-height:1.3;">${group.siteName}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:1px;">${group.clientName}</div>
          ${addr ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">📍 ${addr}</div>` : ''}
        </div>
        <div style="font-size:10px;font-weight:600;color:${color};margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">
          ${group.interventions.length} intervention${group.interventions.length > 1 ? 's' : ''} · ${STATUS_LABEL[status]}
        </div>
        <div>${rows}${more}</div>
      </div>`;
  }, []);

  const addMarkers = useCallback(async (groups: SiteGroup[]) => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    boundsRef.current  = [];

    setGeocoding(true);
    setPlaced(0);

    let count = 0;
    for (const group of groups) {
      let lat = group.lat;
      let lng = group.lng;

      if (!lat || !lng) {
        if (group.adresse || group.ville) {
          const geo = await geocodeAddress(group.adresse, group.codePostal, group.ville);
          if (geo) { lat = geo.lat; lng = geo.lng; }
        }
      }

      if (!lat || !lng) continue;

      const status = groupStatus(group.interventions);
      const color  = STATUS_COLOR[status];
      const pulse  = status === 'retard';

      const marker = L.marker([lat, lng], {
        icon: createPinIcon(color, group.interventions.length, pulse),
        title: group.siteName,
      });

      const popup = L.popup({
        maxWidth: 300,
        minWidth: 250,
        className: 'planning-map-popup',
      }).setContent(buildPopup(group));

      marker.bindPopup(popup);

      popup.on('add', () => {
        const el = popup.getElement();
        if (!el) return;
        el.querySelectorAll<HTMLElement>('[data-id]').forEach((row) => {
          row.style.transition = 'background .12s';
          row.addEventListener('mouseenter', () => { row.style.background = '#f9fafb'; });
          row.addEventListener('mouseleave', () => { row.style.background = ''; });
          row.addEventListener('click', () => {
            const found = group.interventions.find((i) => i.id === row.dataset.id);
            if (found) { map.closePopup(); onInterventionClick(found); }
          });
        });
      });

      marker.addTo(map);
      markersRef.current.push(marker);
      boundsRef.current.push([lat, lng]);
      count++;
      setPlaced(count);
    }

    setGeocoding(false);
    if (boundsRef.current.length > 0) {
      map.fitBounds(boundsRef.current as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 13 });
    }
  }, [buildPopup, onInterventionClick]);

  useEffect(() => { addMarkers(siteGroups); }, [siteGroups, addMarkers]);

  // Stats
  const total    = interventions.length;
  const realisees = interventions.filter((i) => i.statut === 'REALISEE').length;
  const enRetard  = interventions.filter(isEnRetard).length;
  const sites     = siteGroups.length;
  const taux      = total > 0 ? Math.round((realisees / total) * 100) : 0;

  return (
    <div className="relative bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100" style={{ height: 'calc(100vh - 220px)', minHeight: 520 }}>

      {/* Barre de stats en haut */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2 flex items-center gap-4 text-xs">
        <span className="font-bold text-gray-700">{sites} site{sites > 1 ? 's' : ''}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-600">{total} intervention{total > 1 ? 's' : ''}</span>
        {enRetard > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {enRetard} en retard
          </span>
        )}
        {realisees > 0 && (
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {realisees} réalisée{realisees > 1 ? 's' : ''} ({taux}%)
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {geocoding && (
            <span className="text-gray-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
              Géolocalisation… ({placed}/{sites})
            </span>
          )}
          <button
            onClick={fitBounds}
            title="Recentrer la carte"
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            ⤢ Recentrer
          </button>
        </div>
      </div>

      {/* Légende en bas à droite */}
      <div className="absolute bottom-8 right-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow border border-gray-100 px-3 py-2 text-xs space-y-1">
        {(Object.entries(STATUS_COLOR) as [MapStatus, string][]).map(([s, c]) => (
          <div key={s} className="flex items-center gap-2">
            <svg width="12" height="15" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30S40 35 40 20C40 9 31 0 20 0z" fill={c} />
            </svg>
            <span className="text-gray-600">{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="w-full h-full pt-9" />
    </div>
  );
}
