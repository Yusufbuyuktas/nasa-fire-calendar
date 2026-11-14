export function AnalyticsPanel() {
  return (
    <div className="flex h-full w-full flex-col justify-between p-4 bg-slate-900 border-l border-slate-800 text-slate-300">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Yangın Aktivitesi Analizi
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          Yıl × Ay Takvim Isı Haritası, Mevsimsellik ve Anomali Grafikleri burada yer alacak.
        </p>
        <p className="text-xs text-orange-400 mt-1">Geliştirici: Bilal (feat/bilal-charts)</p>
      </div>
    </div>
  );
}