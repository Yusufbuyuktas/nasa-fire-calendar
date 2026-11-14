import { GlobeView } from './components/globe/GlobeView';
import { AnalyticsPanel } from './components/charts/AnalyticsPanel';

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Üst Bilgi Çubuğu */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <h1 className="text-sm font-bold tracking-wide">
            NASA FIRMS — Küresel Yangın Aktivitesi Takvimi
          </h1>
        </div>
        <span className="text-xs text-slate-400">MODIS + VIIRS Uyumlaştırılmış Seri</span>
      </header>

      {/* Ana Çalışma Alanı: Sol Küre (7/12), Sağ Grafikler (5/12) */}
      <main className="flex flex-1 overflow-hidden">
        <section className="w-7/12 h-full relative">
          <GlobeView />
        </section>
        <aside className="w-5/12 h-full overflow-y-auto">
          <AnalyticsPanel />
        </aside>
      </main>
    </div>
  );
}