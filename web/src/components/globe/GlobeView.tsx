import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import Papa from 'papaparse';
import { Flame, Activity, Info } from 'lucide-react';
import type { AnomalyLevel, FireGridRow } from '../../types/fireData';

interface GlobeViewProps {
  selectedCell: FireGridRow | null;
  onSelectCell: (cell: FireGridRow) => void;
}

type ViewMode = 'anomaly' | 'activity';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const ANOMALY_COLORS: Record<AnomalyLevel, string> = {
  VERY_LOW: '#1d4ed8',        // Koyu mavi
  LOW: '#60a5fa',             // Açık mavi
  NORMAL: '#64748b',          // Nötr gri
  HIGH: '#f97316',            // Turuncu
  VERY_HIGH: '#dc2626',       // Kırmızı
  INSUFFICIENT_DATA: '#334155',
};

function getActivityColor(val: number): string {
  if (val >= 500) return '#fcfdbf';
  if (val >= 100) return '#fe9f6d';
  if (val >= 25) return '#de4968';
  if (val >= 5) return '#8c2981';
  return '#3b0f70';
}

// Performans için her renk kodu için Three.js materyalini bir kez üretip önbellekte tut
const materialCache: Record<string, THREE.MeshLambertMaterial> = {};

function getTileMaterial(hexColor: string): THREE.MeshLambertMaterial {
  if (!materialCache[hexColor]) {
    materialCache[hexColor] = new THREE.MeshLambertMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.88,
    });
  }
  return materialCache[hexColor];
}

const initialYearCache: Record<number, FireGridRow[]> = {};

export function GlobeView({ selectedCell, onSelectCell }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const yearCacheRef = useRef(initialYearCache);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [viewMode, setViewMode] = useState<ViewMode>('anomaly');
  const [yearRows, setYearRows] = useState<FireGridRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sol panel boyutuna göre küreyi duyarlı (responsive) tut
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Yalnızca seçili yılın CSV dosyasını yükle ve önbelleğe al
  useEffect(() => {
    let cancelled = false;

    async function loadYearData(year: number) {
      if (yearCacheRef.current[year]) {
        setYearRows(yearCacheRef.current[year]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/data/${year}.csv`);
        if (!res.ok) throw new Error(`${year}.csv bulunamadı (${res.status})`);
        const csvText = await res.text();

        const parsed = Papa.parse<FireGridRow>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        const cleanRows = parsed.data.filter(
          (r) => typeof r.lat === 'number' && typeof r.lon === 'number' && typeof r.month === 'number'
        );

        yearCacheRef.current[year] = cleanRows;
        if (!cancelled) setYearRows(cleanRows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
          setYearRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadYearData(selectedYear);
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  // Seçili aya göre filtrele
  const activeTiles = useMemo(
    () => yearRows.filter((row) => row.month === selectedMonth),
    [yearRows, selectedMonth]
  );

  const resolveTileColor = (d: object): string => {
    const row = d as FireGridRow;
    if (selectedCell?.grid_id === row.grid_id) return '#22d3ee';
    if (viewMode === 'anomaly') {
      return ANOMALY_COLORS[row.anomaly_level] || ANOMALY_COLORS.INSUFFICIENT_DATA;
    }
    return getActivityColor(row.activity_index || 0);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* Üst Kontrol Çubuğu: Görünüm Modu ve Durum */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800 backdrop-blur pointer-events-auto">
          <button
            onClick={() => setViewMode('anomaly')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'anomaly'
                ? 'bg-orange-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Anomali Seviyesi
          </button>
          <button
            onClick={() => setViewMode('activity')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'activity'
                ? 'bg-orange-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Aktivite İndeksi
          </button>
        </div>

        <div className="rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs border border-slate-800 backdrop-blur text-slate-300">
          {loading ? (
            <span className="text-orange-400">Veri yükleniyor ({selectedYear})...</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            <span>
              Aktif Hücre: <strong className="text-white">{activeTiles.length.toLocaleString('tr-TR')}</strong> (2°×2°)
            </span>
          )}
        </div>
      </div>

      {/* 3D Küre */}
      <Globe
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="#020617"
        tilesData={activeTiles}
        tileLat="lat"
        tileLng="lon"
        tileWidth={2}
        tileHeight={2}
        tileAltitude={(d: object) => {
          const row = d as FireGridRow;
          if (selectedCell?.grid_id === row.grid_id) return 0.035;
          return Math.min(0.025, 0.004 + (row.activity_index || 0) * 0.00004);
        }}
        tileMaterial={(d: object) => getTileMaterial(resolveTileColor(d))}
        tileLabel={(d: object) => {
          const r = d as FireGridRow;
          const zText = r.z_score !== null && r.z_score !== undefined ? r.z_score.toFixed(2) : 'Yok';
          return `
            <div style="background:#0f172a;border:1px solid #334155;padding:8px 10px;border-radius:6px;font-family:sans-serif;font-size:12px;color:#f8fafc;">
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">Hücre: ${r.grid_id} (${r.lat}°, ${r.lon}°)</div>
              <div>Aktivite İndeksi: <b>${r.activity_index?.toFixed(1)}</b></div>
              <div>Anomali: <b>${r.anomaly_level}</b> (Z: ${zText})</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:2px;">Kaynak: ${r.source} • İncelemek için tıkla</div>
            </div>
          `;
        }}
        onTileClick={(d: object) => onSelectCell(d as FireGridRow)}
      />

      {/* Alt Kontrol Paneli: Yıl & Ay Slider ve Lejant */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-2 rounded-xl bg-slate-900/90 p-3 border border-slate-800 backdrop-blur">
        {/* Zaman Kaydırıcıları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Yıl Seçimi</span>
              <span className="font-bold text-orange-400">
                {selectedYear} {selectedYear === 2026 && '(14 Kas 2026’ya kadar kısmi)'}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={2026}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Ay Seçimi</span>
              <span className="font-bold text-orange-400">
                {MONTH_NAMES[selectedMonth - 1]} ({selectedMonth}/12)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Lejant ve Bilimsel Uyarı */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          {viewMode === 'anomaly' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#1d4ed8]" /> Çok Düşük</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#60a5fa]" /> Düşük</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#64748b]" /> Normal</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#f97316]" /> Yüksek</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#dc2626]" /> Çok Yüksek</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#334155]" /> Yetersiz Veri</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#3b0f70]" /> &lt;5</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#8c2981]" /> 5–25</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#de4968]" /> 25–100</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#fe9f6d]" /> 100–500</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-xs bg-[#fcfdbf]" /> 500+</span>
            </div>
          )}

          <span className="flex items-center gap-1 text-slate-500">
            <Info className="h-3 w-3 shrink-0" />
            Tarihsel aktivite göstergesidir; operasyonel erken uyarı/tahmin değildir.
          </span>
        </div>
      </div>
    </div>
  );
}