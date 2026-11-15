import { useEffect, useState } from 'react';
import { MapPin, Navigation, Info } from 'lucide-react';

interface Station {
  id: number;
  lat: number;
  lon: number;
  name: string;
}

interface FireStationsPanelProps {
  cellLat: number;
  cellLon: number;
}

// Haversine formula for great-circle distance (km) between two coordinates
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FireStationsPanel({
  cellLat,
  cellLon,
}: FireStationsPanelProps) {
  const [nearestStations, setNearestStations] = useState<
    (Station & { distance: number })[]
  >([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/data/fire_stations.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((stations: Station[]) => {
        if (cancelled) return;
        const distances = stations.map((s) => ({
          ...s,
          distance: getDistance(cellLat, cellLon, s.lat, s.lon),
        }));

        distances.sort((a, b) => a.distance - b.distance);
        setLoadFailed(false);
        setNearestStations(distances.slice(0, 3));
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load fire station reference data:', err);
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cellLat, cellLon]);

  return (
    <section className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5 flex flex-col gap-3 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/25 p-1.5">
            <MapPin className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 leading-tight">
              Nearest Reference Fire Stations
            </h3>
            <p className="text-[11px] text-slate-400 tabular-nums">
              From cell center ({cellLat}°, {cellLon}°)
            </p>
          </div>
        </div>

        <span className="rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 text-[10px] font-semibold px-2.5 py-0.5 tracking-wide">
          Sample Data
        </span>
      </div>

      {/* Station List */}
      <div className="flex flex-col gap-2">
        {nearestStations.map((station, idx) => (
          <div
            key={station.id}
            className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-800/90 bg-slate-950/70 px-3 py-2 text-xs hover:border-slate-700 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 border border-slate-700/80 text-[10px] font-bold text-slate-300 tabular-nums">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-slate-200 truncate">
                  {station.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  {station.lat.toFixed(2)}°, {station.lon.toFixed(2)}°
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-md bg-cyan-950/50 border border-cyan-500/30 px-2 py-1 text-[11px] font-mono font-semibold text-cyan-300 whitespace-nowrap tabular-nums">
              <Navigation className="h-3 w-3 text-cyan-400" />
              {station.distance.toFixed(1)} km
            </div>
          </div>
        ))}

        {nearestStations.length === 0 && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-400">
            {loadFailed
              ? 'Reference station dataset could not be loaded.'
              : 'Loading reference station data...'}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="flex items-start gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
        <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          Great-circle (Haversine) distances computed from the 2°×2° cell
          centroid using illustrative sample station coordinates.
        </span>
      </div>
    </section>
  );
}