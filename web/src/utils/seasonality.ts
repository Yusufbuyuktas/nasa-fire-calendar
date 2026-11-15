import type { AnomalyLevel, FireDataRow } from '../types/fireData';

export type MonthRiskTier = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
export type PeriodicityStrength =
  | 'STRONG'
  | 'MODERATE'
  | 'WEAK'
  | 'INSUFFICIENT_DATA';

export interface ChronologicalMonthPoint {
  year: number;
  month: number;
  label: string;
  activityIndex: number;
  zScore: number | null;
  anomalyLevel: AnomalyLevel;
  source: string;
  hasRecord: boolean;
}

export interface MonthSeasonalityStat {
  month: number;
  shortName: string;
  fullName: string;
  totalObservedYears: number;
  activeYears: number;
  frequency: number;
  frequencyPercent: number;
  meanActivity: number;
  medianActivity: number;
  maxActivity: number;
  highAnomalyCount: number;
  riskTier: MonthRiskTier;
}

export interface CellSeasonalityReport {
  monthlyStats: MonthSeasonalityStat[];
  peakMonths: MonthSeasonalityStat[];
  activeYearCount: number;
  totalActiveMonths: number;
  totalObservedMonths: number;
  seasonalConcentration: number;
  lag12Autocorrelation: number | null;
  lag24Autocorrelation: number | null;
  periodicityStrength: PeriodicityStrength;
  hasSufficientHistory: boolean;
  summaryText: string;
}

export const DATASET_START_YEAR = 2000;
export const DATASET_START_MONTH = 11; // November 2000 (MODIS Terra start)
export const DATASET_END_YEAR = 2026;
export const DATASET_END_MONTH = 10; // October 2026 (partial year end)

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isWithinObservationWindow(year: number, month: number): boolean {
  if (year < DATASET_START_YEAR || year > DATASET_END_YEAR) return false;
  if (year === DATASET_START_YEAR && month < DATASET_START_MONTH) return false;
  if (year === DATASET_END_YEAR && month > DATASET_END_MONTH) return false;
  return true;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function classifyMonthRiskTier(frequency: number): MonthRiskTier {
  if (frequency >= 0.75) return 'CRITICAL';
  if (frequency >= 0.45) return 'HIGH';
  if (frequency >= 0.15) return 'MODERATE';
  return 'LOW';
}

function computeLagAutocorrelation(series: number[], lag: number): number | null {
  const n = series.length;
  if (n <= lag + 2) return null;

  const mean = series.reduce((acc, v) => acc + v, 0) / n;
  let varianceSum = 0;
  for (let i = 0; i < n; i += 1) {
    const diff = series[i] - mean;
    varianceSum += diff * diff;
  }

  if (varianceSum <= 1e-12) return null;

  let covSum = 0;
  for (let i = lag; i < n; i += 1) {
    covSum += (series[i] - mean) * (series[i - lag] - mean);
  }

  const r = covSum / varianceSum;
  return Math.max(-1, Math.min(1, Math.round(r * 100) / 100));
}

function computeSeasonalConcentration(monthlyMeans: number[]): number {
  const total = monthlyMeans.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return 0;

  let entropy = 0;
  for (const val of monthlyMeans) {
    if (val <= 0) continue;
    const p = val / total;
    entropy -= p * Math.log(p);
  }

  const maxEntropy = Math.log(12);
  const normalizedEntropy = entropy / maxEntropy;
  const concentration = 1 - normalizedEntropy;
  return Math.max(0, Math.min(1, Math.round(concentration * 100) / 100));
}

export function buildZeroFilledChronologicalSeries(
  rows: FireDataRow[]
): ChronologicalMonthPoint[] {
  const rowMap = new Map<string, FireDataRow>();
  for (const row of rows) {
    rowMap.set(`${row.year}-${row.month}`, row);
  }

  const timeline: ChronologicalMonthPoint[] = [];

  for (let year = DATASET_START_YEAR; year <= DATASET_END_YEAR; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (!isWithinObservationWindow(year, month)) continue;
      const matched = rowMap.get(`${year}-${month}`);
      const isPositive = Boolean(matched && matched.activity_index > 0);
      const activity =
        isPositive && matched
          ? Math.round(matched.activity_index * 10) / 10
          : 0;

      timeline.push({
        year,
        month,
        label: `${MONTH_SHORT[month - 1]} ${year}`,
        activityIndex: activity,
        zScore: isPositive && matched ? matched.z_score : null,
        anomalyLevel:
          isPositive && matched ? matched.anomaly_level : 'UNVERIFIED_ZERO',
        source:
          isPositive && matched ? matched.source : 'UNVERIFIED_ZERO',
        hasRecord: isPositive,
      });
    }
  }

  return timeline;
}

