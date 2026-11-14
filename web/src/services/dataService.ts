// web/src/services/dataService.ts
import Papa from 'papaparse';
import type { FireDataRow } from '../types/fireData';

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
        const rawData = results.data as Record<string, number>[];
        
        const parsedData: FireDataRow[] = rawData.map((row) => ({
          lat: row.lat || row.latitude,
          lon: row.lon || row.longitude,
          fire_count: row.fire_count || row.count || 1,
          anomaly_score: row.anomaly_score || row.anomaly || 0,
          month: row.month
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