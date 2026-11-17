# NASA FIRMS — Fire Activity Calendar

> 🏆 **3rd Place Winner & Global Nominee** — *NASA Space Apps Challenge (Sakarya)*  
> 🌐 **Live Application:** [https://nasa-fire-calendar.vercel.app/](https://nasa-fire-calendar.vercel.app/)

An interactive web application that harmonizes active fire (hotspot) satellite data from **MODIS (2000–2026)**, **VIIRS NOAA-20 (2018–2026)**, and **VIIRS NOAA-21 (2023–2026)** on a **2° × 2° spatial grid**, providing multi-year seasonality and anomaly analysis.

> **Scientific Responsibility Note:** This application provides a **historical activity and anomaly indicator** based on satellite hotspot records; it is not an operational early-warning system or a wildfire forecasting tool.

---

## Project Structure

```text
nasa-fire-calendar/
├── data/
│   ├── raw/              # NASA FIRMS archive CSV files (excluded from Git)
│   └── processed/        # Pipeline intermediate outputs (excluded from Git)
├── docs/                 # Methodology and technical documentation
├── pipeline/             # Python & DuckDB data cleaning, harmonization, and anomaly pipeline
└── web/                  # React + TypeScript + Vite + Tailwind + Three.js/ECharts frontend
```

---

## Requirements

- **Node.js:** `>= 22.0.0` (tested version is pinned in `.nvmrc` in the root directory)
- **Python:** `3.11+` (tested version: `3.13`)

---

## Setup & Running (Web Interface)

```bash
cd web
npm install
npm run dev
```

For production build and code quality checks:

```bash
cd web
npm run lint
npm run build
```

---

## Data Download & Python Pipeline Execution Order

The web interface reads static `web/public/data/{year}.csv` files without requiring any live backend server. To run the data pipeline from scratch:

### 1. Set Up the Python Virtual Environment

```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\pip install -r pipeline\requirements.txt
# macOS / Linux:
source .venv/bin/activate && pip install -r pipeline/requirements.txt
```

### 2. Download Raw FIRMS Data

1. Submit an archive request in CSV format from the [NASA FIRMS Archive Download](https://firms.modaps.eosdis.nasa.gov/download/) page.
2. Place the downloaded files into the `data/raw/` directory. `clean.py` automatically detects the sensor code from the filename:
   - `M-C61` → MODIS Collection 6.1
   - `SV-C2` → VIIRS S-NPP
   - `J1V-C2` → VIIRS NOAA-20
   - `J2V-C2` → VIIRS NOAA-21
3. Each CSV file must contain at least the `latitude`, `longitude`, `acq_date`, and `frp` columns.

### 3. Run the Pipeline Steps Sequentially

```bash
.\.venv\Scripts\python pipeline\clean.py
.\.venv\Scripts\python pipeline\aggregate.py
.\.venv\Scripts\python pipeline\harmonize.py
.\.venv\Scripts\python pipeline\anomalies_v2.py
.\.venv\Scripts\python pipeline\export_frontend.py
.\.venv\Scripts\python pipeline\split_frontend.py
```

| Step | Script | Description |
| :--- | :--- | :--- |
| 1 | `clean.py` | Cleans raw CSV files under `data/raw/` and assigns sensor labels. |
| 2 | `aggregate.py` | Aggregates records on a monthly basis into 2° × 2° grid cells. |
| 3 | `harmonize.py` | Calibrates MODIS and VIIRS measurements into a single unified activity index. |
| 4 | `anomalies_v2.py` | Computes Z-scores and anomaly classifications against the historical baseline. |
| 5 | `export_frontend.py` | Generates `data/processed/frontend_activity.csv` matching the frontend schema. |
| 6 | `split_frontend.py` | Splits the dataset by year to generate `web/public/data/{year}.csv` files. |

---

## Current Data Coverage Note

- **Time Range:** November 2000 – October 2026. Start and end years contain partial coverage.
- **Sensors Used:** MODIS (2000–2026), VIIRS NOAA-20 (2018–2026), VIIRS NOAA-21 (2023–2026).
- **NASA FIRMS Download Bounds:** West `-120.6°`, South `-57.8°`, East `180°`, North `38.9°`.
- **Spatial Resolution:** 2° × 2° grid.
- **Important Limitation:** The dataset is not global. Fire activity cannot be evaluated for regions outside the download boundaries.
- **Missing Data:** The absence of a hotspot record does not imply the absence of fire or complete satellite observation.
- **Validation:** Coordinates of all 566,355 harmonized records have been verified; zero invalid coordinates were found. This check does not guarantee regional data completeness.
