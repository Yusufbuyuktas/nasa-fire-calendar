import type { ElementType } from 'react';
import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Globe2, Loader2, AlertCircle } from 'lucide-react';
import type { FireDataRow } from '../../types/fireData';
import { downloadRegionSummaryCsv } from '../../services/csvExport';
import EmailAlertSimulation from './EmailAlertSimulation';

const ECharts = ReactECharts as unknown as ElementType;

interface AnalyticsPanelProps {
  selectedCell?: FireDataRow | null;
  selectedCellData: FireDataRow[];
  regionTitle?: string;
  loading?: boolean;
  error?: string | null;
  selectedYear?: number;
  selectedMonth?: number;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export default function AnalyticsPanel({
  selectedCell = null,
  selectedCellData,
  regionTitle = 'secili-bolge',
  loading = false,
  error = null,
}: AnalyticsPanelProps) {
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('all');

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
        (filterAnomaly === 'high' && row.anomaly_level === 'HIGH') ||
        (filterAnomaly === 'very_high' && row.anomaly_level === 'VERY_HIGH');
      return passYear && passAnomaly;
    });
  }, [selectedCellData, effectiveFilterYear, filterAnomaly]);

  // C6: Hücre seçilmediyse boş karşılama ekranı göster (e-posta simülasyonu gizli)
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

  // Grafik hesaplamaları
  const monthlyTotals = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);

  filteredData.forEach((row) => {
    const m = row.month - 1;
    if (m >= 0 && m < 12) {
      monthlyTotals[m] += row.activity_index;
      monthlyCounts[m] += 1;
    }
  });

  const monthlyAvg = monthlyTotals.map((sum, idx) =>
    monthlyCounts[idx] > 0 ? Math.round((sum / monthlyCounts[idx]) * 10) / 10 : 0
  );
  const maxVal = Math.max(...monthlyAvg);

  const radialOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Mevsimsellik (Aylık Ortalama Aktivite)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
      top: 0,
    },
    tooltip: { trigger: 'item' },
    angleAxis: {
      type: 'category',
      data: MONTHS,
      axisLabel: { color: '#9ca3af' },
    },
    radiusAxis: {
      axisLabel: { color: '#6b7280', fontSize: 10, showMaxLabel: false },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    polar: { radius: '55%', center: ['50%', '55%'] },
    series: [
      {
        type: 'bar',
        coordinateSystem: 'polar',
        data: monthlyAvg.map((val) => ({
          value: val,
          itemStyle: {
            color: val === maxVal && val > 0 ? '#f97316' : '#38bdf8',
          },
        })),
      },
    ],
  };

  const anomalyOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Anomali Göstergesi (Z-Skoru)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
      top: 0,
    },
    tooltip: { trigger: 'axis' },
    grid: { top: 45, bottom: 30, left: 40, right: 20 },
    xAxis: {
      type: 'category',
      data: filteredData.map((r) => `${MONTHS[r.month - 1]} ${r.year}`),
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'bar',
        data: filteredData.map((r) => {
          const score = r.z_score ?? 0;
          return {
            value: score,
            itemStyle: {
              color: score >= 0 ? '#ef4444' : '#3b82f6',
            },
          };
        }),
      },
    ],
  };

  const heatmapData = filteredData.map((r, idx) => [
    r.month - 1,
    Math.floor(idx / 12),
    r.activity_index,
  ]);

  const heatmapOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Yangın Takvimi Isı Haritası',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
      top: 0,
    },
    tooltip: { position: 'top' },
    grid: { top: 45, bottom: 85, left: 40, right: 20 },
    xAxis: {
      type: 'category',
      data: MONTHS,
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'category',
      data: ['Seri'],
      axisLabel: { color: '#9ca3af' },
    },
    visualMap: {
      min: 0,
      max: Math.max(...filteredData.map((r) => r.activity_index), 10),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 15,
      itemHeight: 120,
      textStyle: { color: '#9ca3af' },
      inRange: {
        color: ['#1e293b', '#38bdf8', '#facc15', '#f97316', '#dc2626'],
      },
    },
    series: [
      {
        name: 'Aktivite İndeksi',
        type: 'heatmap',
        data: heatmapData,
      },
    ],
  };

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
              : `${selectedCellData.length} aylık kayıt inceleniyor (2000–2026)`}
          </p>
        </div>
        <button
          onClick={() => downloadRegionSummaryCsv(filteredData, regionTitle)}
          disabled={loading || filteredData.length === 0}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-medium rounded-lg transition cursor-pointer"
        >
          CSV İndir
        </button>
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

      <div className="flex gap-3 text-sm">
        <select
          value={effectiveFilterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">Tüm Yıllar ({availableYears.length} yıl)</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              Sadece {y}
            </option>
          ))}
        </select>

        <select
          value={filterAnomaly}
          onChange={(e) => setFilterAnomaly(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">Tüm Anomali Seviyeleri</option>
          <option value="high">Yüksek (HIGH)</option>
          <option value="very_high">Çok Yüksek (VERY_HIGH)</option>
        </select>
      </div>

      {/* Grafikler */}
      <div className="flex flex-col gap-6 mt-2">
        <div className="w-full h-[220px] shrink-0">
          <ECharts option={heatmapOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </div>

        <div className="w-full h-[250px] shrink-0">
          <ECharts option={radialOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </div>

        <div className="w-full h-[220px] shrink-0">
          <ECharts option={anomalyOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </div>
      </div>

      {/* E-Posta Simülasyonu */}
      <div className="shrink-0 mt-2">
        <EmailAlertSimulation regionTitle={regionTitle} />
      </div>
    </div>
  );
}