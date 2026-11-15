import type { FireDataRow } from '../types/fireData';

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const downloadRegionSummaryCsv = (
  rows: FireDataRow[],
  regionLabel: string
) => {
  if (!rows || rows.length === 0) return;

  const headers = [
    'grid_id',
    'lat',
    'lon',
    'year',
    'month',
    'activity_index',
    'z_score',
    'anomaly_level',
    'source',
    'history_count',
    'confidence_level',
  ];

  const sortedRows = [...rows].sort(
    (a, b) => a.year - b.year || a.month - b.month
  );

  const csvLines = [
    headers.join(','),
    ...sortedRows.map((r) =>
      [
        escapeCsvValue(r.grid_id),
        escapeCsvValue(r.lat),
        escapeCsvValue(r.lon),
        escapeCsvValue(r.year),
        escapeCsvValue(r.month),
        escapeCsvValue(r.activity_index),
        escapeCsvValue(r.z_score),
        escapeCsvValue(r.anomaly_level),
        escapeCsvValue(r.source),
        escapeCsvValue(r.history_count),
        escapeCsvValue(r.confidence_level),
      ].join(',')
    ),
  ];

  // Excel uyumluluğu için UTF-8 BOM (\uFEFF) eklenir
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
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