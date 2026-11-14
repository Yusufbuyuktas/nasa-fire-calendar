export type AnomalyLevel =
  | 'VERY_LOW'
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'INSUFFICIENT_DATA';

export interface FireDataRow {
  grid_id: string;
  lat: number;
  lon: number;
  year: number;
  month: number;
  activity_index: number;
  z_score: number | null;
  anomaly_level: AnomalyLevel;
  source: string;
}