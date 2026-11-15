import { Calendar, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import type {
  CellSeasonalityReport,
  MonthRiskTier,
  PeriodicityStrength,
} from '../../utils/seasonality';

interface RiskCalendarCardProps {
  report: CellSeasonalityReport;
}

const RISK_TIER_STYLES: Record<
  MonthRiskTier,
  { label: string; badgeClass: string; cardClass: string; barClass: string }
> = {
  CRITICAL: {
    label: 'Critical',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    cardClass: 'border-red-500/40 bg-red-950/20 hover:border-red-400/60',
    barClass: 'bg-red-500',
  },
  HIGH: {
    label: 'High',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    cardClass: 'border-orange-500/35 bg-orange-950/15 hover:border-orange-400/60',
    barClass: 'bg-orange-500',
  },
  MODERATE: {
    label: 'Moderate',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
    cardClass: 'border-amber-500/25 bg-slate-900/80 hover:border-amber-400/50',
    barClass: 'bg-amber-400',
  },
  LOW: {
    label: 'Low',
    badgeClass: 'bg-slate-800/80 text-slate-400 border-slate-700/60',
    cardClass: 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700',
    barClass: 'bg-slate-500',
  },
};

const PERIODICITY_BADGES: Record<
  PeriodicityStrength,
  { label: string; className: string }
> = {
  STRONG: {
    label: 'Strong Seasonality',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
  MODERATE: {
    label: 'Moderate Seasonality',
    className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
  },
  WEAK: {
    label: 'Irregular / Weak Cycle',
    className: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  INSUFFICIENT_DATA: {
    label: 'Limited History (<10 yrs)',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
};

export default function RiskCalendarCard({ report }: RiskCalendarCardProps) {
  const periodicityBadge = PERIODICITY_BADGES[report.periodicityStrength];

  return (
    <section className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/25 p-1.5">
            <Calendar className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 leading-tight">
              12-Month Historical Risk Calendar
            </h3>
            <p className="text-[11px] text-slate-400 tabular-nums">
              {report.activeYearCount}/26 active yrs • {report.totalActiveMonths}/
              {report.totalObservedMonths} active mos
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${periodicityBadge.className}`}
        >
          {periodicityBadge.label}
        </span>
      </div>

      {/* Periodicity Narrative Callout */}
      <div
        className={`rounded-lg border p-2.5 text-xs leading-relaxed flex items-start gap-2.5 ${
          report.hasSufficientHistory
            ? 'border-slate-800 bg-slate-950/70 text-slate-200'
            : 'border-amber-500/40 bg-amber-950/25 text-amber-200'
        }`}
      >
        {report.hasSufficientHistory ? (
          <TrendingUp className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <p>{report.summaryText}</p>
      </div>

      {/* Periodicity Metrics Strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Seasonal Focus
          </div>
          <div className="text-xs font-bold text-slate-100 mt-0.5 tabular-nums">
            {Math.round(report.seasonalConcentration * 100)}%
          </div>
        </div>
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Annual (Lag-12)
          </div>
          <div className="text-xs font-bold text-slate-100 mt-0.5 tabular-nums">
            {report.lag12Autocorrelation !== null
              ? `r = ${report.lag12Autocorrelation.toFixed(2)}`
              : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Biennial (Lag-24)
          </div>
          <div className="text-xs font-bold text-slate-100 mt-0.5 tabular-nums">
            {report.lag24Autocorrelation !== null
              ? `r = ${report.lag24Autocorrelation.toFixed(2)}`
              : '—'}
          </div>
        </div>
      </div>

      {/* 12-Month Calendar Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {report.monthlyStats.map((stat) => {
          const style = RISK_TIER_STYLES[stat.riskTier];
          return (
            <div
              key={stat.month}
              className={`rounded-lg border p-2.5 flex flex-col gap-1.5 transition ${style.cardClass}`}
              title={`${stat.fullName}: Active in ${stat.activeYears}/${stat.totalObservedYears} yrs (${stat.frequencyPercent}%), Mean Activity Index: ${stat.meanActivity}, High+ Anomaly: ${stat.highAnomalyCount} yrs`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-100">
                  {stat.shortName}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.badgeClass}`}
                >
                  {style.label}
                </span>
              </div>

              <div className="flex items-baseline justify-between tabular-nums">
                <span className="text-sm font-bold text-white">
                  {stat.frequencyPercent}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {stat.activeYears}/{stat.totalObservedYears}y
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${style.barClass}`}
                  style={{ width: `${stat.frequencyPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>
                  Mean: <strong className="text-slate-200">{stat.meanActivity}</strong>
                </span>
                {stat.highAnomalyCount > 0 && (
                  <span className="text-orange-300/90" title="High or Very High anomaly years">
                    {stat.highAnomalyCount}H+
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology & Scope Disclaimer */}
      <div className="flex items-start gap-2 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-300">Methodology & Scope Note:</strong>{' '}
          Activity Index is a calibrated MODIS/VIIRS hotspot detection metric, not
          a direct measure of fire severity or burned area. Missing months are
          imputed as <code className="text-slate-300">UNVERIFIED_ZERO</code> and
          do not confirm the absence of fire. Geographic coverage is bounded
          (57.8°S–38.9°N lat, 120.6°W–180.0°E lon).
        </span>
      </div>
    </section>
  );
}