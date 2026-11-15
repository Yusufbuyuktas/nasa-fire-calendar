import { useState } from 'react';
import type { FireDataRow } from '../../types/fireData';

interface EmailAlertSimulationProps {
  regionTitle: string;
  selectedCellData: FireDataRow[];
}

export default function EmailAlertSimulation({ regionTitle, selectedCellData }: EmailAlertSimulationProps) {
  const [email, setEmail] = useState('');
  const [threshold, setThreshold] = useState('2.0');
  const [role, setRole] = useState<'official' | 'manager'>('official'); // YENİ: Rol State'i
  const [showPreview, setShowPreview] = useState(false);

  const exceededMonths = selectedCellData.filter(row => (row.z_score ?? 0) > parseFloat(threshold));
  const totalExceeded = exceededMonths.length;
  const lastExceeded = totalExceeded > 0 ? exceededMonths[exceededMonths.length - 1] : null;

  return (
    /* YENİ: Cam efekti (glassmorphism) ve hover parlaması uygulandı */
    <div className="bg-slate-900/40 backdrop-blur-md text-white p-4 rounded-xl border border-white/10 shadow-lg mt-2 shrink-0 transition-all duration-300 hover:border-orange-500/30 animate-fade-in">
      <h3 className="text-md font-semibold mb-1 text-orange-500">Early Warning Simulation</h3>
      <p className="text-xs text-slate-400 mb-4">
        Test the alert email that will be sent when the set Z-Score threshold is exceeded.
      </p>
      
      <div className="flex flex-col gap-3">
        {/* YENİ: Alıcı Rolü Seçici (Toggle) */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
          <button 
            onClick={() => { setRole('official'); setShowPreview(false); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-all duration-200 ${role === 'official' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Local Official
          </button>
          <button 
            onClick={() => { setRole('manager'); setShowPreview(false); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-all duration-200 ${role === 'manager' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Land Manager
          </button>
        </div>

        <input 
          type="email" 
          placeholder="Recipient email address..." 
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowPreview(false);
          }}
          className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 transition-colors"
        />
        
        <div className="flex items-center justify-between gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
          <label className="text-xs text-slate-300 font-medium">Z-Score Threshold: <span className="text-orange-400">{threshold}</span></label>
          <input 
            type="range" 
            min="1.0" max="4.0" step="0.5" 
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setShowPreview(false);
            }}
            className="w-1/2 accent-orange-500 cursor-pointer"
          />
        </div>
        
        {/* YENİ: Modern Gradient Buton */}
        <button 
          onClick={() => setShowPreview(true)}
          disabled={!email.includes('@')}
          className="mt-1 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-sm font-bold py-2.5 rounded-lg transition-all shadow-md cursor-pointer"
        >
          Generate Preview
        </button>
      </div>

      {/* E-POSTA ÖNİZLEME ALANI */}
      {showPreview && (
        <div className="mt-4 p-3 bg-black/50 border border-white/10 rounded-lg text-xs font-mono text-slate-300 shadow-inner animate-fade-in">
          <p><strong className="text-slate-500">From:</strong> alerts@nasa-firms-calendar.org</p>
          <p><strong className="text-slate-500">To:</strong> {email}</p>
          <p><strong className="text-slate-500">Subject:</strong> ACTION REQUIRED: High Fire Anomaly in {regionTitle}</p>
          <hr className="border-slate-800/80 my-2" />
          
          {/* Dinamik Hitap */}
          <p>Dear {role === 'official' ? 'Local Official' : 'Land Manager'},</p>
          <br/>
          <p>According to NASA FIRMS satellite data analysis, a significant deviation from the historical average (Z-Score &gt; {threshold}) has been detected in cell <strong>{regionTitle}</strong>.</p>
          <br/>
          
          {totalExceeded > 0 ? (
            <p>This threshold was exceeded <strong>{totalExceeded} times</strong> historically. Last exceedance: <strong>{lastExceeded?.month}/{lastExceeded?.year}</strong>.</p>
          ) : (
            <p>This threshold has never been exceeded for this cell historically.</p>
          )}
          <br/>
          
          {/* YENİ: Role Göre Değişen Aksiyon Metni */}
          {role === 'official' ? (
            <p>Please coordinate with emergency services, inform field teams, and prepare local units for potential operational deployment.</p>
          ) : (
            <p>As this area falls under your management, we strongly advise reviewing your controlled burn schedules, land clearing activities, and resource allocation to mitigate potential wildfire risks.</p>
          )}
          <br/>
          <p>Stay safe,<br/>Global Fire Activity Calendar</p>
        </div>
      )}
    </div>
  );
}