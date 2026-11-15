import { useState } from 'react';
import { Flame, Crosshair, Calendar } from 'lucide-react';
import { GlobeView } from './components/globe/GlobeView';
import AnalyticsPanel from './components/charts/AnalyticsPanel';
import { useCellSeries } from './hooks/useCellSeries';
import { MONTH_SHORT } from './utils/seasonality';
import type { FireDataRow } from './types/fireData';

export default function App() {
  const [selectedCell, setSelectedCell] = useState<FireDataRow | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);

  const {
    rows: cellSeries,
    loading: isCellLoading,
    error: cellError,
  } = useCellSeries(selectedCell?.grid_id ?? null);

  const panelData =
    cellSeries.length > 0 ? cellSeries : selectedCell ? [selectedCell] : [];

  return (
    <div
      lang="en"
      className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Top Application Header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-900/85 backdrop-blur-md px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/35 shadow-sm shadow-orange-950/40">
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          <div className="flex items-center gap-2 truncate">
            <h1 className="text-sm font-bold tracking-tight text-slate-100 truncate">
              NASA FIRMS — Fire Activity Calendar
            </h1>
            <span className="hidden md:inline-flex items-center rounded-full bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              2000–2026 Archive
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 tabular-nums">
            <Calendar className="h-3 w-3 text-orange-400" />
            {MONTH_SHORT[selectedMonth - 1]} {selectedYear}
          </span>

          {selectedCell ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-mono text-cyan-300 tabular-nums">
              <Crosshair className="h-3 w-3 text-cyan-400" />
              Cell {selectedCell.grid_id} ({selectedCell.lat}°, {selectedCell.lon}°)
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Select a 2°×2° grid cell on the globe to inspect
            </span>
          )}
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex flex-1 overflow-hidden">
        <section className="w-7/12 h-full relative">
          <GlobeView
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
        </section>

        <aside className="w-5/12 h-full overflow-hidden border-l border-slate-800/80 bg-slate-950 p-2.5">
          <AnalyticsPanel
            selectedCell={selectedCell}
            selectedCellData={panelData}
            regionTitle={selectedCell?.grid_id}
            loading={isCellLoading}
            error={cellError}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        </aside>
      </main>
    </div>
  );
}