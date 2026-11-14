import type { FireGridRow } from '../../types/fireData';

interface AnalyticsPanelProps {
  selectedCell?: FireGridRow | null;
}

export function AnalyticsPanel({ selectedCell }: AnalyticsPanelProps) {
  return (
    <div className="flex h-full w-full flex-col justify-between p-4 bg-slate-900 border-l border-slate-800 text-slate-300">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Yangın Aktivitesi Analizi
        </h2>
        {selectedCell ? (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
            <p className="font-semibold text-orange-400">Seçili Hücre: {selectedCell.grid_id}</p>
            <p>Koordinat: {selectedCell.lat}°, {selectedCell.lon}° (2°×2°)</p>
            <p>Aktivite İndeksi: {selectedCell.activity_index}</p>
            <p>Anomali: {selectedCell.anomaly_level}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 mt-2">
            Detaylı takvim ısı haritası ve mevsimsellik grafikleri için küreden bir hücre seçin.
          </p>
        )}
      </div>
    </div>
  );
}