import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    road?: string;
    pedestrian?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
  };
  lat: string;
  lon: string;
}

export interface GeoSelection {
  codePostal?: string;
  ville?: string;
  latitude: number;
  longitude: number;
}

interface Props {
  onSelect: (geo: GeoSelection) => void;
  /** Hint pre-filled in the search box (e.g. the official address) */
  hint?: string;
}

export function GeocoderSearch({ onSelect, hint = '' }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 4) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=dz&q=${encodeURIComponent(q)}&accept-language=fr`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    const addr = r.address;
    const label = r.display_name.split(',').slice(0, 3).join(', ');
    setQuery(label);
    setSelected(label);
    setSuggestions([]);
    setOpen(false);
    onSelect({
      codePostal: addr.postcode,
      ville: addr.city || addr.town || addr.village || addr.municipality || addr.suburb,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
    });
  };

  // Pre-fill with official address as hint
  const handleUseHint = () => {
    if (hint) { setQuery(hint); search(hint); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <LocateFixed className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (!query && hint) handleUseHint();
            else if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={hint ? `Chercher "${hint.slice(0, 30)}..."` : 'Rechercher la position sur la carte...'}
          className="pl-8 pr-8 text-sm"
        />
        {loading && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-gray-400 animate-spin" />}
        {selected && !loading && <MapPin className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-green-500" />}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((r) => {
            const addr = r.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
            const parts = r.display_name.split(',').slice(0, 3).join(', ');
            return (
              <li
                key={r.place_id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-900 leading-tight">{parts}</div>
                  {(addr.postcode || city) && (
                    <div className="text-xs text-gray-400 mt-0.5">{[addr.postcode, city].filter(Boolean).join(' ')}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
