
import os
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent

DATA = Path(
    os.environ.get(
        "PIPELINE_OUTPUT_DIR",
        str(BASE / "data" / "processed")
    )
)

SOURCE = DATA / "monthly_activity.csv"
OUTPUT = DATA / "harmonized_activity.csv"
FACTORS = DATA / "calibration_factors.csv"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")
factors = FACTORS.as_posix().replace("'", "''")

# 1. Her grid-ay için sensörleri ayrı sütunlara yerleştir
con.execute(f"""
CREATE TEMP TABLE monthly AS
SELECT
    grid_id,
    grid_lat,
    grid_lon,
    year,
    month,
    SUM(CASE WHEN sensor = 'MODIS'
        THEN hotspot_count ELSE NULL END) AS modis,
    SUM(CASE WHEN sensor = 'VIIRS_NOAA20'
        THEN hotspot_count ELSE NULL END) AS noaa20,
    SUM(CASE WHEN sensor = 'VIIRS_NOAA21'
        THEN hotspot_count ELSE NULL END) AS noaa21
FROM read_csv_auto('{source}')
GROUP BY grid_id, grid_lat, grid_lon, year, month
""")

# 2. Aynı grid-ayda iki sensörün de pozitif
# kayıt ürettiği durumlarla katsayı hesapla
con.execute("""
CREATE TEMP TABLE factors AS
WITH pairs AS (
    SELECT month, 'VIIRS_NOAA20' AS sensor,
           modis, noaa20 AS viirs
    FROM monthly
    WHERE year BETWEEN 2018 AND 2025
      AND modis > 0 AND noaa20 > 0

    UNION ALL

    SELECT month, 'VIIRS_NOAA21' AS sensor,
           modis, noaa21 AS viirs
    FROM monthly
    WHERE year BETWEEN 2023 AND 2025
      AND modis > 0 AND noaa21 > 0
)
SELECT
    month,
    sensor,
    COUNT(*) AS matched_pairs,
    SUM(viirs) * 1.0 / SUM(modis) AS factor
FROM pairs
GROUP BY month, sensor
""")

con.execute(f"""
COPY (
    SELECT * FROM factors ORDER BY sensor, month
) TO '{factors}'
(FORMAT CSV, HEADER TRUE)
""")

# 3. Kalibre edilmiş VIIRS değerleri
# MODIS mevcutsa MODIS'i tercih et
con.execute(f"""
COPY (
    WITH adjusted AS (
        SELECT
            m.*,
            m.noaa20 / NULLIF(f20.factor, 0)
                AS adjusted_noaa20,
            m.noaa21 / NULLIF(f21.factor, 0)
                AS adjusted_noaa21
        FROM monthly m
        LEFT JOIN factors f20
          ON m.month = f20.month
         AND f20.sensor = 'VIIRS_NOAA20'
        LEFT JOIN factors f21
          ON m.month = f21.month
         AND f21.sensor = 'VIIRS_NOAA21'
    )
    SELECT
        grid_id,
        grid_lat,
        grid_lon,
        year,
        month,
        ROUND(
            COALESCE(
                modis,
                adjusted_noaa20,
                adjusted_noaa21
            ), 2
        ) AS activity_index,
        CASE
            WHEN modis IS NOT NULL THEN 'MODIS'
            WHEN adjusted_noaa20 IS NOT NULL
                THEN 'VIIRS_NOAA20_ADJUSTED'
            WHEN adjusted_noaa21 IS NOT NULL
                THEN 'VIIRS_NOAA21_ADJUSTED'
            ELSE 'NO_DATA'
        END AS source
    FROM adjusted
    ORDER BY year, month, grid_id
) TO '{output}'
(FORMAT CSV, HEADER TRUE)
""")

print("Harmonization tamamlandı!")
print("Katsayılar:", FACTORS)
print("Aktivite verisi:", OUTPUT)

print("\n=== AYLIK KALİBRASYON KATSAYILARI ===")
print(con.execute("""
    SELECT *
    FROM factors
    ORDER BY sensor, month
""").df().to_string(index=False))

print("\n=== KAYNAK DAĞILIMI ===")
print(con.execute(f"""
    SELECT source, COUNT(*) AS rows
    FROM read_csv_auto('{output}')
    GROUP BY source
    ORDER BY source
""").df().to_string(index=False))

con.close()
