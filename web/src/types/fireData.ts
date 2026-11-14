
export type AnomalyLevel =
  | 'VERY_LOW'
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'INSUFFICIENT_DATA';

export type ConfidenceLevel =
  | 'INSUFFICIENT'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

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

  // Historical positive hotspot record count
  history_count: number;

  // Historical data sufficiency category
  confidence_level: ConfidenceLevel;
}

// Backward compatibility with the data pipeline service
export type FireGridRow = FireDataRow;
