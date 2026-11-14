# NASA Space Apps – Küresel Yangın Aktivitesi Takvimi

## 1. Kilitli MVP Kapsamı (Çekirdek Özellikler)
- **3D Küre (`react-globe.gl`):** Tüm dünyayı kapsayan 1° veya 2° ızgara hücrelerinde ay kaydırıcısı (slider) ile yangın yoğunluğu gösterimi.
- **Yangın Aktivitesi Takvimi (Apache ECharts):** Seçilen ızgara hücresi için erişilebilir (renk körü dostu) paletle Yıl × Ay ısı haritası.
- **Mevsimsellik ve Anomali Grafikleri (Apache ECharts):** Ay bazlı tarihsel ortalama grafiği (tepe ay vurgulu) ve çok yıllık ortalamaya göre sapma göstergesi.
- **MODIS + VIIRS Uyumlaştırma:** Farklı çözünürlükteki sensör kayıtlarının ay bazlı yüzdelik dilim / z-skoru yöntemiyle tek zaman serisine dönüştürülmesi.
- **CSV Veri İndirme:** Seçilen hücrenin aylık özet ve uyumlaştırılmış verilerinin tarayıcı üzerinden `.csv` olarak indirilmesi.
- **Mimari:** Backend sunucusu olmadan, Python veri hattından üretilen statik veri dosyalarının (`CSV` veya `JSON`) doğrudan tarayıcıda işlenmesi.

## 2. Yapılırsa Güzel (Ek Özellikler – Kesme Sırasına Göre)
*Süre yetmezse 1 numaradan başlanarak sırayla kapsamdan çıkarılır:*
1. **Hikâye Modu:** Kürenin önemli yangın bölgelerine otomatik uçuşu (demo videosu için).
2. **Yangın Sezonu Kayması Göstergesi:** Sezonun son yıllarda erken veya geç başlayıp başlamadığı.
3. **İtfaiye İstasyonları Karar Desteği:** OpenStreetMap üzerinden en yakın istasyonların gösterimi.
4. **E-posta Bildirim Simülasyonu:** Riskli dönemler için arayüz içi örnek bildirim önizlemesi (gerçek gönderim yok).

## 3. Kesin Kapsam Dışı
- Canlı backend sunucusu ve veritabanı
- Gerçek e-posta veya SMS gönderim altyapısı
- Landsat 30 m, NOAA-20/21 verileri ve hava durumu katmanı
- Küre üzerinde serbest poligon çizimi ile alan seçimi
- Canlı sunucuya deploy (teslim video ve rapor ile yapılacak)