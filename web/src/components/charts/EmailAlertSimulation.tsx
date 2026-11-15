import { useMemo, useState } from 'react';
import {
  BellRing,
  Mail,
  ShieldAlert,
  Trees,
  Sparkles,
  Info,
} from 'lucide-react';
import type { FireDataRow } from '../../types/fireData';
import { MONTH_SHORT } from '../../utils/seasonality';

interface EmailAlertSimulationProps {
  regionTitle: string;
  selectedCellData?: FireDataRow[];
}

type RecipientRole = 'official' | 'manager';

function getThresholdSeverity(z: number): {
  label: string;
  badgeClass: string;
} {
  if (z >= 3.0) {
    return {
      label: 'Extreme Outlier',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    };
  }
  if (z >= 2.0) {
    return {
      label: 'Very High',
      badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    };
  }
  return {
    label: 'High',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
  };
}

export default function EmailAlertSimulation({
  regionTitle,
  selectedCellData = [],
}: EmailAlertSimulationProps) {
  const [email, setEmail] = useState('');
  const [threshold, setThreshold] = useState('2.0');
  const [role, setRole] = useState<RecipientRole>('official');
  const [showPreview, setShowPreview] = useState(false);

  const thresholdNum = Number(threshold);
  const severity = getThresholdSeverity(thresholdNum);

  const exceedanceStats = useMemo(() => {
    const exceededMonths = selectedCellData
      .filter(
        (row) =>
          row.activity_index > 0 &&
          typeof row.z_score === 'number' &&
          Number.isFinite(row.z_score) &&
          row.z_score >= thresholdNum
      )
      .sort((a, b) => a.year - b.year || a.month - b.month);

    const totalExceeded = exceededMonths.length;
    const lastExceeded =
      totalExceeded > 0 ? exceededMonths[totalExceeded - 1] : null;

    return {
      totalExceeded,
      lastExceeded,
    };
  }, [selectedCellData, thresholdNum]);

  return (
    <section className="bg-slate-900/50 backdrop-blur-md text-white p-4 rounded-xl border border-slate-800/90 shadow-lg shrink-0 transition-all duration-300 hover:border-orange-500/30 animate-fade-in flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/25 p-1.5">
            <BellRing className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 leading-tight">
              Threshold Alert Simulation
            </h3>
            <p className="text-[11px] text-slate-400">
              Preview role-based alerts when LOYO Z-Score exceeds threshold
            </p>
          </div>
        </div>

        <span className="rounded-full bg-slate-800/90 text-slate-300 border border-slate-700 text-[10px] font-semibold px-2.5 py-0.5 tracking-wide">
          Sandbox
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Recipient Role Selector */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setRole('official');
              setShowPreview(false);
            }}
            className={`flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-all duration-200 cursor-pointer ${
              role === 'official'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />
            Local Official
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('manager');
              setShowPreview(false);
            }}
            className={`flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-all duration-200 cursor-pointer ${
              role === 'manager'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Trees className="h-3.5 w-3.5 text-emerald-400" />
            Land Manager
          </button>
        </div>

        {/* Email Input */}
        <input
          type="email"
          placeholder="Recipient email address (e.g., official@example.org)..."
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowPreview(false);
          }}
          className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500 transition-colors"
        />

        {/* Z-Score Threshold Slider */}
        <div className="flex flex-col gap-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between gap-2 text-xs">
            <label className="text-slate-300 font-medium">
              Z-Score Threshold:{' '}
              <span className="font-mono font-bold text-orange-400 tabular-nums">
                ≥ +{threshold}σ
              </span>
            </label>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${severity.badgeClass}`}
            >
              {severity.label}
            </span>
          </div>

          <input
            type="range"
            min="1.0"
            max="4.0"
            step="0.5"
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setShowPreview(false);
            }}
            className="w-full accent-orange-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono tabular-nums">
            <span>+1.0σ</span>
            <span>+2.0σ</span>
            <span>+3.0σ</span>
            <span>+4.0σ</span>
          </div>
        </div>

        {/* Generate Preview Button */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={!email.includes('@')}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-xs font-bold py-2.5 rounded-lg transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate Preview
        </button>
      </div>

      {/* Email Preview Area */}
      {showPreview && (
        <div className="p-3.5 bg-slate-950/90 border border-white/10 rounded-xl text-xs text-slate-300 shadow-inner animate-fade-in space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-400">
            <Mail className="h-3.5 w-3.5" />
            Simulated Alert Dispatch
          </div>

          <div className="space-y-1 rounded-lg bg-slate-900/80 border border-slate-800 p-2.5 font-mono text-[11px]">
            <p>
              <strong className="text-slate-500">From:</strong>{' '}
              alerts@example.org
            </p>
            <p>
              <strong className="text-slate-500">To:</strong>{' '}
              <span className="text-cyan-300">{email}</span>
            </p>
            <p>
              <strong className="text-slate-500">Subject:</strong>{' '}
              <span className="text-slate-100 font-semibold">
                [SIMULATION] Elevated Hotspot Anomaly in {regionTitle}
              </span>
            </p>
          </div>

          <div className="space-y-2 leading-relaxed">
            <p>
              Dear {role === 'official' ? 'Local Official' : 'Land Manager'},
            </p>

            <p>
              According to harmonized NASA FIRMS (MODIS &amp; VIIRS) satellite
              hotspot analysis, a statistically significant deviation from the
              historical baseline (LOYO Z-Score ≥{' '}
              <strong className="text-orange-300">+{threshold}σ</strong>) was
              observed in grid cell{' '}
              <strong className="text-slate-100">{regionTitle}</strong>.
            </p>

            {exceedanceStats.totalExceeded > 0 && exceedanceStats.lastExceeded ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-[11px]">
                This threshold was exceeded{' '}
                <strong className="text-orange-300">
                  {exceedanceStats.totalExceeded} time(s)
                </strong>{' '}
                historically (2000–2026). Most recent exceedance:{' '}
                <strong className="text-slate-100">
                  {MONTH_SHORT[exceedanceStats.lastExceeded.month - 1]}{' '}
                  {exceedanceStats.lastExceeded.year}
                </strong>{' '}
                (Z = +{exceedanceStats.lastExceeded.z_score!.toFixed(2)}σ).
              </p>
            ) : (
              <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-[11px] text-slate-400">
                This threshold has never been exceeded for cell {regionTitle}{' '}
                across the 2000–2026 historical archive.
              </p>
            )}

            {role === 'official' ? (
              <p>
                Please coordinate with emergency services, inform field teams,
                and review local readiness protocols for potential operational
                deployment.
              </p>
            ) : (
              <p>
                As this area falls under your stewardship, please review
                controlled burn schedules, vegetation clearing activities, and
                preventive resource allocation to mitigate wildfire risk.
              </p>
            )}

            <p className="text-slate-400 pt-1">
              Regards,
              <br />
              <span className="text-slate-200 font-medium">
                Global Fire Activity Calendar (Simulation Preview)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer Footer */}
      <div className="flex items-start gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
        <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          Retrospective threshold preview based on historical LOYO Z-scores; no
          live emails are dispatched and this does not constitute an operational
          early-warning feed.
        </span>
      </div>
    </section>
  );
}