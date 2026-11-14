import type { FireDataRow } from '../types/fireData';

export const downloadRegionSummaryCsv = (
  rows: FireDataRow[],
  regionLabel: string
) => {
  if (!rows || rows.length === 0) return;

  // HATA DÜZELTİLDİ: Başlıklar yeni tipe göre güncellendi
  const headers = ['grid_id', 'lat', 'lon', 'year', 'month', 'activity_index', 'z_score', 'anomaly_level', 'source'];
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.grid_id,
        r.lat,
        r.lon,
        r.year,
        r.month,
        r.activity_index,
        r.z_score ?? '', // null değerini boş string yapıyoruz
        r.anomaly_level,
        r.source
      ].join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `nasa-firms-${regionLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};