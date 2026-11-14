import type { ElementType } from 'react';
import ReactECharts from 'echarts-for-react';
import type { FireDataRow } from '../../types/fireData';
import { downloadRegionSummaryCsv } from '../../services/csvExport';

// ÇÖZÜM: TypeScript'in kendi tavsiyesine uyup araya 'unknown' koyarak zorla dönüştürüyoruz:
const ECharts = ReactECharts as unknown as ElementType; 

interface AnalyticsPanelProps {
  selectedCellData: FireDataRow[];  
  regionTitle?: string;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export default function AnalyticsPanel({
  selectedCellData,
  regionTitle = 'secili-bolge',
}: AnalyticsPanelProps) {
  // 1. Aylık Ortalama & Tepe Ay Hesabı (Mevsimsellik için)
  const monthlyTotals = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);

  selectedCellData.forEach((row) => {
    const m = (row.month ?? 1) - 1;
    if (m >= 0 && m < 12) {
      monthlyTotals[m] += row.fire_count;
      monthlyCounts[m] += 1;
    }
  });

  const monthlyAvg = monthlyTotals.map((sum, idx) =>
    monthlyCounts[idx] > 0 ? Math.round((sum / monthlyCounts[idx]) * 10) / 10 : 0
  );
  const maxVal = Math.max(...monthlyAvg);

  // 2. Radyal Mevsimsellik Grafiği Ayarları
  const radialOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Mevsimsellik (Aylık Ortalama)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
    },
    tooltip: { trigger: 'item' },
    angleAxis: {
      type: 'category',
      data: MONTHS,
      axisLabel: { color: '#9ca3af' },
    },
    radiusAxis: {
      axisLabel: { color: '#6b7280', fontSize: 10 },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    polar: { radius: '68%' },
    series: [
      {
        type: 'bar',
        coordinateSystem: 'polar',
        data: monthlyAvg.map((val) => ({
          value: val,
          itemStyle: {
            color: val === maxVal && val > 0 ? '#f97316' : '#38bdf8', // Tepe ay turuncu vurgulu
          },
        })),
      },
    ],
  };

  // 3. Anomali Çubuk Grafiği Ayarları
  const anomalyOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Anomali Göstergesi (Z-Skoru / Sapma)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
    },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: selectedCellData.map((r) => `Ay ${r.month ?? '-'}`),
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
        data: selectedCellData.map((r) => {
          const score = r.anomaly_score ?? 0;
          return {
            value: score,
            itemStyle: {
              color: score >= 0 ? '#ef4444' : '#3b82f6', // Pozitif anomali kırmızı, negatif mavi
            },
          };
        }),
      },
    ],
  };

  // 4. Yıl x Ay Takvim Isı Haritası (Heatmap) Ayarları
  const heatmapData = selectedCellData.map((r, idx) => [
    (r.month ?? 1) - 1,
    Math.floor(idx / 12),
    r.fire_count,
  ]);

  const heatmapOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Yangın Takvimi Isı Haritası',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
    },
    tooltip: { position: 'top' },
    grid: { height: '55%', top: '22%' },
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
      max: Math.max(...selectedCellData.map((r) => r.fire_count), 10),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: { color: '#9ca3af' },
      inRange: {
        // Erişilebilir (renk körü dostu) Viridis/Cividis tonları
        color: ['#1e293b', '#38bdf8', '#facc15', '#f97316', '#dc2626'],
      },
    },
    series: [
      {
        name: 'Yangın Yoğunluğu',
        type: 'heatmap',
        data: heatmapData,
      },
    ],
  };

  return (
    <div className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Bölge Analizi</h2>
          <p className="text-xs text-gray-400">
            {selectedCellData.length} aylık kayıt inceleniyor
          </p>
        </div>
        <button
          onClick={() => downloadRegionSummaryCsv(selectedCellData, regionTitle)}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-xs font-medium rounded-lg transition cursor-pointer"
        >
          CSV İndir
        </button>
      </div>

      <ECharts option={heatmapOption} style={{ height: '210px' }} />
      <ECharts option={radialOption} style={{ height: '230px' }} />
      <ECharts option={anomalyOption} style={{ height: '210px' }} />
    </div>
  );
}