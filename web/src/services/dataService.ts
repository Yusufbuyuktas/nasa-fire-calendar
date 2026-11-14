import Papa from 'papaparse';
import type { FireDataRow, AnomalyLevel } from '../types/fireData';

const dataCache: Record<number, FireDataRow[]> = {};

export const fetchFireDataForYear = async (year: number): Promise<FireDataRow[]> => {
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
          grid_id: row.grid_id || '',
          lat: row.lat || row.latitude,
          lon: row.lon || row.longitude,
          year: row.year || year,
          month: row.month || 1,
          activity_index: row.activity_index || row.fire_count || row.count || 1,
          z_score: row.z_score !== undefined ? row.z_score : (row.anomaly_score || null),
          anomaly_level: (row.anomaly_level as AnomalyLevel) || 'NORMAL',
          source: row.source || 'Unknown'
        }));
        
        dataCache[year] = parsedData;
        resolve(parsedData);
      },
      error: (error) => {
        console.error(`${year} verisi yüklenirken hata oluştu:`, error);
        reject(error);
      }
    });
  });
};