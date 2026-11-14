
import Papa from 'papaparse';
import type {
  FireDataRow,
  AnomalyLevel,
  ConfidenceLevel
} from '../types/fireData';

const dataCache: Record<number, FireDataRow[]> = {};

export const fetchFireDataForYear = async (
  year: number
): Promise<FireDataRow[]> => {
  if (dataCache[year]) {
    return dataCache[year];
  }

  const csvPath = `/data/${year}.csv`;

  return new Promise((resolve, reject) => {
    Papa.parse(csvPath, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,

      complete: (results) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = results.data as Record<string, any>[];

        const parsedData: FireDataRow[] = rawData.map((row) => ({
          grid_id: String(row.grid_id ?? ''),
          lat: Number(row.lat ?? row.latitude),
          lon: Number(row.lon ?? row.longitude),
          year: Number(row.year ?? year),
          month: Number(row.month ?? 1),
          activity_index: Number(
            row.activity_index ?? row.fire_count ?? row.count ?? 0
          ),
          z_score:
            row.z_score == null || row.z_score === ''
              ? null
              : Number(row.z_score),
          anomaly_level:
            (row.anomaly_level as AnomalyLevel) ??
            'INSUFFICIENT_DATA',
          source: String(row.source ?? 'Unknown'),

          // Historical observation count
          history_count: Number(row.history_count ?? 0),

          // Historical data sufficiency category
          confidence_level:
            (row.confidence_level as ConfidenceLevel) ??
            'INSUFFICIENT'
        }));

        dataCache[year] = parsedData;
        resolve(parsedData);
      },

      error: (error) => {
        console.error(
          `${year} verisi yüklenirken hata oluştu:`,
          error
        );
        reject(error);
      }
    });
  });
};
