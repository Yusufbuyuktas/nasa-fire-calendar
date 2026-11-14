
import Papa from 'papaparse';
import type {
  FireGridRow,
  AnomalyLevel,
  ConfidenceLevel,
} from '../types/fireData';

type RawFireGridRow = Record<string, string>;

const cache = new Map<number, FireGridRow[]>();

export async function loadFireYear(
  year: number
): Promise<FireGridRow[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2026) {
    throw new Error(`Geçersiz yıl: ${year}`);
  }

  const cached = cache.get(year);
  if (cached) return cached;

  const response = await fetch(`/data/${year}.csv`);

  if (!response.ok) {
    throw new Error(
      `CSV yüklenemedi: ${year} (${response.status})`
    );
  }

  const csvText = await response.text();

  const parsed = Papa.parse<RawFireGridRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `CSV ayrıştırma hatası: ${parsed.errors[0].message}`
    );
  }

  const rows: FireGridRow[] = parsed.data.map((row) => ({
    grid_id: row.grid_id,
    lat: Number(row.lat),
    lon: Number(row.lon),
    year: Number(row.year),
    month: Number(row.month),
    activity_index: Number(row.activity_index),
    z_score:
      row.z_score === '' || row.z_score == null
        ? null
        : Number(row.z_score),
    anomaly_level: row.anomaly_level as AnomalyLevel,
    source: row.source,
    history_count: Number(row.history_count),
    confidence_level: row.confidence_level as ConfidenceLevel,
  }));

  cache.set(year, rows);

  return rows;
}

export async function loadFireMonth(
  year: number,
  month: number
): Promise<FireGridRow[]> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Geçersiz ay: ${month}`);
  }

  const rows = await loadFireYear(year);

  return rows.filter((row) => row.month === month);
}
