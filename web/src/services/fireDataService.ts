import Papa from 'papaparse';
import type {
  FireGridRow,
  AnomalyLevel,
  ConfidenceLevel,
} from '../types/fireData';

const MIN_YEAR = 2000;
const MAX_YEAR = 2026;

const yearCache = new Map<number, FireGridRow[]>();
const loadingYearPromises = new Map<number, Promise<FireGridRow[]>>();

const cellSeriesCache = new Map<string, FireGridRow[]>();
const loadingCellPromises = new Map<string, Promise<FireGridRow[]>>();

function normalizeFireRow(
  raw: Record<string, unknown>,
  fallbackYear?: number
): FireGridRow | null {
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  const month = Number(raw.month);
  const year = Number(raw.year ?? fallbackYear);

  if (
    !raw.grid_id ||
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
    Number.isNaN(month) ||
    Number.isNaN(year)
  ) {
    return null;
  }

  let parsedZ: number | null = null;
  if (raw.z_score !== null && raw.z_score !== undefined && raw.z_score !== '') {
    const num = Number(raw.z_score);
    parsedZ = Number.isFinite(num) ? num : null;
  }

  return {
    grid_id: String(raw.grid_id),
    lat,
    lon,
    year,
    month,
    activity_index: Number(raw.activity_index ?? 0),
    z_score: parsedZ,
    anomaly_level:
      (raw.anomaly_level as AnomalyLevel) || 'INSUFFICIENT_DATA',
    source: String(raw.source ?? 'Unknown'),
    history_count: Number(raw.history_count ?? 0),
    confidence_level:
      (raw.confidence_level as ConfidenceLevel) || 'INSUFFICIENT',
  };
}

export function getCachedFireYear(year: number): FireGridRow[] | undefined {
  return yearCache.get(year);
}

export function getCachedCellSeries(gridId: string): FireGridRow[] | undefined {
  return cellSeriesCache.get(gridId);
}

export function loadFireYear(year: number): Promise<FireGridRow[]> {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return Promise.reject(new Error(`Geçersiz yıl: ${year}`));
  }

  const cached = yearCache.get(year);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingPromise = loadingYearPromises.get(year);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = fetch(`/data/${year}.csv`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`${year}.csv bulunamadı (${res.status})`);
      }
      return res.text();
    })
    .then(
      (csvText) =>
        new Promise<FireGridRow[]>((resolve) => {
          Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            worker: true,
            complete: (results) => {
              const cleanRows: FireGridRow[] = [];
              for (const raw of results.data) {
                const normalized = normalizeFireRow(raw, year);
                if (normalized) {
                  cleanRows.push(normalized);
                }
              }

              yearCache.set(year, cleanRows);
              loadingYearPromises.delete(year);
              resolve(cleanRows);
            },
          });
        })
    )
    .catch((err) => {
      loadingYearPromises.delete(year);
      throw err;
    });

  loadingYearPromises.set(year, requestPromise);
  return requestPromise;
}

function sortChronologically(rows: FireGridRow[]): FireGridRow[] {
  return [...rows].sort((a, b) => a.year - b.year || a.month - b.month);
}

export function loadCellSeries(gridId: string): Promise<FireGridRow[]> {
  const cached = cellSeriesCache.get(gridId);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingPromise = loadingCellPromises.get(gridId);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = (async (): Promise<FireGridRow[]> => {
    // 1. Hücreye özel JSON dosyasından yükle (web/public/data/cells/{grid_id}.json)
    try {
      const jsonRes = await fetch(`/data/cells/${encodeURIComponent(gridId)}.json`);
      if (jsonRes.ok) {
        const payload = (await jsonRes.json()) as
          | { rows?: Array<Record<string, unknown>> }
          | Array<Record<string, unknown>>;
        const rawList = Array.isArray(payload) ? payload : payload.rows ?? [];
        const normalizedRows: FireGridRow[] = [];
        for (const item of rawList) {
          const normalized = normalizeFireRow(item);
          if (normalized) {
            normalizedRows.push(normalized);
          }
        }
        const sorted = sortChronologically(normalizedRows);
        cellSeriesCache.set(gridId, sorted);
        return sorted;
      }
    } catch {
      // JSON erişilemezse yıllık CSV yedek yoluna geç
    }

    // 2. Yedek yol: 2000–2026 yıllık CSV dosyalarından ilgili hücreyi topla
    const years: number[] = [];
    for (let y = MIN_YEAR; y <= MAX_YEAR; y += 1) {
      years.push(y);
    }

    const collected: FireGridRow[] = [];
    const batchSize = 6;

    for (let i = 0; i < years.length; i += batchSize) {
      const batch = years.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((y) => loadFireYear(y).catch(() => [] as FireGridRow[]))
      );
      for (const yearRows of batchResults) {
        for (const row of yearRows) {
          if (row.grid_id === gridId) {
            collected.push(row);
          }
        }
      }
    }

    const sorted = sortChronologically(collected);
    cellSeriesCache.set(gridId, sorted);
    return sorted;
  })().finally(() => {
    loadingCellPromises.delete(gridId);
  });

  loadingCellPromises.set(gridId, requestPromise);
  return requestPromise;
}