import type { ElementType } from 'react';
import { useState, useMemo } from 'react'; // Bİlgi: useState ve useMemo eklendi
import ReactECharts from 'echarts-for-react';
import type { FireDataRow } from '../../types/fireData';
import { downloadRegionSummaryCsv } from '../../services/csvExport';
import EmailAlertSimulation from './EmailAlertSimulation';

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
  
  // --- YENİ EKLENEN FİLTRE STATE'LERİ BURADA OLMALI ---
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterAnomaly, setFilterAnomaly] = useState<string>('all');

  const filteredData = useMemo(() => {
    return selectedCellData.filter((row) => {
      const passYear = filterYear === 'all' || row.year.toString() === filterYear;
      const passAnomaly = 
        filterAnomaly === 'all' || 
        (filterAnomaly === 'high' && row.anomaly_level === 'HIGH') ||
        (filterAnomaly === 'very_high' && row.anomaly_level === 'VERY_HIGH');
      return passYear && passAnomaly;
    });
  }, [selectedCellData, filterYear, filterAnomaly]);
  // --------------------------------------------------

  // --- GRAFİK HESAPLAMALARI ARTIK filteredData İLE YAPILMALI ---
  const monthlyTotals = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);

  // NOT: selectedCellData yerine filteredData kullanıyoruz
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

  // 2. Radyal Mevsimsellik Grafiği Ayarları (Kodu aynı)
  const radialOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Mevsimsellik (Aylık Ortalama Aktivite)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
      top: 0, // Başlığı en üste sabitledik
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
    // Grafiği biraz küçültüp (55%) aşağı ittik (55%) ki başlığa değmesin:
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

  // 3. Anomali Çubuk Grafiği Ayarları
  const anomalyOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Anomali Göstergesi (Z-Skoru)',
      textStyle: { color: '#f3f4f6', fontSize: 14 },
      top: 0,
    },
    tooltip: { trigger: 'axis' },
    // Eksenlerin dışarı taşmaması için grid (ızgara) boşluklarını ayarladık:
    grid: { top: 45, bottom: 30, left: 40, right: 20 },
    xAxis: {
      type: 'category',
      data: selectedCellData.map((r) => `Ay ${r.month}`),
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

  // 4. Yıl x Ay Takvim Isı Haritası (Heatmap) Ayarları
  const heatmapData = selectedCellData.map((r, idx) => [
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
      max: Math.max(...selectedCellData.map((r) => r.activity_index), 10),
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

      <div className="flex gap-3 text-sm">
        <select 
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 flex-1 outline-none focus:border-orange-500"
        >
          <option value="all">Tüm Yıllar</option>
          {/* Daha sonra dinamik olarak 2000-2026 eklenebilir, şimdilik statik birkaç örnek */}
          <option value="2021">Sadece 2021</option>
          <option value="2022">Sadece 2022</option>
          <option value="2023">Sadece 2023</option>
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
        <div className="flex flex-col gap-6 mt-4">
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