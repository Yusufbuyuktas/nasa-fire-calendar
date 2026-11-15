import { useState, useMemo } from 'react';
import type * as echarts from 'echarts';
import { Globe2, Loader2, AlertCircle, Download } from 'lucide-react';
import type { FireDataRow } from '../../types/fireData';
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

interface HeatmapPoint {
  value: [number, number, number | '-'];
  hasRecord: boolean;
  activityIndex: number;
  zScore: number | null;
  anomalyLevel: string;
  year: number;
  month: number;
  inWindow: boolean;
}

export default function AnalyticsPanel({
  selectedCell = null,
  selectedCellData,
  regionTitle = 'secili-bolge',
  loading = false,
  error = null,
}: AnalyticsPanelProps) {
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('all');
  const [radialMetric, setRadialMetric] = useState<RadialMetric>('mean');

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(selectedCellData.map((r) => r.year)));
    return years.sort((a, b) => b - a);
  }, [selectedCellData]);

  const effectiveFilterYear =
    filterYear === 'all' || availableYears.includes(Number(filterYear))
      ? filterYear
      : 'all';

  const filteredData = useMemo(() => {
    return selectedCellData.filter((row) => {
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
  }, [selectedCellData, effectiveFilterYear, filterAnomaly]);

  // E1: 2000–2026 Mevsimsellik ve Periyodiklik Raporu
  const seasonalityReport = useMemo(
    () => analyzeCellSeasonality(selectedCellData),
    [selectedCellData]
  );

  // E2: 2000–2026 Sıfır Doldurmalı Tam Kronolojik Aktivite Serisi
  const chronologicalSeries = useMemo(
    () => buildZeroFilledChronologicalSeries(selectedCellData),
    [selectedCellData]
  );

  // D4: Seçili yıl filtresine göre sıfır doldurmalı aylık istatistikler
  const filteredSeasonality = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      return seasonalityReport.monthlyStats;
    }
    const targetYear = Number(effectiveFilterYear);
    return analyzeCellSeasonality(
      selectedCellData.filter((r) => r.year === targetYear)
    ).monthlyStats.map((stat) => {
      const inWin = isWithinObservationWindow(targetYear, stat.month);
      const matched = selectedCellData.find(
        (r) => r.year === targetYear && r.month === stat.month
      );
      const val = inWin && matched ? Math.round(matched.activity_index * 10) / 10 : 0;
      return {
        ...stat,
        meanActivity: val,
        medianActivity: val,
      };
    });
  }, [effectiveFilterYear, seasonalityReport.monthlyStats, selectedCellData]);

  // D1: Gerçek Yıl × Ay takvim ısı haritası verisi
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
            hasRecord: false,
            activityIndex: 0,
            zScore: null,
            anomalyLevel: 'OUT_OF_WINDOW',
            year,
            month,
            inWindow: false,
          });
          continue;
        }

        const matched = rowMap.get(`${year}-${month}`);
        const val = matched ? Math.round(matched.activity_index * 10) / 10 : 0;
        if (val > maxActivity) maxActivity = val;

        points.push({
          value: [mIdx, yIdx, val],
          hasRecord: Boolean(matched),
          activityIndex: val,
          zScore: matched?.z_score ?? null,
          anomalyLevel: matched?.anomaly_level ?? 'NO_DETECTION',
          year,
          month,
          inWindow: true,
        });
      }
    });

    return { yearLabels, points, maxActivity };
  }, [selectedCellData]);

  // E2: 2000–2026 Tam Zaman Serisi Aktivite Grafiği
  const activityTimelineOption = useMemo<echarts.EChartsOption>(() => {
    const displaySeries =
      effectiveFilterYear === 'all'
        ? chronologicalSeries
        : chronologicalSeries.filter((pt) => pt.year === Number(effectiveFilterYear));

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Activity Index Time Series (2000–2026)',
        textStyle: { color: '#f3f4f6', fontSize: 13 },
        top: 0,
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
                  anomalyLevel: string;
                  source: string;
                };
              }
            | undefined;
          if (!item || !item.data) return '';
          const { periodLabel, value, anomalyLevel, source } = item.data;
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${periodLabel}</div>
              <div>Activity Index: <b>${value}</b></div>
              <div>Anomaly: <b>${anomalyLevel}</b></div>
              <div style="color:#94a3b8;font-size:11px;">Resource: ${source}</div>
            </div>
          `;
        },
      },
      grid: { top: 42, bottom: 48, left: 42, right: 16 },
      xAxis: {
        type: 'category',
        data: displaySeries.map((pt) => pt.label),
        axisLabel: { color: '#9ca3af', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { lineStyle: { color: '#374151' } },
      },
      dataZoom: [
        { type: 'inside' },
        {
          type: 'slider',
          height: 16,
          bottom: 4,
          borderColor: '#334155',
          fillerColor: 'rgba(56, 189, 248, 0.2)',
          textStyle: { color: '#9ca3af', fontSize: 10 },
        },
      ],
      series: [
        {
          name: 'Aktivite İndeksi',
          type: 'bar',
          data: displaySeries.map((pt) => ({
            value: pt.activityIndex,
            periodLabel: pt.label,
            anomalyLevel: pt.anomalyLevel,
            source: pt.source,
            itemStyle: {
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

  // D4: Radyal Mevsimsellik Grafiği Ayarları
  const radialOption = useMemo<echarts.EChartsOption>(() => {
    const activeRadialValues = filteredSeasonality.map((m) =>
      radialMetric === 'mean' ? m.meanActivity : m.medianActivity
    );
    const maxRadialVal = Math.max(...activeRadialValues);

    return {
      backgroundColor: 'transparent',
      title: {
        text: `Seasonality (${radialMetric === 'mean' ? 'Zero-Filled Mean' : 'Median'})`,
        textStyle: { color: '#f3f4f6', fontSize: 13 },
        top: 0,
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
              <div>Mean Activity: <b>${stat.meanActivity}</b></div>
              <div>Meadian Activity: <b>${stat.medianActivity}</b></div>
              <div>Historical Frequency of Occurrence: <b>%${stat.frequencyPercent}</b> (${stat.activeYears}/${stat.totalObservedYears} yıl)</div>
            </div>
          `;
        },
      },
      angleAxis: {
        type: 'category',
        data: MONTH_SHORT,
        axisLabel: { color: '#9ca3af', fontSize: 11 },
      },
      radiusAxis: {
        min: 0,
        axisLabel: { color: '#6b7280', fontSize: 10, showMaxLabel: false },
        splitLine: { lineStyle: { color: '#374151' } },
      },
      polar: { radius: '58%', center: ['50%', '56%'] },
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

  // D2: Z-Skoru Zaman Serisi (±5 aralığına kırpılmış, gerçek değer tooltip'te)
  const anomalyOption = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Indicator of Anomaly (Z-Score time series, ±5 should be trimmed)',
        textStyle: { color: '#f3f4f6', fontSize: 13 },
        top: 0,
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
                data?: { rawScore: number | null; anomalyLevel: string };
              }
            | undefined;
          if (!item || !item.data) return '';
          const { rawScore, anomalyLevel } = item.data;
          const scoreLabel =
            rawScore === null
              ? 'Could not be calculated (nsufficient History)'
              : `${rawScore.toFixed(2)}${Math.abs(rawScore) > 5 ? ' (±5 is trimmed from graphic.)' : ''}`;
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${item.name ?? ''}</div>
              <div>Real Z-Score: <b>${scoreLabel}</b></div>
              <div>Level: <b>${anomalyLevel}</b></div>
            </div>
          `;
        },
      },
      grid: { top: 42, bottom: 48, left: 38, right: 16 },
      xAxis: {
        type: 'category',
        data: filteredData.map((r) => `${MONTH_SHORT[r.month - 1]} ${r.year}`),
        axisLabel: { color: '#9ca3af', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: -5,
        max: 5,
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { lineStyle: { color: '#374151' } },
      },
      dataZoom: [
        { type: 'inside' },
        {
          type: 'slider',
          height: 16,
          bottom: 4,
          borderColor: '#334155',
          fillerColor: 'rgba(249, 115, 22, 0.2)',
          textStyle: { color: '#9ca3af', fontSize: 10 },
        },
      ],
      series: [
        {
          type: 'bar',
          data: filteredData.map((r) => {
            const rawScore = r.z_score;
            const clamped =
              rawScore === null ? 0 : Math.max(-5, Math.min(5, rawScore));
            return {
              value: clamped,
              rawScore,
              anomalyLevel: r.anomaly_level,
              itemStyle: {
                color:
                  rawScore === null
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

  // D1: Gerçek Yıl × Ay Takvim Isı Haritası
  const heatmapOption = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Fire Calendar Heat Map (Year × Month)',
        textStyle: { color: '#f3f4f6', fontSize: 13 },
        top: 0,
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
            hasRecord,
            activityIndex,
            zScore,
            anomalyLevel,
          } = p.data;
          if (!inWindow) {
            return `<div><b>${MONTH_SHORT[month - 1]} ${year}</b><br/><span style="color:#94a3b8;">Out of Observation Window</span></div>`;
          }
          if (!hasRecord) {
            return `<div><b>${MONTH_SHORT[month - 1]} ${year}</b><br/>Activity Index: <b>0</b> (No detection)</div>`;
          }
          const zStr = zScore !== null ? zScore.toFixed(2) : 'Yok';
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:3px;">${MONTH_SHORT[month - 1]} ${year}</div>
              <div>Activity Index: <b>${activityIndex.toFixed(1)}</b></div>
              <div>Anomaly: <b>${anomalyLevel}</b> (Z: ${zStr})</div>
            </div>
          `;
        },
      },
      grid: { top: 38, bottom: 52, left: 44, right: 16 },
      xAxis: {
        type: 'category',
        data: MONTH_SHORT,
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: calendarHeatmap.yearLabels,
        axisLabel: { color: '#9ca3af', fontSize: 10 },
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
        textStyle: { color: '#9ca3af', fontSize: 10 },
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

  // C6: Hücre seçilmediyse boş karşılama ekranı göster
  if (!selectedCell && selectedCellData.length === 0) {
    return (
      <div className="bg-gray-900/95 text-white p-6 rounded-xl border border-gray-800 flex flex-col items-center justify-center text-center gap-4 h-full">
        <div className="rounded-full bg-slate-800/80 p-4 border border-slate-700">
          <Globe2 className="h-8 w-8 text-orange-400" />
        </div>
        <div className="max-w-sm space-y-1.5">
          <h2 className="text-base font-semibold text-slate-100">
            Regional Time Series Analysis
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
          To examine the fire calendar, seasonality cycle, and anomaly history between 2000-2026, click on a{' '}
          <strong className="text-slate-200">2°×2° cell</strong> from the 3D globe on the left
          or select one of the <strong className="text-orange-300">Case Mode</strong>{' '}
          incidents above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold">
            Region Analysis {selectedCell ? `— ${selectedCell.grid_id}` : ''}
          </h2>
          <p className="text-xs text-gray-400">
            {loading
              ? 'Data series of 2000–2026 is loading...'
              : `${selectedCellData.length} active month record (Now 2000 – Oct 2026)`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {filteredData.length !== selectedCellData.length && (
            <button
              onClick={() => downloadRegionSummaryCsv(filteredData, `${regionTitle}-filtered`)}
              disabled={loading || filteredData.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
              title="Download only the filtered rows"
            >
              <Download className="h-3.5 w-3.5" />
              Filtered ({filteredData.length})
            </button>
          )}
          <button
            onClick={() => downloadRegionSummaryCsv(selectedCellData, `${regionTitle}-2000-2026`)}
            disabled={loading || selectedCellData.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-medium rounded-lg transition cursor-pointer"
            title="Download the entire history of the cell 2000–2026 as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            All Past CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs text-orange-300">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          All the past years of the cell (2000–2026) are loading...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* E3 + E4 + E5: 12 Aylık Tarihsel Risk Takvimi ve Periyodiklik Özeti */}
      {!loading && <RiskCalendarCard report={seasonalityReport} />}

      <div className="flex flex-wrap gap-2 text-xs">
        <select
          value={effectiveFilterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">All years ({availableYears.length} are active year.)</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              Only {y}
            </option>
          ))}
        </select>

        <select
          value={filterAnomaly}
          onChange={(e) => setFilterAnomaly(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">All Anomaly Levels</option>
          <option value="high_plus">High + Very High</option>
          <option value="very_high">Only Very High</option>
          <option value="low_minus">Low + Very Low</option>
        </select>
      </div>

      {/* Grafikler */}
      <div className="flex flex-col gap-6 mt-1">
        {/* E2: 2000–2026 Tam Zaman Serisi Aktivite Grafiği */}
        <div className="w-full h-[240px] shrink-0">
          <EChartBox option={activityTimelineOption} />
        </div>

        {/* D1: Yıl × Ay Isı Haritası */}
        <div className="w-full h-[360px] shrink-0">
          <EChartBox option={heatmapOption} />
        </div>

        {/* D4: Sıfır Doldurmalı Radyal Mevsimsellik */}
        <div className="w-full flex flex-col gap-1.5 shrink-0">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setRadialMetric('mean')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                radialMetric === 'mean'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Mean
            </button>
            <button
              onClick={() => setRadialMetric('median')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                radialMetric === 'median'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Median
            </button>
          </div>
          <div className="w-full h-[250px]">
            <EChartBox option={radialOption} />
          </div>
        </div>

        {/* D2: Z-Skoru Zaman Serisi */}
        <div className="w-full h-[240px] shrink-0">
          <EChartBox option={anomalyOption} />
        </div>
      </div>

      {/* E-Posta Simülasyonu */}
      <div className="shrink-0 mt-2">
        <EmailAlertSimulation regionTitle={regionTitle} selectedCellData={filteredData} />
      </div>
      {/* İtfaiye İstasyonları */}
      {selectedCell && (
        <FireStationsPanel cellLat={selectedCell.lat} cellLon={selectedCell.lon} />
      )}
    </div>
  );
}