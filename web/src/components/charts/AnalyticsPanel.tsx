import { useState, useMemo } from 'react';
import type * as echarts from 'echarts';
import {
  Globe2,
  Loader2,
  AlertCircle,
  Download,
  Flame,
  TrendingUp,
  CalendarCheck2,
  AlertTriangle,
  Filter,
  RotateCcw,
  Calendar,
  BarChart3,
  BellRing,
  MapPin,
} from 'lucide-react';
import type { AnomalyLevel, FireDataRow } from '../../types/fireData';
import { downloadRegionSummaryCsv } from '../../services/csvExport';
import {
  analyzeCellSeasonality,
  buildZeroFilledChronologicalSeries,
  DATASET_END_YEAR,
  DATASET_START_YEAR,
  isWithinObservationWindow,
  MONTH_SHORT,
} from '../../utils/seasonality';
import EChartBox from './EChartBox';
import RiskCalendarCard from './RiskCalendarCard';
import EmailAlertSimulation from './EmailAlertSimulation';
import FireStationsPanel from './FireStationsPanel';

interface AnalyticsPanelProps {
  selectedCell?: FireDataRow | null;
  selectedCellData: FireDataRow[];
  regionTitle?: string;
  loading?: boolean;
  error?: string | null;
  selectedYear?: number;
  selectedMonth?: number;
}

type RadialMetric = 'mean' | 'median';
type PanelTab = 'calendar' | 'charts' | 'alerts' | 'stations';

interface HeatmapPoint {
  value: [number, number, number | '-'];
  hasPositiveRecord: boolean;
  activityIndex: number;
  zScore: number | null;
  anomalyLevel: AnomalyLevel;
  year: number;
  month: number;
  inWindow: boolean;
}

const ANOMALY_LABELS: Record<AnomalyLevel, string> = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
  VERY_LOW: 'Very Low',
  INSUFFICIENT_DATA: 'Insufficient History',
  UNVERIFIED_ZERO: 'Unverified Zero (Imputed)',
};

function formatAnomalyLabel(level: string): string {
  return ANOMALY_LABELS[level as AnomalyLevel] ?? level;
}

