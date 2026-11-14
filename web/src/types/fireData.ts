// web/src/types/fireData.ts
export interface FireDataRow {
  lat: number;           // Enlem
  lon: number;           // Boylam
  fire_count: number;    // O hücredeki yangın/hotspot sayısı
  anomaly_score?: number; // Varsa anomali skoru (z-score vb.)
  month?: number;        // İsteğe bağlı (aylık filtreleme için)
}

export interface YearlyData {
  year: number;
  data: FireDataRow[];
}