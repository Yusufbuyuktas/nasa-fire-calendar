
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "data" / "processed" / "monthly_activity.csv"

con = duckdb.connect()
source = SOURCE.as_posix().replace("'", "''")

query = f"""
WITH paired AS (
    SELECT
        grid_id,
        year,
        month,
        SUM(CASE WHEN sensor = 'MODIS'
            THEN hotspot_count ELSE 0 END) AS modis,
        SUM(CASE WHEN sensor = 'VIIRS_NOAA20'
            THEN hotspot_count ELSE 0 END) AS noaa20
    FROM read_csv_auto('{source}')
    WHERE year BETWEEN 2018 AND 2024
      AND sensor IN ('MODIS', 'VIIRS_NOAA20')
    GROUP BY grid_id, year, month
),
classified AS (
    SELECT
        *,
        CASE
            WHEN noaa20 < 20 THEN '1: <20'
            WHEN noaa20 < 100 THEN '2: 20-99'
            WHEN noaa20 < 500 THEN '3: 100-499'
            ELSE '4: 500+'
        END AS activity_band
    FROM paired
    WHERE modis > 0 AND noaa20 > 0
)
SELECT
    activity_band,
    COUNT(*) AS training_pairs,
    ROUND(AVG(modis), 2) AS avg_modis,
    ROUND(AVG(noaa20), 2) AS avg_noaa20,
    ROUND(
        SUM(noaa20) * 1.0 / NULLIF(SUM(modis), 0),
        3
    ) AS calibration_factor
FROM classified
GROUP BY activity_band
ORDER BY activity_band
"""

result = con.execute(query).df()

print("\nVIIRS AKTIVITE SEVIYESINE GORE KALIBRASYON")
print(result.to_string(index=False))

con.close()
