import { useState } from 'react';

interface EmailAlertSimulationProps {
  regionTitle: string;
}

export default function EmailAlertSimulation({ regionTitle }: EmailAlertSimulationProps) {
  const [email, setEmail] = useState('');
  const [threshold, setThreshold] = useState('2.0');
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 mt-2">
      <h3 className="text-md font-semibold mb-1 text-orange-500">Erken Uyarı Simülasyonu</h3>
      <p className="text-xs text-gray-400 mb-4">
        Seçili bölgede belirlediğiniz Z-Skoru eşiği aşıldığında gönderilecek uyarı e-postasını test edin (Gerçek gönderim yapılmaz).
      </p>
      
      <div className="flex flex-col gap-3">
        <input 
          type="email" 
          placeholder="E-posta adresiniz..." 
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowPreview(false);
          }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-orange-500 transition-colors"
        />
        
        <div className="flex items-center justify-between gap-2 bg-gray-950 p-2 rounded border border-gray-800">
          <label className="text-xs text-gray-300 font-medium">Anomali Eşiği (Z-Skoru): <span className="text-orange-400">{threshold}</span></label>
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
          Önizleme Oluştur
        </button>
      </div>

      {showPreview && (
        <div className="mt-4 p-3 bg-black border border-gray-700 rounded-lg text-xs font-mono text-gray-300 shadow-inner">
          <p><strong className="text-gray-500">Kimden:</strong> alerts@nasa-firms-calendar.org</p>
          <p><strong className="text-gray-500">Kime:</strong> {email}</p>
          <p><strong className="text-gray-500">Konu:</strong> DİKKAT: {regionTitle} Bölgesinde Yüksek Yangın Riski</p>
          <hr className="border-gray-800 my-2" />
          <p>Sayın Yetkili,</p>
          <br/>
          <p>NASA FIRMS (MODIS/VIIRS) uyumlaştırılmış uydu verisi analizlerine göre, <strong>{regionTitle}</strong> bölgesinde tarihsel ortalamadan belirgin bir sapma (Z-Skoru &gt; {threshold}) tespit edilmiştir.</p>
          <br/>
          <p>Erken uyarı sistemimiz bu bölgedeki yangın aktivitesinin olağandışı bir seyir izlediğini göstermektedir. Lütfen saha ekiplerini ve yerel birimleri teyakkuza geçirin.</p>
          <br/>
          <p>Güvenli günler dileriz,<br/>Küresel Yangın Aktivitesi Takvimi</p>
        </div>
      )}
    </div>
  );
}