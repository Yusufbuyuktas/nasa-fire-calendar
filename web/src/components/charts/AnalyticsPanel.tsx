import { useState, useMemo } from 'react';
import type * as echarts from 'echarts';
import { Globe2, Loader2, AlertCircle, Download } from 'lucide-react';
import type { FireDataRow } from '../../types/fireData';
import { downloadRegionSummaryCsv } from '../../services/csvExport';
import EChartBox from './EChartBox';
import EmailAlertSimulation from './EmailAlertSimulation';

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

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DATASET_START_YEAR = 2000;
const DATASET_START_MONTH = 11; // Kasım 2000 (MODIS Terra başlangıcı)
const DATASET_END_YEAR = 2026;
const DATASET_END_MONTH = 10; // Ekim 2026 (kısmi yıl sonu)

function isWithinObservationWindow(year: number, month: number): boolean {
  if (year < DATASET_START_YEAR || year > DATASET_END_YEAR) return false;
  if (year === DATASET_START_YEAR && month < DATASET_START_MONTH) return false;
  if (year === DATASET_END_YEAR && month > DATASET_END_MONTH) return false;
  return true;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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

  // D4: Gözlem penceresindeki kayıtsız ayları 0 kabul eden sıfır doldurmalı aylık istatistikler
  const monthlyStats = useMemo(() => {
    const buckets: number[][] = Array.from({ length: 12 }, () => []);
    const rowLookup = new Map<string, number>();

    for (const row of selectedCellData) {
      rowLookup.set(`${row.year}-${row.month}`, row.activity_index);
    }

    const yearsToInclude =
      effectiveFilterYear === 'all'
        ? Array.from(
            { length: DATASET_END_YEAR - DATASET_START_YEAR + 1 },
            (_, i) => DATASET_START_YEAR + i
          )
        : [Number(effectiveFilterYear)];

    for (const year of yearsToInclude) {
      for (let month = 1; month <= 12; month += 1) {
        if (!isWithinObservationWindow(year, month)) continue;
        const val = rowLookup.get(`${year}-${month}`) ?? 0;
        buckets[month - 1].push(val);
      }
    }

    const means = buckets.map((vals) => {
      if (vals.length === 0) return 0;
      const sum = vals.reduce((acc, v) => acc + v, 0);
      return Math.round((sum / vals.length) * 10) / 10;
    });

    const medians = buckets.map(
      (vals) => Math.round(computeMedian(vals) * 10) / 10
    );

    return { means, medians };
  }, [selectedCellData, effectiveFilterYear]);

  // D1: Gerçek Yıl × Ay takvim ısı haritası verisi (yalnızca saf ilkel değerler)
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

  // D4: Radyal Mevsimsellik Grafiği Ayarları
  const radialOption = useMemo<echarts.EChartsOption>(() => {
    const activeRadialValues =
      radialMetric === 'mean' ? monthlyStats.means : monthlyStats.medians;
    const maxRadialVal = Math.max(...activeRadialValues);

    return {
      backgroundColor: 'transparent',
      title: {
        text: `Mevsimsellik (${radialMetric === 'mean' ? 'Sıfır Doldurmalı Ortalama' : 'Medyan'})`,
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
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${MONTHS[idx]} (2000–2026)</div>
              <div>Ortalama Aktivite: <b>${monthlyStats.means[idx]}</b></div>
              <div>Medyan Aktivite: <b>${monthlyStats.medians[idx]}</b></div>
            </div>
          `;
        },
      },
      angleAxis: {
        type: 'category',
        data: MONTHS,
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
  }, [radialMetric, monthlyStats]);

  // D2: Z-Skoru Zaman Serisi (±5 aralığına kırpılmış, gerçek değer tooltip'te)
  const anomalyOption = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Anomali Göstergesi (Z-Skoru Zaman Serisi, ±5 Kırpmalı)',
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
              ? 'Hesaplanmadı (Yetersiz tarihçe)'
              : `${rawScore.toFixed(2)}${Math.abs(rawScore) > 5 ? ' (grafikte ±5 kırpıldı)' : ''}`;
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:4px;">${item.name ?? ''}</div>
              <div>Gerçek Z-Skoru: <b>${scoreLabel}</b></div>
              <div>Seviye: <b>${anomalyLevel}</b></div>
            </div>
          `;
        },
      },
      grid: { top: 42, bottom: 48, left: 38, right: 16 },
      xAxis: {
        type: 'category',
        data: filteredData.map((r) => `${MONTHS[r.month - 1]} ${r.year}`),
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
        text: 'Yangın Takvimi Isı Haritası (Yıl × Ay)',
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
          const { year, month, inWindow, hasRecord, activityIndex, zScore, anomalyLevel } = p.data;
          if (!inWindow) {
            return `<div><b>${MONTHS[month - 1]} ${year}</b><br/><span style="color:#94a3b8;">Gözlem penceresi dışı</span></div>`;
          }
          if (!hasRecord) {
            return `<div><b>${MONTHS[month - 1]} ${year}</b><br/>Aktivite İndeksi: <b>0</b> (Tespit yok)</div>`;
          }
          const zStr = zScore !== null ? zScore.toFixed(2) : 'Yok';
          return `
            <div>
              <div style="font-weight:700;color:#fb923c;margin-bottom:3px;">${MONTHS[month - 1]} ${year}</div>
              <div>Aktivite İndeksi: <b>${activityIndex.toFixed(1)}</b></div>
              <div>Anomali: <b>${anomalyLevel}</b> (Z: ${zStr})</div>
            </div>
          `;
        },
      },
      grid: { top: 38, bottom: 52, left: 44, right: 16 },
      xAxis: {
        type: 'category',
        data: MONTHS,
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
          name: 'Aktivite İndeksi',
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
            Bölgesel Zaman Serisi Analizi
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            2000–2026 yılları arasındaki yangın takvimini, mevsimsellik döngüsünü
            ve anomali geçmişini incelemek için sol taraftaki 3B küreden bir{' '}
            <strong className="text-slate-200">2°×2° hücreye</strong> tıklayın
            veya üstteki <strong className="text-orange-300">Hikâye Modu</strong>{' '}
            vakalarından birini seçin.
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
            Bölge Analizi {selectedCell ? `— ${selectedCell.grid_id}` : ''}
          </h2>
          <p className="text-xs text-gray-400">
            {loading
              ? '2000–2026 zaman serisi yükleniyor...'
              : `${selectedCellData.length} aktif ay kaydı (Kas 2000 – Eki 2026)`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {filteredData.length !== selectedCellData.length && (
            <button
              onClick={() => downloadRegionSummaryCsv(filteredData, `${regionTitle}-filtreli`)}
              disabled={loading || filteredData.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
              title="Yalnızca filtrelenen satırları indir"
            >
              <Download className="h-3.5 w-3.5" />
              Filtreli ({filteredData.length})
            </button>
          )}
          <button
            onClick={() => downloadRegionSummaryCsv(selectedCellData, `${regionTitle}-2000-2026`)}
            disabled={loading || selectedCellData.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-medium rounded-lg transition cursor-pointer"
            title="Hücrenin 2000–2026 tüm geçmişini CSV olarak indir"
          >
            <Download className="h-3.5 w-3.5" />
            Tam Geçmiş CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs text-orange-300">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Hücrenin tüm geçmiş yılları (2000–2026) yükleniyor...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <select
          value={effectiveFilterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">Tüm Yıllar ({availableYears.length} aktif yıl)</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              Sadece {y}
            </option>
          ))}
        </select>

        <select
          value={filterAnomaly}
          onChange={(e) => setFilterAnomaly(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">Tüm Anomali Seviyeleri</option>
          <option value="high_plus">Yüksek + Çok Yüksek</option>
          <option value="very_high">Yalnızca Çok Yüksek</option>
          <option value="low_minus">Düşük + Çok Düşük</option>
        </select>
      </div>

      {/* Grafikler */}
      <div className="flex flex-col gap-6 mt-1">
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
              Ortalama
            </button>
            <button
              onClick={() => setRadialMetric('median')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                radialMetric === 'median'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Medyan
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
        <EmailAlertSimulation regionTitle={regionTitle} />
      </div>
    </div>
  );
}