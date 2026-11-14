import { useState } from 'react';
import { GlobeView } from './components/globe/GlobeView';
import AnalyticsPanel from './components/charts/AnalyticsPanel';
import type { FireDataRow } from './types/fireData';

export default function App() {
  const [selectedCell, setSelectedCell] = useState<FireDataRow | null>(null);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <h1 className="text-sm font-bold tracking-wide">
            NASA FIRMS — Küresel Yangın Aktivitesi Takvimi
          </h1>
        </div>
        <span className="text-xs text-slate-400">
          {selectedCell
            ? `Seçili Hücre: ${selectedCell.grid_id} (${selectedCell.lat}°, ${selectedCell.lon}°)`
            : 'İncelemek için küreden bir 2°×2° hücre seçin'}
        </span>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <section className="w-7/12 h-full relative">
          <GlobeView selectedCell={selectedCell} onSelectCell={setSelectedCell} />
        </section>
        <aside className="w-5/12 h-full overflow-y-auto">
          <AnalyticsPanel 
  selectedCellData={selectedCell ? [selectedCell] : []} 
  regionTitle={selectedCell?.grid_id}
/>
        </aside>
      </main>
    </div>
  );
}