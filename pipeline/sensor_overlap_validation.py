
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"
FACTORS = DATA / "calibration_factors.csv"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

source = SOURCE.as_posix().replace("'", "''")
factors = FACTORS.as_posix().replace("'", "''")

con.execute(f"""
CREATE TEMP TABLE overlap AS
WITH monthly AS (
    SELECT
        grid_id,
        year,
        month,
        SUM(CASE WHEN sensor = 'MODIS'
            THEN hotspot_count END) AS modis,
        SUM(CASE WHEN sensor = 'VIIRS_NOAA20'
            THEN hotspot_count END) AS noaa20,
        SUM(CASE WHEN sensor = 'VIIRS_NOAA21'
            THEN hotspot_count END) AS noaa21
    FROM read_csv_auto('{source}')
    WHERE year BETWEEN 2018 AND 2025
    GROUP BY grid_id, year, month
),
pairs AS (
    SELECT
        grid_id, year, month,
        'VIIRS_NOAA20' AS sensor,
        modis, noaa20 AS viirs
    FROM monthly
    WHERE modis > 0 AND noaa20 > 0

    UNION ALL

    SELECT
        grid_id, year, month,
        'VIIRS_NOAA21' AS sensor,
        modis, noaa21 AS viirs
    FROM monthly
    WHERE modis > 0 AND noaa21 > 0
)
SELECT
    p.*,
    p.viirs / NULLIF(f.factor, 0) AS adjusted_viirs
FROM pairs p
JOIN read_csv_auto('{factors}') f
  ON p.month = f.month
 AND p.sensor = f.sensor
WHERE f.factor > 0
""")

print("\n=== SENSOR OVERLAP VALIDATION ===")

result = con.execute("""
SELECT
    sensor,
    COUNT(*) AS paired_observations,
    ROUND(
        AVG(ABS(adjusted_viirs - modis)), 4
    ) AS mae,
    ROUND(
        100.0 * SUM(ABS(adjusted_viirs - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS wape_percent,
    ROUND(
        100.0 * SUM(adjusted_viirs - modis)
        / NULLIF(SUM(modis), 0), 2
    ) AS bias_percent
FROM overlap
GROUP BY sensor
ORDER BY sensor
""").df()

print(result.to_string(index=False))

print("\n=== YILLARA GORE WAPE ===")

yearly = con.execute("""
SELECT
    year,
    sensor,
    COUNT(*) AS paired_observations,
    ROUND(
        100.0 * SUM(ABS(adjusted_viirs - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS wape_percent,
    ROUND(
        100.0 * SUM(adjusted_viirs - modis)
        / NULLIF(SUM(modis), 0), 2
    ) AS bias_percent
FROM overlap
GROUP BY year, sensor
ORDER BY year, sensor
""").df()

print(yearly.to_string(index=False))

con.close()
