import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import Papa from 'papaparse';
import { Flame, Activity, Info, Compass, Play, Pause } from 'lucide-react';
import type { AnomalyLevel, FireGridRow } from '../../types/fireData';
import { STORY_CASES, type StoryCase } from './storyCases';

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
  VERY_LOW: '#2563eb',
  LOW: '#38bdf8',
  NORMAL: '#64748b',
  HIGH: '#f97316',
  VERY_HIGH: '#ef4444',
  INSUFFICIENT_DATA: '#334155',
};

function getActivityColor(val: number): string {
  if (val >= 500) return '#fef08a';
  if (val >= 100) return '#fb923c';
  if (val >= 25) return '#e11d48';
  if (val >= 5) return '#9333ea';
  return '#4c1d95';
}

const initialYearCache: Record<number, FireGridRow[] | undefined> = {};
const loadingPromises = new Map<number, Promise<FireGridRow[]>>();

function fetchAndCacheYear(year: number): Promise<FireGridRow[]> {
  const cached = initialYearCache[year];
  if (cached) {
    return Promise.resolve(cached);
  }
  const existingPromise = loadingPromises.get(year);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = fetch(`/data/${year}.csv`)
    .then((res) => {
      if (!res.ok) throw new Error(`${year}.csv bulunamadı (${res.status})`);
      return res.text();
    })
    .then(
      (csvText) =>
        new Promise<FireGridRow[]>((resolve) => {
          Papa.parse<FireGridRow>(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            worker: true,
            complete: (results) => {
              const cleanRows = results.data.filter(
                (r) =>
                  typeof r.lat === 'number' &&
                  typeof r.lon === 'number' &&
                  typeof r.month === 'number'
              );
              initialYearCache[year] = cleanRows;
              loadingPromises.delete(year);
              resolve(cleanRows);
            },
          });
        })
    )
    .catch((err) => {
      loadingPromises.delete(year);
      throw err;
    });

  loadingPromises.set(year, requestPromise);
  return requestPromise;
}

