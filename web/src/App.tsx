import { useState } from 'react';
import { GlobeView } from './components/globe/GlobeView';
import AnalyticsPanel from './components/charts/AnalyticsPanel';
import { useCellSeries } from './hooks/useCellSeries';
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
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <h1 className="text-sm font-bold tracking-wide">
            NASA FIRMS — Global Fire Activity Calendar
          </h1>
        </div>
        <span className="text-xs text-slate-400">
          {selectedCell
            ? `Selected Cell: ${selectedCell.grid_id} (${selectedCell.lat}°, ${selectedCell.lon}°)`
            : 'Select a 2°×2° cell from the sphere for examination'}
        </span>
      </header>

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
        <aside className="w-5/12 h-full overflow-y-auto">
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