export default function AnalyticsPanel({
  selectedCell = null,
  selectedCellData,
  regionTitle = 'selected-region',
  loading = false,
  error = null,
}: AnalyticsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('calendar');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('all');
  const [radialMetric, setRadialMetric] = useState<RadialMetric>('mean');

  const positiveRows = useMemo(
    () => selectedCellData.filter((r) => r.activity_index > 0),
    [selectedCellData]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(positiveRows.map((r) => r.year)));
    return years.sort((a, b) => b - a);
  }, [positiveRows]);

  const effectiveFilterYear =
    filterYear === 'all' || availableYears.includes(Number(filterYear))
      ? filterYear
      : 'all';

  const hasActiveFilters =
    effectiveFilterYear !== 'all' || filterAnomaly !== 'all';

  const filteredData = useMemo(() => {
    return positiveRows.filter((row) => {
      const passYear =
        effectiveFilterYear === 'all' ||
        row.year.toString() === effectiveFilterYear;
      const passAnomaly =
        filterAnomaly === 'all' ||
        (filterAnomaly === 'high_plus' &&
          (row.anomaly_level === 'HIGH' || row.anomaly_level === 'VERY_HIGH')) ||
        (filterAnomaly === 'very_high' && row.anomaly_level === 'VERY_HIGH') ||
        (filterAnomaly === 'low_minus' &&
          (row.anomaly_level === 'LOW' || row.anomaly_level === 'VERY_LOW'));
      return passYear && passAnomaly;
    });
  }, [positiveRows, effectiveFilterYear, filterAnomaly]);

  const summaryStats = useMemo(() => {
    let peakRow: FireDataRow | null = null;
    let maxZRow: FireDataRow | null = null;
    let highPlusCount = 0;

    for (const row of positiveRows) {
      if (!peakRow || row.activity_index > peakRow.activity_index) {
        peakRow = row;
      }
      if (
        typeof row.z_score === 'number' &&
        Number.isFinite(row.z_score) &&
        (!maxZRow ||
          typeof maxZRow.z_score !== 'number' ||
          row.z_score > maxZRow.z_score)
      ) {
        maxZRow = row;
      }
      if (row.anomaly_level === 'HIGH' || row.anomaly_level === 'VERY_HIGH') {
        highPlusCount += 1;
      }
    }

    return {
      peakRow,
      maxZRow,
      highPlusCount,
      positiveCount: positiveRows.length,
    };
  }, [positiveRows]);

  const seasonalityReport = useMemo(
    () => analyzeCellSeasonality(selectedCellData),
    [selectedCellData]
  );

  const chronologicalSeries = useMemo(
    () => buildZeroFilledChronologicalSeries(selectedCellData),
    [selectedCellData]
  );

  const filteredSeasonality = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      return seasonalityReport.monthlyStats;
    }
    const targetYear = Number(effectiveFilterYear);
    return seasonalityReport.monthlyStats.map((stat) => {
      const inWin = isWithinObservationWindow(targetYear, stat.month);
      const matched = positiveRows.find(
        (r) => r.year === targetYear && r.month === stat.month
      );
      const val =
        inWin && matched ? Math.round(matched.activity_index * 10) / 10 : 0;
      return {
        ...stat,
        meanActivity: val,
        medianActivity: val,
      };
    });
  }, [effectiveFilterYear, seasonalityReport.monthlyStats, positiveRows]);

  const calendarHeatmap = useMemo(() => {
    const years = Array.from(
      { length: DATASET_END_YEAR - DATASET_START_YEAR + 1 },
      (_, i) => DATASET_START_YEAR + i
    );
    const yearLabels = years.map(String);
    const rowMap = new Map<string, FireDataRow>();

    for (const row of selectedCellData) {
      rowMap.set(`${row.year}-${row.month}`, row);
    }

    let maxActivity = 10;
    const points: HeatmapPoint[] = [];

    years.forEach((year, yIdx) => {
      for (let month = 1; month <= 12; month += 1) {
        const mIdx = month - 1;
        const inWindow = isWithinObservationWindow(year, month);
        if (!inWindow) {
          points.push({
            value: [mIdx, yIdx, '-'],
            hasPositiveRecord: false,
            activityIndex: 0,
            zScore: null,
            anomalyLevel: 'UNVERIFIED_ZERO',
            year,
            month,
            inWindow: false,
          });
          continue;
        }

        const matched = rowMap.get(`${year}-${month}`);
        const isPositive = Boolean(matched && matched.activity_index > 0);
        const val =
          isPositive && matched
            ? Math.round(matched.activity_index * 10) / 10
            : 0;
        if (val > maxActivity) maxActivity = val;

        points.push({
          value: [mIdx, yIdx, val],
          hasPositiveRecord: isPositive,
          activityIndex: val,
          zScore: isPositive && matched ? matched.z_score : null,
          anomalyLevel:
            isPositive && matched ? matched.anomaly_level : 'UNVERIFIED_ZERO',
          year,
          month,
          inWindow: true,
        });
      }
    });

    return { yearLabels, points, maxActivity };
  }, [selectedCellData]);

  const activityTimelineOption = useMemo<echarts.EChartsOption>(() => {
    const displaySeries =
      effectiveFilterYear === 'all'
        ? chronologicalSeries
        : chronologicalSeries.filter(
            (pt) => pt.year === Number(effectiveFilterYear)
          );

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Calibrated Hotspot Activity Index (2000–2026)',
        subtext: 'Zero-filled monthly timeline across MODIS & harmonized VIIRS sensors',
        textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 600 },
        subtextStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        left: 0,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const item = list[0] as
            | {
                data?: {
                  periodLabel: string;
                  value: number;
                  anomalyLevel: AnomalyLevel;
                  source: string;
                };
              }
            | undefined;
          if (!item || !item.data) return '';
          const { periodLabel, value, anomalyLevel, source } = item.data;
          const levelText = formatAnomalyLabel(anomalyLevel);
          const extraNote =
            anomalyLevel === 'UNVERIFIED_ZERO'
              ? '<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Imputed zero for missing month; does not confirm absence of fire.</div>'
              : `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Sensor Source: ${source}</div>`;
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${periodLabel}</div>
              <div>Activity Index: <b>${value}</b></div>
              <div>Status: <b>${levelText}</b></div>
              ${extraNote}
            </div>
          `;
        },
      },
      grid: { top: 52, bottom: 48, left: 42, right: 16 },
      xAxis: {
        type: 'category',
        data: displaySeries.map((pt) => pt.label),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      dataZoom: [
        { type: 'inside' },
        {
          type: 'slider',
          height: 16,
          bottom: 4,
          borderColor: '#334155',
          fillerColor: 'rgba(56, 189, 248, 0.18)',
          textStyle: { color: '#94a3b8', fontSize: 10 },
        },
      ],
      series: [
        {
          name: 'Activity Index',
          type: 'bar',
          data: displaySeries.map((pt) => ({
            value: pt.activityIndex,
            periodLabel: pt.label,
            anomalyLevel: pt.anomalyLevel,
            source: pt.source,
            itemStyle: {
              borderRadius: [2, 2, 0, 0],
              color:
                pt.anomalyLevel === 'VERY_HIGH'
                  ? '#ef4444'
                  : pt.anomalyLevel === 'HIGH'
                  ? '#f97316'
                  : '#38bdf8',
            },
          })),
        },
      ],
    };
  }, [chronologicalSeries, effectiveFilterYear]);

  const radialOption = useMemo<echarts.EChartsOption>(() => {
    const activeRadialValues = filteredSeasonality.map((m) =>
      radialMetric === 'mean' ? m.meanActivity : m.medianActivity
    );
    const maxRadialVal = Math.max(...activeRadialValues);

    return {
      backgroundColor: 'transparent',
      title: {
        text: `Seasonal Cycle (${radialMetric === 'mean' ? 'Zero-Filled Mean' : 'Median'})`,
        subtext: 'Monthly climatological distribution across observation years',
        textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 600 },
        subtextStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        left: 0,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { dataIndex?: number };
          const idx = p.dataIndex ?? 0;
          const stat = filteredSeasonality[idx];
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${stat.fullName}</div>
              <div>Mean Activity Index: <b>${stat.meanActivity}</b></div>
              <div>Median Activity Index: <b>${stat.medianActivity}</b></div>
              <div>Positive Detection Frequency: <b>${stat.frequencyPercent}%</b> (${stat.activeYears}/${stat.totalObservedYears} yrs)</div>
            </div>
          `;
        },
      },
      angleAxis: {
        type: 'category',
        data: MONTH_SHORT,
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      radiusAxis: {
        min: 0,
        axisLabel: { color: '#64748b', fontSize: 10, showMaxLabel: false },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      polar: { radius: '56%', center: ['50%', '58%'] },
      series: [
        {
          type: 'bar',
          coordinateSystem: 'polar',
          data: activeRadialValues.map((val) => ({
            value: val,
            itemStyle: {
              color: val === maxRadialVal && val > 0 ? '#f97316' : '#38bdf8',
            },
          })),
        },
      ],
    };
  }, [radialMetric, filteredSeasonality]);

  const anomalyOption = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Statistical Anomaly Indicator (LOYO Z-Score, Clamped ±5)',
        subtext: 'Leave-One-Year-Out log-transformed deviation from same-month baseline',
        textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 600 },
        subtextStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        left: 0,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const item = list[0] as
            | {
                name?: string;
                data?: { rawScore: number | null; anomalyLevel: AnomalyLevel };
              }
            | undefined;
          if (!item || !item.data) return '';
          const { rawScore, anomalyLevel } = item.data;
          const isNumeric =
            typeof rawScore === 'number' && Number.isFinite(rawScore);
          const scoreLabel = !isNumeric
            ? 'Not computed (Insufficient history)'
            : `${rawScore.toFixed(2)}${Math.abs(rawScore) > 5 ? ' (clamped to ±5 in chart)' : ''}`;
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${item.name ?? ''}</div>
              <div>Exact LOYO Z-Score: <b>${scoreLabel}</b></div>
              <div>Classification: <b>${formatAnomalyLabel(anomalyLevel)}</b></div>
            </div>
          `;
        },
      },
      grid: { top: 52, bottom: 48, left: 38, right: 16 },
      xAxis: {
        type: 'category',
        data: filteredData.map((r) => `${MONTH_SHORT[r.month - 1]} ${r.year}`),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        min: -5,
        max: 5,
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      dataZoom: [
        { type: 'inside' },
        {
          type: 'slider',
          height: 16,
          bottom: 4,
          borderColor: '#334155',
          fillerColor: 'rgba(249, 115, 22, 0.18)',
          textStyle: { color: '#94a3b8', fontSize: 10 },
        },
      ],
      series: [
        {
          type: 'bar',
          data: filteredData.map((r) => {
            const rawScore = r.z_score;
            const isNumeric =
              typeof rawScore === 'number' && Number.isFinite(rawScore);
            const clamped = !isNumeric
              ? 0
              : Math.max(-5, Math.min(5, rawScore));
            return {
              value: clamped,
              rawScore: isNumeric ? rawScore : null,
              anomalyLevel: r.anomaly_level,
              itemStyle: {
                borderRadius: clamped >= 0 ? [2, 2, 0, 0] : [0, 0, 2, 2],
                color: !isNumeric
                  ? '#475569'
                  : rawScore >= 0
                  ? '#ef4444'
                  : '#3b82f6',
              },
            };
          }),
        },
      ],
    };
  }, [filteredData]);

  const heatmapOption = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Fire Activity Calendar Heatmap (Year × Month)',
        subtext: 'Multi-decadal seasonal matrix (Nov 2000 – Oct 2026)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 600 },
        subtextStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        left: 0,
      },
      tooltip: {
        position: 'top',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { data?: HeatmapPoint };
          if (!p.data) return '';
          const {
            year,
            month,
            inWindow,
            hasPositiveRecord,
            activityIndex,
            zScore,
            anomalyLevel,
          } = p.data;
          if (!inWindow) {
            return `<div><b>${MONTH_SHORT[month - 1]} ${year}</b><br/><span style="color:#94a3b8;">Outside observation window</span></div>`;
          }
          if (!hasPositiveRecord) {
            return `
              <div>
                <div style="font-weight:700;color:#94a3b8;margin-bottom:3px;">${MONTH_SHORT[month - 1]} ${year}</div>
                <div>Activity Index: <b>0</b> (UNVERIFIED_ZERO)</div>
                <div style="color:#94a3b8;font-size:11px;">Imputed zero for missing month; not confirmed absence of fire.</div>
              </div>
            `;
          }
          const isNumeric =
            typeof zScore === 'number' && Number.isFinite(zScore);
          const zStr = isNumeric ? zScore.toFixed(2) : 'N/A';
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:3px;">${MONTH_SHORT[month - 1]} ${year}</div>
              <div>Activity Index: <b>${activityIndex.toFixed(1)}</b></div>
              <div>Anomaly: <b>${formatAnomalyLabel(anomalyLevel)}</b> (Z: ${zStr})</div>
            </div>
          `;
        },
      },
      grid: { top: 50, bottom: 52, left: 44, right: 16 },
      xAxis: {
        type: 'category',
        data: MONTH_SHORT,
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: calendarHeatmap.yearLabels,
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      visualMap: {
        min: 0,
        max: calendarHeatmap.maxActivity,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 110,
        textStyle: { color: '#94a3b8', fontSize: 10 },
        inRange: {
          color: ['#0f172a', '#1e3a8a', '#38bdf8', '#facc15', '#f97316', '#dc2626'],
        },
      },
      series: [
        {
          name: 'Activity Index',
          type: 'heatmap',
          data: calendarHeatmap.points as unknown as Array<{
            value: [number, number, number | '-'];
          }>,
          itemStyle: {
            borderColor: '#020617',
            borderWidth: 1,
          },
        },
      ],
    };
  }, [calendarHeatmap]);

  if (!selectedCell && selectedCellData.length === 0) {
    return (
      <div
        lang="en"
        className="bg-slate-950/90 text-white p-6 rounded-xl border border-slate-800/90 flex flex-col items-center justify-center text-center gap-5 h-full relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_65%)] pointer-events-none" />
        <div className="relative rounded-2xl bg-slate-900 p-4 border border-slate-800 shadow-lg shadow-orange-950/20">
          <Globe2 className="h-9 w-9 text-orange-400" />
        </div>
        <div className="relative max-w-sm space-y-2">
          <span className="inline-block rounded-full bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 text-[11px] font-medium text-orange-300">
            NASA FIRMS • 2000–2026 Archive
          </span>
          <h2 className="text-lg font-semibold text-slate-100 tracking-tight">
            Regional Time-Series &amp; Seasonality Explorer
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click any <strong className="text-slate-200">2°×2° grid cell</strong> on the 3D globe or pick a curated case in{' '}
            <strong className="text-orange-300">Story Mode</strong> to inspect 26 years of hotspot activity, climatological seasonality, and LOYO anomalies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      lang="en"
      className="bg-slate-950/95 text-white p-4 rounded-xl border border-slate-800/90 flex flex-col gap-3.5 h-full overflow-y-auto"
    >
      {/* Pinned Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/90 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-100">
              Grid Cell Analysis {selectedCell ? `— ${selectedCell.grid_id}` : ''}
            </h2>
            {selectedCell && (
              <span className="rounded-md bg-slate-900 border border-slate-700/80 px-2 py-0.5 text-[11px] font-mono text-cyan-300">
                {selectedCell.lat}°, {selectedCell.lon}°
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {loading
              ? 'Loading 2000–2026 cell history...'
              : `${positiveRows.length} positive detection months (Nov 2000 – Oct 2026)`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {hasActiveFilters && (
            <button
              onClick={() => downloadRegionSummaryCsv(filteredData, `${regionTitle}-filtered`)}
              disabled={loading || filteredData.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-medium rounded-lg border border-slate-700 text-slate-200 transition cursor-pointer"
              title="Download only filtered records as CSV"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              Filtered ({filteredData.length})
            </button>
          )}
          <button
            onClick={() => downloadRegionSummaryCsv(selectedCellData, `${regionTitle}-2000-2026`)}
            disabled={loading || selectedCellData.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-semibold rounded-lg shadow-sm shadow-orange-950/50 transition cursor-pointer"
            title="Download full 2000–2026 cell history as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs text-orange-300">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Loading multi-decadal cell series (2000–2026)...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Pinned Quick KPI Summary Strip */}
      {!loading && positiveRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              <Flame className="h-3 w-3 text-orange-400" />
              Peak Activity
            </div>
            <div className="mt-1 text-sm font-bold text-slate-100 tabular-nums">
              {summaryStats.peakRow ? summaryStats.peakRow.activity_index.toFixed(1) : '—'}
            </div>
            <div className="text-[10px] text-slate-400">
              {summaryStats.peakRow
                ? `${MONTH_SHORT[summaryStats.peakRow.month - 1]} ${summaryStats.peakRow.year}`
                : 'No detections'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-3 w-3 text-red-400" />
              Peak Z-Score
            </div>
            <div className="mt-1 text-sm font-bold text-slate-100 tabular-nums">
              {summaryStats.maxZRow && typeof summaryStats.maxZRow.z_score === 'number'
                ? `${summaryStats.maxZRow.z_score >= 0 ? '+' : ''}${summaryStats.maxZRow.z_score.toFixed(2)}σ`
                : '—'}
            </div>
            <div className="text-[10px] text-slate-400">
              {summaryStats.maxZRow
                ? `${MONTH_SHORT[summaryStats.maxZRow.month - 1]} ${summaryStats.maxZRow.year}`
                : 'Insufficient baseline'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              <CalendarCheck2 className="h-3 w-3 text-cyan-400" />
              Active Months
            </div>
            <div className="mt-1 text-sm font-bold text-slate-100 tabular-nums">
              {summaryStats.positiveCount}{' '}
              <span className="text-xs font-normal text-slate-400">/ 312</span>
            </div>
            <div className="text-[10px] text-slate-400">Positive hotspot months</div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              High+ Anomalies
            </div>
            <div className="mt-1 text-sm font-bold text-slate-100 tabular-nums">
              {summaryStats.highPlusCount}
            </div>
            <div className="text-[10px] text-slate-400">High &amp; Very High months</div>
          </div>
        </div>
      )}

      {/* Segmented Section Tabs */}
      <div
        role="tablist"
        aria-label="Analysis sections"
        className="grid grid-cols-4 gap-1 rounded-xl border border-slate-800/90 bg-slate-900/90 p-1 shrink-0"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Risk Calendar</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'charts'}
          onClick={() => setActiveTab('charts')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'charts'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Charts</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'alerts'}
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <BellRing className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Alert Sim</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'stations'}
          onClick={() => setActiveTab('stations')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'stations'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Fire Stations</span>
        </button>
      </div>

      {/* Tab 1: 12-Month Risk Calendar & Periodicity */}
      {activeTab === 'calendar' && !loading && (
        <RiskCalendarCard report={seasonalityReport} />
      )}

      {/* Tab 2: Filters & 4 Interactive Visualizations */}
      {activeTab === 'charts' && (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 p-2.5 text-xs">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 px-1">
              <Filter className="h-3.5 w-3.5 text-orange-400" />
              Filter:
            </span>

            <select
              value={effectiveFilterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[130px] outline-none focus:border-orange-500"
            >
              <option value="all">All Years ({availableYears.length} active yrs)</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  Year {y}
                </option>
              ))}
            </select>

            <select
              value={filterAnomaly}
              onChange={(e) => setFilterAnomaly(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[150px] outline-none focus:border-orange-500"
            >
              <option value="all">All Anomaly Levels</option>
              <option value="high_plus">High + Very High</option>
              <option value="very_high">Very High Only</option>
              <option value="low_minus">Low + Very Low</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterYear('all');
                  setFilterAnomaly('all');
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                title="Reset chart filters"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5 shrink-0">
            <div className="w-full h-[240px]">
              <EChartBox option={activityTimelineOption} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5 shrink-0">
            <div className="w-full h-[350px]">
              <EChartBox option={heatmapOption} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5 flex flex-col gap-2 shrink-0">
            <div className="flex justify-end">
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                <button
                  onClick={() => setRadialMetric('mean')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                    radialMetric === 'mean'
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mean
                </button>
                <button
                  onClick={() => setRadialMetric('median')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                    radialMetric === 'median'
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Median
                </button>
              </div>
            </div>
            <div className="w-full h-[245px]">
              <EChartBox option={radialOption} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5 shrink-0">
            <div className="w-full h-[240px]">
              <EChartBox option={anomalyOption} />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Threshold Alert Notification Preview */}
      {activeTab === 'alerts' && (
        <EmailAlertSimulation
          regionTitle={regionTitle}
          selectedCellData={selectedCellData}
        />
      )}

      {/* Tab 4: Nearest Reference Fire Stations */}
      {activeTab === 'stations' && selectedCell && (
        <FireStationsPanel cellLat={selectedCell.lat} cellLon={selectedCell.lon} />
      )}
    </div>
  );
}