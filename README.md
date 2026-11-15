# NASA FIRMS — Yangın Aktivitesi Takvimi

MODIS (2000–2026), VIIRS NOAA-20 (2018–2026) ve VIIRS NOAA-21 (2023–2026) uydu aktif yangın (hotspot) verilerini 2° × 2° mekânsal ızgarada uyumlaştıran, çok yıllık mevsimsellik ve anomali analizi sunan etkileşimli web uygulaması.

> **Bilimsel Sorumluluk Notu:** Bu uygulama uydu sıcak nokta kayıtlarına dayalı **tarihsel aktivite ve anomali göstergesi** sunar; operasyonel erken uyarı sistemi veya yangın tahmini değildir.

---

## Proje Yapısı

```text
nasa-fire-calendar/
├── data/
│   ├── raw/              # NASA FIRMS arşiv CSV dosyaları (Git'e dahil değildir)
│   └── processed/        # Pipeline ara çıktıları (Git'e dahil değildir)
├── docs/                 # Metodoloji ve teknik dokümantasyon
├── pipeline/             # Python & DuckDB veri temizleme, uyumlaştırma ve anomali hattı
└── web/                  # React + TypeScript + Vite + Tailwind + Three.js/ECharts arayüzü
```

---

## Gereksinimler

- **Node.js:** `>= 22.0.0` (test edilen sürüm kök dizindeki `.nvmrc` dosyasında sabitlenmiştir)
- **Python:** `3.11+` (test edilen sürüm: `3.13`)

---

## Kurulum ve Çalıştırma (Web Arayüzü)

```bash
cd web
npm install
npm run dev
```

Üretim derlemesi ve kod kalite kontrolü için:

```bash
cd web
npm run lint
npm run build
```

---

## Veri İndirme ve Python Pipeline Çalıştırma Sırası

Web arayüzü herhangi bir canlı backend sunucusuna ihtiyaç duymadan `web/public/data/{yıl}.csv` statik dosyalarını okur. Veri hattını sıfırdan çalıştırmak için:

### 1. Python Sanal Ortamını Kurun

```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\pip install -r pipeline\requirements.txt
# macOS / Linux:
source .venv/bin/activate && pip install -r pipeline/requirements.txt
```

### 2. Ham FIRMS Verilerini İndirin

1. [NASA FIRMS Archive Download](https://firms.modaps.eosdis.nasa.gov/download/) sayfasından CSV formatında arşiv talebi oluşturun.
2. İndirilen dosyaları `data/raw/` klasörü altına yerleştirin. `clean.py` dosya adındaki sensör kodunu otomatik tanır:
   - `M-C61` → MODIS Collection 6.1
   - `SV-C2` → VIIRS S-NPP
   - `J1V-C2` → VIIRS NOAA-20
   - `J2V-C2` → VIIRS NOAA-21
3. Her CSV dosyası en az `latitude`, `longitude`, `acq_date` ve `frp` sütunlarını içermelidir.

### 3. Pipeline Adımlarını Sırasıyla Çalıştırın

```bash
.\.venv\Scripts\python pipeline\clean.py
.\.venv\Scripts\python pipeline\aggregate.py
.\.venv\Scripts\python pipeline\harmonize.py
.\.venv\Scripts\python pipeline\anomalies_v2.py
.\.venv\Scripts\python pipeline\export_frontend.py
.\.venv\Scripts\python pipeline\split_frontend.py
```

| Adım | Betik | Açıklama |
| :--- | :--- | :--- |
| 1 | `clean.py` | `data/raw/` altındaki ham CSV dosyalarını temizler ve sensör etiketler. |
| 2 | `aggregate.py` | Kayıtları 2° × 2° ızgara hücrelerinde aylık bazda toplulaştırır. |
| 3 | `harmonize.py` | MODIS ve VIIRS ölçümlerini tek aktivite indeksinde kalibre eder. |
| 4 | `anomalies_v2.py` | Tarihsel taban çizgisine göre z-skoru ve anomali sınıflarını hesaplar. |
| 5 | `export_frontend.py` | Arayüz şemasına uygun `data/processed/frontend_activity.csv` çıktısını üretir. |
| 6 | `split_frontend.py` | Veriyi yıllara bölerek `web/public/data/{yıl}.csv` dosyalarını oluşturur. |

---

## Mevcut Veri Kapsamı Notu

- **Zaman Aralığı:** Kasım 2000 – Ekim 2026. Başlangıç ve bitiş yılları kısmi kapsam içerir.
- **Kullanılan Sensörler:** MODIS (2000–2026), VIIRS NOAA-20 (2018–2026), VIIRS NOAA-21 (2023–2026).
- **NASA FIRMS İndirme Sınırları:** Batı -120.6°, Güney -57.8°, Doğu 180°, Kuzey 38.9°.
- **Mekânsal Çözünürlük:** 2° × 2° grid.
- **Önemli Sınırlama:** Veri seti küresel değildir. İndirme sınırları dışındaki bölgeler için yangın aktivitesi değerlendirilemez.
- **Eksik Veri:** Hotspot kaydı bulunmaması, yangın olmadığı veya uydu gözleminin eksiksiz olduğu anlamına gelmez.
- **Doğrulama:** 566.355 harmonize kaydın koordinatları kontrol edilmiştir; geçersiz koordinat bulunmamıştır. Bu kontrol bölgesel veri bütünlüğünü kanıtlamaz.
