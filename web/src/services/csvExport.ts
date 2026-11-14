import type { FireDataRow } from '../types/fireData';

export const downloadRegionSummaryCsv = (
  rows: FireDataRow[],
  regionLabel: string
) => {
  if (!rows || rows.length === 0) return;

  const headers = ['lat', 'lon', 'month', 'fire_count', 'anomaly_score'];
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.lat,
        r.lon,
        r.month ?? '',
        r.fire_count,
        r.anomaly_score ?? 0,
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