export function analyzeCellSeasonality(
  rows: FireDataRow[]
): CellSeasonalityReport {
  const timeline = buildZeroFilledChronologicalSeries(rows);
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  const highAnomalyCounts = Array<number>(12).fill(0);
  const activeYearsSet = new Set<number>();
  let totalActiveMonths = 0;

  for (const pt of timeline) {
    const mIdx = pt.month - 1;
    buckets[mIdx].push(pt.activityIndex);

    if (pt.activityIndex > 0) {
      activeYearsSet.add(pt.year);
      totalActiveMonths += 1;
    }

    if (pt.anomalyLevel === 'HIGH' || pt.anomalyLevel === 'VERY_HIGH') {
      highAnomalyCounts[mIdx] += 1;
    }
  }

  const monthlyStats: MonthSeasonalityStat[] = buckets.map((vals, idx) => {
    const totalObservedYears = vals.length;
    const activeYears = vals.filter((v) => v > 0).length;
    const frequency =
      totalObservedYears > 0 ? activeYears / totalObservedYears : 0;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const meanActivity =
      totalObservedYears > 0
        ? Math.round((sum / totalObservedYears) * 10) / 10
        : 0;
    const medianActivity = Math.round(computeMedian(vals) * 10) / 10;
    const maxActivity =
      vals.length > 0 ? Math.round(Math.max(...vals) * 10) / 10 : 0;

    return {
      month: idx + 1,
      shortName: MONTH_SHORT[idx],
      fullName: MONTH_FULL[idx],
      totalObservedYears,
      activeYears,
      frequency: Math.round(frequency * 1000) / 1000,
      frequencyPercent: Math.round(frequency * 100),
      meanActivity,
      medianActivity,
      maxActivity,
      highAnomalyCount: highAnomalyCounts[idx],
      riskTier: classifyMonthRiskTier(frequency),
    };
  });

  const peakMonths = [...monthlyStats]
    .filter((m) => m.activeYears > 0)
    .sort(
      (a, b) =>
        b.meanActivity - a.meanActivity ||
        b.frequency - a.frequency ||
        a.month - b.month
    )
    .slice(0, 3);

  const activeYearCount = activeYearsSet.size;
  const hasSufficientHistory = activeYearCount >= 10;
  const seasonalConcentration = computeSeasonalConcentration(
    monthlyStats.map((m) => m.meanActivity)
  );

  const activitySeries = timeline.map((pt) => pt.activityIndex);
  const lag12Autocorrelation = computeLagAutocorrelation(activitySeries, 12);
  const lag24Autocorrelation = computeLagAutocorrelation(activitySeries, 24);

  let periodicityStrength: PeriodicityStrength = 'INSUFFICIENT_DATA';
  if (hasSufficientHistory) {
    const r12 = lag12Autocorrelation ?? 0;
    if (r12 >= 0.45 && seasonalConcentration >= 0.35) {
      periodicityStrength = 'STRONG';
    } else if (r12 >= 0.2 || seasonalConcentration >= 0.25) {
      periodicityStrength = 'MODERATE';
    } else {
      periodicityStrength = 'WEAK';
    }
  }

  let summaryText: string;
  if (totalActiveMonths === 0) {
    summaryText =
      'No positive hotspot detections were recorded in this cell across the November 2000 – October 2026 observation window.';
  } else if (!hasSufficientHistory) {
    const peakLabel = peakMonths
      .map((m) => `${m.fullName} (${m.frequencyPercent}%)`)
      .join(', ');
    summaryText = `Limited historical baseline (${activeYearCount} active yrs < 10-yr threshold): periodicity inference has low statistical reliability. Most active months observed: ${peakLabel}.`;
  } else {
    const peakLabel = peakMonths
      .map((m) => `${m.fullName} (${m.frequencyPercent}%)`)
      .join(', ');
    const concentrationDesc =
      seasonalConcentration >= 0.55
        ? 'high seasonal concentration'
        : seasonalConcentration >= 0.3
        ? 'distinct seasonal clustering'
        : 'broad year-round distribution';
    const r12Text =
      lag12Autocorrelation !== null
        ? `Lag-12 annual autocorrelation r = ${lag12Autocorrelation.toFixed(2)}`
        : 'annual autocorrelation unavailable';
    const periodicityDesc =
      periodicityStrength === 'STRONG'
        ? 'Strong annual periodicity is observed.'
        : periodicityStrength === 'MODERATE'
        ? 'Moderate seasonal recurrence is present.'
        : 'Weak periodicity; hotspot activity varies irregularly across years.';

    summaryText = `Across the 26-year observation window (${activeYearCount} active yrs), hotspot activity concentrates primarily in ${peakLabel} (${concentrationDesc}; ${r12Text}). ${periodicityDesc}`;
  }

  return {
    monthlyStats,
    peakMonths,
    activeYearCount,
    totalActiveMonths,
    totalObservedMonths: timeline.length,
    seasonalConcentration,
    lag12Autocorrelation,
    lag24Autocorrelation,
    periodicityStrength,
    hasSufficientHistory,
    summaryText,
  };
}