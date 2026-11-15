import { Calendar, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import type {
  CellSeasonalityReport,
  MonthRiskTier,
} from '../../utils/seasonality';

interface RiskCalendarCardProps {
  report: CellSeasonalityReport;
}

const RISK_TIER_STYLES: Record<
  MonthRiskTier,
  { label: string; badgeClass: string; cardClass: string }
> = {
  CRITICAL: {
    label: 'Kritik',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    cardClass: 'border-red-500/40 bg-red-950/20',
  },
  HIGH: {
    label: 'Yüksek',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    cardClass: 'border-orange-500/35 bg-orange-950/15',
  },
  MODERATE: {
    label: 'Orta',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
    cardClass: 'border-amber-500/25 bg-slate-900/80',
  },
  LOW: {
    label: 'Düşük',
    badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600/40',
    cardClass: 'border-slate-800 bg-slate-900/50',
  },
};

export default function RiskCalendarCard({ report }: RiskCalendarCardProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            12 Aylık Tarihsel Risk Takvimi & Periyodiklik
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          {report.activeYearCount}/26 aktif yıl • {report.totalActiveMonths}/
          {report.totalObservedMonths} aktif ay
        </span>
      </div>

      <div
        className={`rounded-lg border p-2.5 text-xs leading-relaxed flex items-start gap-2 ${
          report.hasSufficientHistory
            ? 'border-slate-800 bg-slate-900/90 text-slate-200'
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

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">Mevsimsel Odaklanma</div>
          <div className="text-xs font-bold text-slate-100 mt-0.5">
            %{Math.round(report.seasonalConcentration * 100)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">Yıllık Döngü (Lag-12)</div>
          <div className="text-xs font-bold text-slate-100 mt-0.5">
            {report.lag12Autocorrelation !== null
              ? `r = ${report.lag12Autocorrelation.toFixed(2)}`
              : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">2 Yıllık Döngü (Lag-24)</div>
          <div className="text-xs font-bold text-slate-100 mt-0.5">
            {report.lag24Autocorrelation !== null
              ? `r = ${report.lag24Autocorrelation.toFixed(2)}`
              : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {report.monthlyStats.map((stat) => {
          const style = RISK_TIER_STYLES[stat.riskTier];
          return (
            <div
              key={stat.month}
              className={`rounded-lg border p-2 flex flex-col gap-1 transition ${style.cardClass}`}
              title={`${stat.fullName}: ${stat.activeYears}/${stat.totalObservedYears} yılda aktif (%${stat.frequencyPercent}), Ortalama Aktivite İndeksi: ${stat.meanActivity}, Yüksek Anomali: ${stat.highAnomalyCount} yıl`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-100">
                  {stat.shortName}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.2 text-[10px] font-medium ${style.badgeClass}`}
                >
                  {style.label}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-sm font-bold text-white">
                  %{stat.frequencyPercent}
                </span>
                <span className="text-[10px] text-slate-400">
                  {stat.activeYears}/{stat.totalObservedYears}y
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${stat.frequencyPercent}%` }}
                />
              </div>

              <div className="text-[10px] text-slate-400 truncate">
                Ort: <strong className="text-slate-200">{stat.meanActivity}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
        <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong>Metodoloji & Kapsam Notu:</strong> Aktivite indeksi kalibre
          edilmiş MODIS/VIIRS sıcak nokta (hotspot) tespit ölçüsüdür; doğrudan
          yangın şiddeti veya yanan alan değildir. Tespit bulunmayan aylar{' '}
          <code className="text-slate-300">UNVERIFIED_ZERO</code> (varsayımsal
          sıfır) olarak işlenmiştir ve kesin yangın yokluğu anlamına gelmez.
          Veri kapsamı küresel değildir (57.8°G–38.9°K enlem, 120.6°B–180.0°D
          boylam).
        </span>
      </div>
    </section>
  );
}