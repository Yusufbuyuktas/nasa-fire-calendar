
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"

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
    WHERE year BETWEEN 2018 AND 2025
      AND sensor IN ('MODIS', 'VIIRS_NOAA20')
    GROUP BY grid_id, year, month
),
factors AS (
    SELECT
        month,
        SUM(noaa20) * 1.0 / NULLIF(SUM(modis), 0) AS factor
    FROM paired
    WHERE year BETWEEN 2018 AND 2024
      AND modis > 0
      AND noaa20 > 0
    GROUP BY month
),
test AS (
    SELECT
        p.*,
        p.noaa20 / NULLIF(f.factor, 0) AS adjusted_noaa20
    FROM paired p
    JOIN factors f ON p.month = f.month
    WHERE p.year = 2025
)
SELECT
    COUNT(*) AS test_grid_months,
    ROUND(
        100.0 * SUM(ABS(noaa20 - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS wape_before,
    ROUND(
        100.0 * SUM(ABS(adjusted_noaa20 - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS wape_after,
    ROUND(
        100.0 * (
            SUM(adjusted_noaa20) - SUM(modis)
        ) / NULLIF(SUM(modis), 0), 2
    ) AS relative_bias_percent
FROM test
"""

result = con.execute(query).df()

print("\nFULL COVERAGE VALIDATION - 2025")
print(result.to_string(index=False))

con.close()
