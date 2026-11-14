
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
    WHERE year BETWEEN 2018 AND 2025
      AND sensor IN ('MODIS', 'VIIRS_NOAA20')
    GROUP BY grid_id, year, month
),
classified AS (
    SELECT
        *,
        CASE
            WHEN noaa20 < 20 THEN 1
            WHEN noaa20 < 100 THEN 2
            WHEN noaa20 < 500 THEN 3
            ELSE 4
        END AS activity_band
    FROM paired
),
baseline_factors AS (
    SELECT
        month,
        SUM(noaa20) * 1.0
            / NULLIF(SUM(modis), 0) AS factor
    FROM classified
    WHERE year BETWEEN 2018 AND 2024
      AND modis > 0
      AND noaa20 > 0
    GROUP BY month
),
activity_factors AS (
    SELECT
        month,
        activity_band,
        COUNT(*) AS training_pairs,
        SUM(noaa20) * 1.0
            / NULLIF(SUM(modis), 0) AS factor
    FROM classified
    WHERE year BETWEEN 2018 AND 2024
      AND modis > 0
      AND noaa20 > 0
    GROUP BY month, activity_band
),
test AS (
    SELECT
        p.*,
        p.noaa20 / NULLIF(b.factor, 0)
            AS baseline_prediction,
        p.noaa20 / NULLIF(
            CASE
                WHEN a.training_pairs >= 30
                THEN a.factor
                ELSE b.factor
            END, 0
        ) AS activity_prediction
    FROM classified p
    JOIN baseline_factors b
        ON p.month = b.month
    LEFT JOIN activity_factors a
        ON p.month = a.month
       AND p.activity_band = a.activity_band
    WHERE p.year = 2025
)
SELECT
    COUNT(*) AS test_grid_months,

    ROUND(
        100.0 * SUM(ABS(baseline_prediction - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS baseline_wape,

    ROUND(
        100.0 * SUM(ABS(activity_prediction - modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS activity_wape,

    ROUND(
        100.0 * (SUM(baseline_prediction) - SUM(modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS baseline_bias,

    ROUND(
        100.0 * (SUM(activity_prediction) - SUM(modis))
        / NULLIF(SUM(modis), 0), 2
    ) AS activity_bias

FROM test
"""

result = con.execute(query).df()

print("\nCALIBRATION MODEL COMPARISON - 2025")
print(result.to_string(index=False))

con.close()
