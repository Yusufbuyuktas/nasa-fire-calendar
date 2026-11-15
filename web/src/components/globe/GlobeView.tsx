import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import {
  Flame,
  Activity,
  Info,
  Compass,
  Play,
  Pause,
  Eye,
  EyeOff,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import type { AnomalyLevel, FireGridRow } from '../../types/fireData';
import { getCachedFireYear, loadFireYear } from '../../services/fireDataService';
import { storyCases, type StoryCase } from './storyCases';

interface GlobeViewProps {
  selectedCell: FireGridRow | null;
  onSelectCell: (cell: FireGridRow) => void;
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
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ANOMALY_COLORS: Record<AnomalyLevel, string> = {
  VERY_LOW: '#2563eb',
  LOW: '#38bdf8',
  NORMAL: '#94a3b8',
  HIGH: '#f97316',
  VERY_HIGH: '#ef4444',
  INSUFFICIENT_DATA: '#64748b',
  UNVERIFIED_ZERO: '#334155',
};

const ANOMALY_LABELS: Record<AnomalyLevel, string> = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
  VERY_LOW: 'Very Low',
  INSUFFICIENT_DATA: 'Insufficient History',
  UNVERIFIED_ZERO: 'Unverified Zero',
};

function getActivityColor(val: number): string {
  if (val >= 500) return '#fef08a';
  if (val >= 100) return '#fb923c';
  if (val >= 25) return '#e11d48';
  if (val >= 5) return '#9333ea';
  return '#4c1d95';
}

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
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [isStoryMenuOpen, setIsStoryMenuOpen] = useState<boolean>(false);

  const isAutoRotatingRef = useRef<boolean>(isAutoRotating);
  useEffect(() => {
    isAutoRotatingRef.current = isAutoRotating;
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 0.45;
  }, [isAutoRotating]);

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
    controls.autoRotate = isAutoRotatingRef.current;
    controls.autoRotateSpeed = 0.45;

    const stopAutoRotateOnDrag = () => {
      setIsAutoRotating(false);
    };
    controls.addEventListener('start', stopAutoRotateOnDrag);
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
        const storyYears = Array.from(new Set(storyCases.map((s) => s.year)));
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
            error: err instanceof Error ? err.message : 'Failed to load dataset',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const monthRows = useMemo(
    () => yearRows.filter((row) => row.month === selectedMonth),
    [yearRows, selectedMonth]
  );

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
      setIsAutoRotating(false);
      setActiveStory(story);
      setEmptyCellNotice(null);
      pendingStoryRef.current = story;
      onSelectYear(story.year);
      onSelectMonth(story.month);

      if (globeRef.current) {
        globeRef.current.pointOfView(
          { lat: story.lat, lng: story.lon, altitude: 1.45 },
          1000
        );
      }
    },
    [onSelectYear, onSelectMonth]
  );

  useEffect(() => {
    if (!isAutoTour) return;

    flyToStory(storyCases[tourIndexRef.current], tourIndexRef.current);

    const timer = window.setInterval(() => {
      const nextIdx = (tourIndexRef.current + 1) % storyCases.length;
      flyToStory(storyCases[nextIdx], nextIdx);
    }, 3400);

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
    const zScore = r.z_score;
    const zText =
      typeof zScore === 'number' && Number.isFinite(zScore)
        ? `${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}σ`
        : 'N/A';
    const levelLabel = ANOMALY_LABELS[r.anomaly_level] ?? r.anomaly_level;
    return `
      <div style="background:#0f172a;border:1px solid #334155;padding:8px 10px;border-radius:8px;font-family:sans-serif;font-size:12px;color:#f8fafc;box-shadow:0 10px 25px rgba(0,0,0,0.45);">
        <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">Cell ${r.grid_id} (${r.lat}°, ${r.lon}°)</div>
        <div>Hotspot Activity Index: <b>${r.activity_index?.toFixed(1)}</b></div>
        <div>Anomaly: <b>${levelLabel}</b> (${zText})</div>
        <div style="color:#94a3b8;font-size:11px;margin-top:3px;">Source: ${r.source} • Click to inspect history</div>
      </div>
    `;
  }, []);

  const handleTileClick = useCallback(
    (tile: object) => {
      setIsAutoTour(false);
      setIsAutoRotating(false);
      setEmptyCellNotice(null);
      onSelectCell(toCleanFireRow(tile as FireGridRow));
    },
    [onSelectCell]
  );

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      setIsAutoTour(false);
      setIsAutoRotating(false);
      const cellInfo = coordsToGridCell(lat, lng);
      const matchedRow = monthRows.find(
        (r) => r.grid_id === cellInfo.grid_id && r.activity_index > 0
      );

      if (matchedRow) {
        setEmptyCellNotice(null);
        onSelectCell(toCleanFireRow(matchedRow));
      } else {
        setEmptyCellNotice(cellInfo);
      }
    },
    [monthRows, onSelectCell]
  );

  const activeStoryIndex = activeStory
    ? storyCases.findIndex((s) => s.id === activeStory.id)
    : -1;

  return (
    <div
      lang="en"
      ref={containerRef}
      className="relative h-full w-full bg-slate-950 overflow-hidden select-none"
    >
      {/* Compact Top Floating HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: View Mode & Globe Controls */}
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-0.5 rounded-full bg-slate-900/85 p-1 border border-slate-800/90 backdrop-blur-md shadow-lg">
              <button
                onClick={() => setViewMode('anomaly')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'anomaly'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Anomaly
              </button>
              <button
                onClick={() => setViewMode('activity')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'activity'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                Activity
              </button>
            </div>

            {viewMode === 'anomaly' && (
              <button
                onClick={() => setShowNormalCells((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border backdrop-blur-md transition cursor-pointer ${
                  showNormalCells
                    ? 'bg-slate-800/90 border-slate-600 text-slate-100'
                    : 'bg-slate-900/80 border-slate-800/90 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle baseline (NORMAL) hotspot cells"
              >
                {showNormalCells ? (
                  <Eye className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                Normal
              </button>
            )}

            <button
              onClick={() => setIsAutoRotating((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border backdrop-blur-md transition cursor-pointer ${
                isAutoRotating
                  ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900/80 border-slate-800/90 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle gentle globe auto-rotation"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '10s' }} />
              Spin
            </button>
          </div>

          {/* Right: Story Drawer Trigger, Auto Tour & Cell Count */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1 rounded-full bg-slate-900/85 p-1 border border-slate-800/90 backdrop-blur-md shadow-lg">
              <button
                onClick={() => setIsStoryMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  isStoryMenuOpen || activeStory
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="h-3.5 w-3.5 text-orange-400" />
                Stories ({storyCases.length})
              </button>

              <button
                onClick={() => {
                  setIsStoryMenuOpen(false);
                  setIsAutoTour((prev) => !prev);
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  isAutoTour
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title="Auto-tour curated wildfire events"
              >
                {isAutoTour ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isAutoTour ? 'Stop' : 'Tour'}
              </button>
            </div>

            <div className="hidden sm:flex items-center rounded-full bg-slate-900/85 px-3 py-1.5 text-xs border border-slate-800/90 backdrop-blur-md text-slate-300 tabular-nums">
              {loading ? (
                <span className="text-orange-400">Loading {selectedYear}...</span>
              ) : error ? (
                <span className="text-red-400">{error}</span>
              ) : (
                <span>
                  <strong className="text-white">
                    {activeCells.length.toLocaleString('en-US')}
                  </strong>{' '}
                  cells
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Compact Collapsible Story Case Selector */}
        {isStoryMenuOpen && (
          <div className="self-end w-80 max-w-full rounded-2xl bg-slate-900/95 p-2.5 border border-slate-800 backdrop-blur-md shadow-2xl pointer-events-auto flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Curated Historical Events</span>
              <button
                onClick={() => setIsStoryMenuOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {storyCases.map((story, idx) => {
              const isSelected = activeStory?.id === story.id;
              return (
                <button
                  key={story.id}
                  onClick={() => {
                    setIsAutoTour(false);
                    setIsStoryMenuOpen(false);
                    flyToStory(story, idx);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500/20 border border-orange-500/40 text-orange-200'
                      : 'hover:bg-slate-800/80 text-slate-200 border border-transparent'
                  }`}
                >
                  <span className="font-medium truncate">{story.title}</span>
                  <span className="shrink-0 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                    {story.periodLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Story Spotlight Card */}
        {activeStory && !isStoryMenuOpen && (
          <div className="self-start max-w-sm rounded-2xl bg-slate-900/90 p-3 border border-orange-500/40 backdrop-blur-md shadow-xl pointer-events-auto text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-orange-400 truncate">
                {activeStory.title}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                  {activeStory.periodLabel}
                </span>
                <button
                  onClick={() => {
                    setIsAutoTour(false);
                    setActiveStory(null);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Close story card"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {activeStory.summary}
            </p>

            {storyCases.length > 1 && activeStoryIndex >= 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400 tabular-nums">
                  Case {activeStoryIndex + 1} of {storyCases.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setIsAutoTour(false);
                      const prevIdx =
                        (activeStoryIndex - 1 + storyCases.length) %
                        storyCases.length;
                      flyToStory(storyCases[prevIdx], prevIdx);
                    }}
                    className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-slate-200 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoTour(false);
                      const nextIdx = (activeStoryIndex + 1) % storyCases.length;
                      flyToStory(storyCases[nextIdx], nextIdx);
                    }}
                    className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-slate-200 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unverified Zero / Empty Cell Notice */}
        {emptyCellNotice && (
          <div className="self-start flex items-center gap-2.5 rounded-full bg-slate-900/90 px-3.5 py-1.5 border border-cyan-500/40 backdrop-blur-md shadow-lg pointer-events-auto text-xs text-slate-200">
            <span>
              Cell <strong className="text-cyan-400">{emptyCellNotice.grid_id}</strong> ({emptyCellNotice.lat}°, {emptyCellNotice.lon}°):{' '}
              No detections in {MONTH_SHORT[selectedMonth - 1]} {selectedYear} (unverified zero / out of bounds).
            </span>
            <button
              onClick={() => setEmptyCellNotice(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3D Interactive Globe */}
      <Globe
        ref={globeRef}
        onGlobeReady={handleGlobeReady}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="/textures/earth-blue-marble.jpg"
        bumpImageUrl="/textures/earth-topology.png"
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

      {/* Sleek Centered Bottom Timeline & Legend Dock */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl rounded-2xl bg-slate-900/85 px-3.5 py-2.5 border border-slate-800/90 backdrop-blur-md shadow-2xl pointer-events-auto flex flex-col gap-2">
          {/* Single-Row Year & Month Scrubbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Year Control */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 w-9 shrink-0">
                Year
              </span>
              <button
                onClick={() => {
                  setIsAutoTour(false);
                  setEmptyCellNotice(null);
                  onSelectYear(Math.max(2000, selectedYear - 1));
                }}
                disabled={selectedYear <= 2000}
                className="rounded-md bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 p-1 text-slate-300 cursor-pointer"
                title="Previous year"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
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
                className="flex-1 accent-orange-500 cursor-pointer h-1.5"
              />
              <button
                onClick={() => {
                  setIsAutoTour(false);
                  setEmptyCellNotice(null);
                  onSelectYear(Math.min(2026, selectedYear + 1));
                }}
                disabled={selectedYear >= 2026}
                className="rounded-md bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 p-1 text-slate-300 cursor-pointer"
                title="Next year"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-bold font-mono text-orange-400 w-11 text-right tabular-nums shrink-0">
                {selectedYear}
              </span>
            </div>

            {/* Month Control */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 w-11 shrink-0">
                Month
              </span>
              <button
                onClick={() => {
                  setIsAutoTour(false);
                  setEmptyCellNotice(null);
                  onSelectMonth(selectedMonth === 1 ? 12 : selectedMonth - 1);
                }}
                className="rounded-md bg-slate-800/90 hover:bg-slate-700 p-1 text-slate-300 cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
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
                className="flex-1 accent-orange-500 cursor-pointer h-1.5"
              />
              <button
                onClick={() => {
                  setIsAutoTour(false);
                  setEmptyCellNotice(null);
                  onSelectMonth(selectedMonth === 12 ? 1 : selectedMonth + 1);
                }}
                className="rounded-md bg-slate-800/90 hover:bg-slate-700 p-1 text-slate-300 cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-bold text-orange-400 w-20 text-right truncate shrink-0">
                {MONTH_NAMES[selectedMonth - 1]}
              </span>
            </div>
          </div>

          {/* Compact Legend & Scope Disclaimer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400">
            {viewMode === 'anomaly' ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#2563eb]" /> Very Low</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#38bdf8]" /> Low</span>
                {showNormalCells && (
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#94a3b8]" /> Normal</span>
                )}
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#f97316]" /> High</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#ef4444]" /> Very High</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#64748b]" /> Limited Baseline</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#4c1d95]" /> &lt;5</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#9333ea]" /> 5–25</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#e11d48]" /> 25–100</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#fb923c]" /> 100–500</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#fef08a]" /> 500+</span>
              </div>
            )}

            <span
              className="flex items-center gap-1 text-slate-400 cursor-help"
              title="Calibrated hotspot detection count (not burned area or fire severity). Dataset bounds: 57.8°S–38.9°N lat, 120.6°W–180.0°E lon (partial through Oct 2026)."
            >
              <Info className="h-3 w-3 text-slate-500 shrink-0" />
              {selectedYear === 2026 ? 'Through Oct 2026 • ' : ''}
              57.8°S–38.9°N, 120.6°W–180°E
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}