import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { Flame, Activity, Info, Compass, Play, Pause, Eye, EyeOff } from 'lucide-react';
import type { AnomalyLevel, FireGridRow } from '../../types/fireData';
import { getCachedFireYear, loadFireYear } from '../../services/fireDataService';
import { STORY_CASES, type StoryCase } from './storyCases';

interface GlobeViewProps {
  selectedCell: FireGridRow | null;
  onSelectCell: (cell: FireGridRow | null) => void;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}

type ViewMode = 'anomaly' | 'activity';

interface EmptyCellInfo {
  grid_id: string;
  lat: number;
  lon: number;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const ANOMALY_COLORS: Record<AnomalyLevel, string> = {
  VERY_LOW: '#2563eb',
  LOW: '#38bdf8',
  NORMAL: '#94a3b8',
  HIGH: '#f97316',
  VERY_HIGH: '#ef4444',
  INSUFFICIENT_DATA: '#64748b',
};

function getActivityColor(val: number): string {
  if (val >= 500) return '#fef08a';
  if (val >= 100) return '#fb923c';
  if (val >= 25) return '#e11d48';
  if (val >= 5) return '#9333ea';
  return '#4c1d95';
}

// Görünmez 2°×2° tıklama/hover alanı (yuvarlak noktaların görünümünü bozmaz)
const HITBOX_TILE_MATERIAL = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
});

function coordsToGridCell(lat: number, lng: number): EmptyCellInfo {
  const gridLat = Math.max(0, Math.min(89, Math.floor((lat + 90) / 2)));
  const gridLon = Math.max(0, Math.min(179, Math.floor((lng + 180) / 2)));
  return {
    grid_id: `${gridLat}_${gridLon}`,
    lat: gridLat * 2 - 89,
    lon: gridLon * 2 - 179,
  };
}

function toCleanFireRow(raw: FireGridRow): FireGridRow {
  return {
    grid_id: raw.grid_id,
    lat: raw.lat,
    lon: raw.lon,
    year: raw.year,
    month: raw.month,
    activity_index: raw.activity_index,
    z_score: raw.z_score ?? null,
    anomaly_level: raw.anomaly_level,
    source: raw.source,
    history_count: raw.history_count,
    confidence_level: raw.confidence_level,
  };
}

