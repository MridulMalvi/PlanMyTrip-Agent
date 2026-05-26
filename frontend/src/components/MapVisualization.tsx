/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import { TripPlan } from '../types';

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';

interface MarkerInfo {
  name: string;
  lat: number;
  lng: number;
  day?: number;
  type?: string;
}

// Extract location names from itinerary text to geocode
function extractLocations(plan: TripPlan | null): string[] {
  if (!plan) return [];
  const text = [plan.itinerary_output, plan.research_output, plan.local_output].join('\n');
  const matches = text.match(/\*\*([^*]{4,50})\*\*/g) ?? [];
  return [...new Set(matches.map(m => m.replace(/\*\*/g, '').trim()).filter(Boolean))].slice(0, 12);
}

interface Props {
  plan: TripPlan | null;
  isStreaming: boolean;
}

export function MapVisualization({ plan, isStreaming }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [markerCount, setMarkerCount] = useState(0);

  // Load Google Maps script once
  useEffect(() => {
    if (!MAPS_KEY) { setMapReady(false); return; }
    if (window.google?.maps) { setMapReady(true); return; }

    window.initMap = () => setMapReady(true);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => { (window as any).initMap = undefined; };
  }, []);

  // Init map once ready + destination known
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapObj.current) return;

    const center = plan
      ? { lat: 35.6762, lng: 139.6503 }  // fallback: Tokyo
      : { lat: 20, lng: 0 };

    mapObj.current = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: plan ? 12 : 2,
      styles: DARK_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });
  }, [mapReady, plan]);

  // Geocode locations when plan arrives
  useEffect(() => {
    if (!mapReady || !mapObj.current || !plan || !window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    const locations = extractLocations(plan);

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let placed = 0;
    const COLORS = ['#818cf8', '#34d399', '#f59e0b', '#f472b6', '#38bdf8', '#a78bfa'];

    locations.forEach((loc, i) => {
      geocoder.geocode(
        { address: `${loc}, ${plan.destination}` },
        (results: any[], status: string) => {
          if (status !== 'OK' || !results[0]) return;
          const pos = results[0].geometry.location;

          const marker = new window.google.maps.Marker({
            position: pos,
            map: mapObj.current,
            title: loc,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: COLORS[i % COLORS.length],
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="background:#0d1320;color:#e2e8f0;padding:10px 14px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;max-width:180px;line-height:1.5;">
                <strong style="color:#818cf8">${loc}</strong>
              </div>
            `,
          });

          marker.addListener('click', () => infoWindow.open(mapObj.current, marker));
          markersRef.current.push(marker);
          bounds.extend(pos);
          placed++;
          setMarkerCount(placed);

          if (placed === 1 || placed === locations.length) {
            mapObj.current.fitBounds(bounds);
            if (placed === 1) mapObj.current.setZoom(13);
          }
        }
      );
    });
  }, [mapReady, plan]);

  if (!MAPS_KEY) {
    return (
      <div className="map-pane" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <div className="empty-title">Map Visualization</div>
          <div className="empty-subtitle">
            Add <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>VITE_GOOGLE_MAPS_KEY</code> to <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>frontend/.env.local</code> to enable interactive maps.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-pane">
      <div ref={mapRef} className="map-container" />

      {/* Overlay badge */}
      {markerCount > 0 && (
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          background: 'rgba(8,12,20,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          padding: '8px 14px',
          fontSize: '0.78rem',
          color: 'var(--c-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          📍 {markerCount} location{markerCount !== 1 ? 's' : ''} mapped
        </div>
      )}

      {isStreaming && !plan && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(8,12,20,0.6)',
          backdropFilter: 'blur(4px)',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ fontSize: '2rem', animation: 'spin 2s linear infinite' }}>🌍</div>
          <div style={{ color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>Building your map…</div>
        </div>
      )}
    </div>
  );
}

// Google Maps dark style JSON
const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0d1320' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d1320' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#64748b' }] },
  { featureType: 'road',              elementType: 'geometry',          stylers: [{ color: '#1e293b' }] },
  { featureType: 'road',              elementType: 'labels.text.fill',  stylers: [{ color: '#475569' }] },
  { featureType: 'road.highway',      elementType: 'geometry',          stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'water',             elementType: 'geometry',          stylers: [{ color: '#0a1628' }] },
  { featureType: 'water',             elementType: 'labels.text.fill',  stylers: [{ color: '#334155' }] },
  { featureType: 'poi',               elementType: 'geometry',          stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi',               elementType: 'labels.text.fill',  stylers: [{ color: '#475569' }] },
  { featureType: 'transit',           elementType: 'geometry',          stylers: [{ color: '#172036' }] },
  { featureType: 'administrative',    elementType: 'geometry.stroke',   stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels',   stylers: [{ visibility: 'off' }] },
];