export function GlobeView({ selectedCell, onSelectCell }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const pendingStoryRef = useRef<StoryCase | null>(null);
  const tourIndexRef = useRef<number>(0);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [viewMode, setViewMode] = useState<ViewMode>('anomaly');

  const [loadedState, setLoadedState] = useState<{
    year: number | null;
    rows: FireGridRow[];
    error: string | null;
  }>({ year: null, rows: [], error: null });

  const cachedRows = initialYearCache[selectedYear];
  const isCurrentYearLoaded = loadedState.year === selectedYear;
  const yearRows = useMemo(
    () => cachedRows ?? (isCurrentYearLoaded ? loadedState.rows : []),
    [cachedRows, isCurrentYearLoaded, loadedState.rows]
  );
  const loading = !cachedRows && !isCurrentYearLoaded;
  const error = !cachedRows && isCurrentYearLoaded ? loadedState.error : null;

  const [activeStory, setActiveStory] = useState<StoryCase | null>(null);
  const [isAutoTour, setIsAutoTour] = useState<boolean>(false);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const renderer = globe.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.85;
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    fetchAndCacheYear(selectedYear)
      .then((rows) => {
        if (!cancelled) {
          setLoadedState({ year: selectedYear, rows, error: null });
        }
        const storyYears = Array.from(new Set(STORY_CASES.map((s) => s.year)));
        storyYears.forEach((y) => {
          if (!initialYearCache[y]) {
            fetchAndCacheYear(y).catch(() => {});
          }
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadedState({
            year: selectedYear,
            rows: [],
            error: err instanceof Error ? err.message : 'Veri yüklenemedi',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  // Yalnızca anlamlı mavi ve turuncu/kırmızı noktaları göster
  const activePoints = useMemo(() => {
    return yearRows.filter((row) => {
      if (row.month !== selectedMonth) return false;
      if (!row.activity_index || row.activity_index <= 0) return false;
      if (row.anomaly_level === 'INSUFFICIENT_DATA') return false;
      if (viewMode === 'anomaly' && row.anomaly_level === 'NORMAL') return false;
      return true;
    });
  }, [yearRows, selectedMonth, viewMode]);

  const selectedRingData = useMemo(
    () => (selectedCell ? [selectedCell] : []),
    [selectedCell]
  );

  useEffect(() => {
    const target = pendingStoryRef.current;
    if (!target || activePoints.length === 0) return;
    if (selectedYear !== target.year || selectedMonth !== target.month) return;

    let closestRow = activePoints[0];
    let minDist = Infinity;

    for (const row of activePoints) {
      const dist = Math.hypot(row.lat - target.lat, row.lon - target.lon);
      if (dist < minDist) {
        minDist = dist;
        closestRow = row;
      }
    }

    if (closestRow && minDist <= 8) {
      onSelectCell(closestRow);
    }
    pendingStoryRef.current = null;
  }, [activePoints, selectedYear, selectedMonth, onSelectCell]);

  const flyToStory = useCallback((story: StoryCase, index?: number) => {
    if (typeof index === 'number') {
      tourIndexRef.current = index;
    }
    setActiveStory(story);
    pendingStoryRef.current = story;
    setSelectedYear(story.year);
    setSelectedMonth(story.month);

    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: story.lat, lng: story.lon, altitude: 1.45 },
        1000
      );
    }
  }, []);

  useEffect(() => {
    if (!isAutoTour) return;

    flyToStory(STORY_CASES[tourIndexRef.current], tourIndexRef.current);

    const timer = window.setInterval(() => {
      const nextIdx = (tourIndexRef.current + 1) % STORY_CASES.length;
      flyToStory(STORY_CASES[nextIdx], nextIdx);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [isAutoTour, flyToStory]);

  const getPointColor = useCallback(
    (d: object) => {
      const row = d as FireGridRow;
      if (viewMode === 'anomaly') {
        return ANOMALY_COLORS[row.anomaly_level] || ANOMALY_COLORS.HIGH;
      }
      return getActivityColor(row.activity_index || 0);
    },
    [viewMode]
  );

  const getPointRadius = useCallback(
    (d: object) => {
      const row = d as FireGridRow;
      if (viewMode === 'anomaly') {
        if (row.anomaly_level === 'VERY_HIGH' || row.anomaly_level === 'VERY_LOW') {
          return 0.5;
        }
        return 0.36;
      }
      const val = row.activity_index || 0;
      if (val >= 500) return 0.56;
      if (val >= 100) return 0.46;
      if (val >= 25) return 0.38;
      return 0.3;
    },
    [viewMode]
  );

  const getPointAltitude = useCallback((d: object) => {
    const row = d as FireGridRow;
    return Math.min(0.015, 0.002 + (row.activity_index || 0) * 0.00002);
  }, []);

  const getPointLabel = useCallback((d: object) => {
    const r = d as FireGridRow;
    const zText =
      r.z_score !== null && r.z_score !== undefined ? r.z_score.toFixed(2) : 'Yok';
    return `
      <div style="background:#0f172a;border:1px solid #334155;padding:8px 10px;border-radius:6px;font-family:sans-serif;font-size:12px;color:#f8fafc;">
        <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">Hücre: ${r.grid_id} (${r.lat}°, ${r.lon}°)</div>
        <div>Aktivite İndeksi: <b>${r.activity_index?.toFixed(1)}</b></div>
        <div>Anomali: <b>${r.anomaly_level}</b> (Z: ${zText})</div>
        <div style="color:#94a3b8;font-size:11px;margin-top:2px;">Kaynak: ${r.source} • İncelemek için tıkla</div>
      </div>
    `;
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* Üst Kontrol Çubuğu */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
                Anomali Noktası:{' '}
                <strong className="text-white">
                  {activePoints.length.toLocaleString('tr-TR')}
                </strong>{' '}
                (2°×2°)
              </span>
            )}
          </div>
        </div>

        {/* Hikâye Modu */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/90 backdrop-blur pointer-events-auto">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-400 mr-1">
            <Compass className="h-3.5 w-3.5" />
            Hikâye Modu:
          </span>

          {STORY_CASES.map((story, idx) => {
            const isSelected = activeStory?.id === story.id;
            return (
              <button
                key={story.id}
                onClick={() => {
                  setIsAutoTour(false);
                  flyToStory(story, idx);
                }}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition border ${
                  isSelected
                    ? 'bg-orange-500/20 border-orange-500 text-orange-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                {story.title} <span className="text-slate-400">({story.periodLabel})</span>
              </button>
            );
          })}

          <button
            onClick={() => setIsAutoTour((prev) => !prev)}
            className={`ml-auto flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              isAutoTour
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Tüm vakaları otomatik sırayla gez"
          >
            {isAutoTour ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isAutoTour ? 'Turu Durdur' : 'Otomatik Tur'}
          </button>
        </div>

        {/* Seçili Hikâye Kartı */}
        {activeStory && (
          <div className="self-start max-w-md rounded-lg bg-slate-900/90 px-3 py-2 border border-orange-500/40 backdrop-blur pointer-events-auto text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-orange-400">
                {activeStory.title} — {activeStory.periodLabel}
              </span>
              <button
                onClick={() => {
                  setIsAutoTour(false);
                  setActiveStory(null);
                }}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Kapat ×
              </button>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              {activeStory.summary}
            </p>
          </div>
        )}
      </div>

      {/* 3D Küre (Dairesel Nokta Katmanı) */}
      <Globe
        ref={globeRef}
        onGlobeReady={handleGlobeReady}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        showGraticules={false}
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.16}
        backgroundColor="#020617"
        pointsData={activePoints}
        pointLat="lat"
        pointLng="lon"
        pointColor={getPointColor}
        pointRadius={getPointRadius}
        pointAltitude={getPointAltitude}
        pointResolution={14}
        pointsMerge={true}
        pointsTransitionDuration={0}
        pointLabel={getPointLabel}
        onPointClick={(d: object) => {
          setIsAutoTour(false);
          onSelectCell(d as FireGridRow);
        }}
        ringsData={selectedRingData}
        ringLat="lat"
        ringLng="lon"
        ringAltitude={0.016}
        ringColor={() => (t: number) => `rgba(34, 211, 238, ${1 - t})`}
        ringMaxRadius={2.4}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={1100}
      />

      {/* Alt Kontrol Paneli: Yıl & Ay Slider ve Lejant */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-2 rounded-xl bg-slate-900/90 p-3 border border-slate-800 backdrop-blur">
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
              onChange={(e) => {
                setIsAutoTour(false);
                setSelectedYear(Number(e.target.value));
              }}
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
              onChange={(e) => {
                setIsAutoTour(false);
                setSelectedMonth(Number(e.target.value));
              }}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Lejant ve Bilimsel Uyarı */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          {viewMode === 'anomaly' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" /> Çok Düşük</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" /> Düşük</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#f97316]" /> Yüksek</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Çok Yüksek</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#4c1d95]" /> &lt;5</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#9333ea]" /> 5–25</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#e11d48]" /> 25–100</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#fb923c]" /> 100–500</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#fef08a]" /> 500+</span>
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