export function GlobeView({
  selectedCell,
  onSelectCell,
  selectedYear,
  onSelectYear,
  selectedMonth,
  onSelectMonth,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const pendingStoryRef = useRef<StoryCase | null>(null);
  const tourIndexRef = useRef<number>(0);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [viewMode, setViewMode] = useState<ViewMode>('anomaly');
  const [showNormalCells, setShowNormalCells] = useState<boolean>(false);
  const [emptyCellNotice, setEmptyCellNotice] = useState<EmptyCellInfo | null>(null);

  const [loadedState, setLoadedState] = useState<{
    year: number | null;
    rows: FireGridRow[];
    error: string | null;
  }>({ year: null, rows: [], error: null });

  const cachedRows = getCachedFireYear(selectedYear);
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

    loadFireYear(selectedYear)
      .then((rows) => {
        if (!cancelled) {
          setLoadedState({ year: selectedYear, rows, error: null });
        }
        const storyYears = Array.from(new Set(STORY_CASES.map((s) => s.year)));
        storyYears.forEach((y) => {
          if (!getCachedFireYear(y)) {
            loadFireYear(y).catch(() => {});
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

  // Seçili ayın tüm kayıtları (tıklama araması için)
  const monthRows = useMemo(
    () => yearRows.filter((row) => row.month === selectedMonth),
    [yearRows, selectedMonth]
  );

  // Kürede çizilecek aktif hücreler (INSUFFICIENT_DATA artık 2000–2003 için görünür)
  const activeCells = useMemo(() => {
    return monthRows.filter((row) => {
      if (!row.activity_index || row.activity_index <= 0) return false;
      if (
        viewMode === 'anomaly' &&
        !showNormalCells &&
        row.anomaly_level === 'NORMAL'
      ) {
        return false;
      }
      return true;
    });
  }, [monthRows, viewMode, showNormalCells]);

  const selectedRingData = useMemo(() => {
    if (emptyCellNotice) return [emptyCellNotice];
    if (selectedCell) return [selectedCell];
    return [];
  }, [selectedCell, emptyCellNotice]);

  useEffect(() => {
    const target = pendingStoryRef.current;
    if (!target || activeCells.length === 0) return;
    if (selectedYear !== target.year || selectedMonth !== target.month) return;

    let closestRow = activeCells[0];
    let minDist = Infinity;

    for (const row of activeCells) {
      const dist = Math.hypot(row.lat - target.lat, row.lon - target.lon);
      if (dist < minDist) {
        minDist = dist;
        closestRow = row;
      }
    }

   if (closestRow && minDist <= 8) {
  setEmptyCellNotice(null);
  onSelectCell(toCleanFireRow(closestRow));
}
    pendingStoryRef.current = null;
  }, [activeCells, selectedYear, selectedMonth, onSelectCell]);

  const flyToStory = useCallback(
    (story: StoryCase, index?: number) => {
      if (typeof index === 'number') {
        tourIndexRef.current = index;
      }

      setActiveStory(story);
      setEmptyCellNotice(null);

      if (story.coverageStatus === 'outside_download_bounds') {
        onSelectCell(null);
        pendingStoryRef.current = null;
      } else {
        pendingStoryRef.current = story;
      }

      onSelectYear(story.year);
      onSelectMonth(story.month);

      if (globeRef.current) {
        globeRef.current.pointOfView(
          { lat: story.lat, lng: story.lon, altitude: 1.45 },
          1000
        );
      }
    },
    [onSelectCell, onSelectYear, onSelectMonth]
  );

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
        if (row.anomaly_level === 'NORMAL' || row.anomaly_level === 'INSUFFICIENT_DATA') {
          return 0.28;
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

  const getHitboxTileMaterial = useCallback(() => HITBOX_TILE_MATERIAL, []);

  const getTileLabel = useCallback((d: object) => {
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

  const handleTileClick = useCallback(
    (tile: object) => {
      setIsAutoTour(false);
      setEmptyCellNotice(null);
      onSelectCell(tile as FireGridRow);
    },
    [onSelectCell]
  );

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      setIsAutoTour(false);
      const cellInfo = coordsToGridCell(lat, lng);
      const matchedRow = monthRows.find((r) => r.grid_id === cellInfo.grid_id);

      if (matchedRow) {
        setEmptyCellNotice(null);
        onSelectCell(matchedRow);
      } else {
        setEmptyCellNotice(cellInfo);
      }
    },
    [monthRows, onSelectCell]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* Üst Kontrol Çubuğu */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800 backdrop-blur">
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

            {viewMode === 'anomaly' && (
              <button
                onClick={() => setShowNormalCells((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium border backdrop-blur transition ${
                  showNormalCells
                    ? 'bg-slate-800/95 border-slate-600 text-slate-100'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Mevsim normallerindeki (NORMAL) yangın hücrelerini göster/gizle"
              >
                {showNormalCells ? (
                  <Eye className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                Normal Hücreler
              </button>
            )}
          </div>

          <div className="rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs border border-slate-800 backdrop-blur text-slate-300">
            {loading ? (
              <span className="text-orange-400">Veri yükleniyor ({selectedYear})...</span>
            ) : error ? (
              <span className="text-red-400">{error}</span>
            ) : (
              <span>
                Aktif Hücre:{' '}
                <strong className="text-white">
                  {activeCells.length.toLocaleString('tr-TR')}
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

        {/* Boş Hücre Tıklama Bildirimi */}
        {emptyCellNotice && (
          <div className="self-start flex items-center gap-3 rounded-lg bg-slate-900/95 px-3 py-2 border border-cyan-500/40 backdrop-blur pointer-events-auto text-xs text-slate-200">
            <span>
              Hücre <strong className="text-cyan-400">{emptyCellNotice.grid_id}</strong> ({emptyCellNotice.lat}°, {emptyCellNotice.lon}°):{' '}
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear} döneminde kayıtlı yangın aktivitesi yok.
            </span>
            <button
              onClick={() => setEmptyCellNotice(null)}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

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
            {activeStory.coverageStatus === 'outside_download_bounds' && (
              <p className="mt-2 text-amber-300 font-medium">
                Veri kapsamı dışında: Bu bölge mevcut NASA FIRMS indirme sınırlarının dışındadır.
                Bu hikâye için yangın aktivitesi veya anomali sonucu sunulamaz.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3D Küre: Görsel Yuvarlak Noktalar + Görünmez 2°×2° Tıklama Alanları */}
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
        pointsData={activeCells}
        pointLat="lat"
        pointLng="lon"
        pointColor={getPointColor}
        pointRadius={getPointRadius}
        pointAltitude={getPointAltitude}
        pointResolution={16}
        pointsMerge={true}
        pointsTransitionDuration={0}
        tilesData={activeCells}
        tileLat="lat"
        tileLng="lon"
        tileWidth={1.98}
        tileHeight={1.98}
        tileAltitude={0.016}
        tileMaterial={getHitboxTileMaterial}
        tileUseGlobeProjection={true}
        tileCurvatureResolution={4}
        tilesTransitionDuration={0}
        tileLabel={getTileLabel}
        onTileClick={handleTileClick}
        onGlobeClick={handleGlobeClick}
        ringsData={selectedRingData}
        ringLat="lat"
        ringLng="lon"
        ringAltitude={0.017}
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
                {selectedYear} {selectedYear === 2026 && '(Ekim 2026’ya kadar kısmi)'}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={2026}
              value={selectedYear}
              onChange={(e) => {
                setIsAutoTour(false);
                setEmptyCellNotice(null);
                onSelectYear(Number(e.target.value));
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
                setEmptyCellNotice(null);
                onSelectMonth(Number(e.target.value));
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
              {showNormalCells && (
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#94a3b8]" /> Normal</span>
              )}
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#f97316]" /> Yüksek</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Çok Yüksek</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#64748b]" /> Yetersiz Tarihçe (2000–03)</span>
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
          <span className="flex items-start gap-1 text-amber-300/80">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            Veri kapsamı sınırlıdır (120.6°B–180°D, 57.8°G–38.9°K).
            Veri bulunmaması, yangın olmadığı anlamına gelmez.
          </span>
        </div>
      </div>
    </div>
  );
}
