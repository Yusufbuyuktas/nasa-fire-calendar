import { useState } from 'react';
import type { FireDataRow } from '../../types/fireData';

interface EmailAlertSimulationProps {
  regionTitle: string;
  selectedCellData: FireDataRow[];
}

export default function EmailAlertSimulation({ regionTitle, selectedCellData }: EmailAlertSimulationProps) {
  const [email, setEmail] = useState('');
  const [threshold, setThreshold] = useState('2.0');
  const [showPreview, setShowPreview] = useState(false);

  const exceededMonths = selectedCellData.filter(row => (row.z_score ?? 0) > parseFloat(threshold));
  const totalExceeded = exceededMonths.length;
  const lastExceeded = totalExceeded > 0 ? exceededMonths[exceededMonths.length - 1] : null;

  return (
    <div className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 mt-2 shrink-0">
      <h3 className="text-md font-semibold mb-1 text-orange-500">Early Warning Simulation</h3>
      <p className="text-xs text-gray-400 mb-4">
        Test the alert email that will be sent when the set Z-Score threshold is exceeded in this region. <br/>
        (This is a historical simulation, not an operational early warning system.)
      </p>
      
      <div className="flex flex-col gap-3">
        <input 
          type="email" 
          placeholder="Your email address..." 
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowPreview(false);
          }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-orange-500 transition-colors"
        />
        
        <div className="flex items-center justify-between gap-2 bg-gray-950 p-2 rounded border border-gray-800">
          <label className="text-xs text-gray-300 font-medium">Anomaly Threshold (Z-Score): <span className="text-orange-400">{threshold}</span></label>
          <input 
            type="range" 
            min="1.0" max="4.0" step="0.5" 
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setShowPreview(false);
            }}
            className="w-1/2 accent-orange-600 cursor-pointer"
          />
        </div>
        
        <button 
          onClick={() => setShowPreview(true)}
          disabled={!email.includes('@')}
          className="mt-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800 disabled:text-gray-600 text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer"
        >
          Generate Preview
        </button>
      </div>

      {showPreview && (
        <div className="mt-4 p-3 bg-black border border-gray-700 rounded-lg text-xs font-mono text-gray-300 shadow-inner">
          <p><strong className="text-gray-500">From:</strong> alerts@example.org</p>
          <p><strong className="text-gray-500">To:</strong> {email}</p>
          <p><strong className="text-gray-500">Subject:</strong> WARNING: High Fire Risk in {regionTitle}</p>
          <hr className="border-gray-800 my-2" />
          <p>Dear Official,</p>
          <br/>
          <p>According to NASA FIRMS (MODIS/VIIRS) harmonized satellite data analysis, a significant deviation from the historical average (Z-Score &gt; {threshold}) has been detected in cell <strong>{regionTitle}</strong>.</p>
          <br/>
          {totalExceeded > 0 ? (
            <p>This threshold was exceeded a total of <strong>{totalExceeded} times</strong> between 2000-2026. The last exceedance occurred in <strong>{lastExceeded?.month}/{lastExceeded?.year}</strong>.</p>
          ) : (
            <p>This threshold has never been exceeded for this cell between 2000-2026.</p>
          )}
          <br/>
          <p>Please inform field teams and local units immediately.</p>
          <br/>
          <p>Stay safe,<br/>Global Fire Activity Calendar</p>
        </div>
      )}
    </div>
  );
}