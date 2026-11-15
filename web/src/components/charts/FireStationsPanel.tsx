import { useEffect, useState } from 'react';

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

// İki koordinat arası mesafeyi (km) hesaplayan Haversine Formülü
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FireStationsPanel({ cellLat, cellLon }: FireStationsPanelProps) {
  const [nearestStations, setNearestStations] = useState<(Station & { distance: number })[]>([]);

  useEffect(() => {
    // Dalga 3'te oluşturduğumuz statik JSON'u çekiyoruz
    fetch('/data/fire_stations.json')
      .then(res => res.json())
      .then((stations: Station[]) => {
        const distances = stations.map(s => ({
          ...s,
          distance: getDistance(cellLat, cellLon, s.lat, s.lon)
        }));
        
        // Mesafeye göre küçükten büyüğe sırala ve ilk 3'ü al
        distances.sort((a, b) => a.distance - b.distance);
        setNearestStations(distances.slice(0, 3));
      })
      .catch(err => console.error("İtfaiye verisi okunamadı:", err));
  }, [cellLat, cellLon]);

  return (
    <div className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 mt-2 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold text-orange-500">En Yakın İtfaiye İstasyonları</h3>
        <span className="bg-orange-900/50 text-orange-300 text-[10px] px-2 py-0.5 rounded border border-orange-700/50">
          Örnek Veri
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {nearestStations.map(station => (
          <div key={station.id} className="flex justify-between items-center bg-gray-950 p-2 rounded border border-gray-800 text-xs">
            <span className="text-gray-300 truncate pr-2">{station.name}</span>
            <span className="text-cyan-400 font-mono whitespace-nowrap">{station.distance.toFixed(1)} km</span>
          </div>
        ))}
        {nearestStations.length === 0 && (
          <div className="text-xs text-gray-500">İstasyon verisi yükleniyor...</div>
        )}
      </div>
    </div>
  );
}