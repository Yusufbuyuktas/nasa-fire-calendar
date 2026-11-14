
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"
OUTPUT = DATA / "harmonization_validation.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
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
        GROUP BY grid_id, year, month
    ),
    factors AS (
        SELECT
            month,
            SUM(noaa20) * 1.0 / SUM(modis) AS factor
        FROM paired
        WHERE year BETWEEN 2018 AND 2024
          AND modis > 0
          AND noaa20 > 0
        GROUP BY month
    ),
    test AS (
        SELECT
            p.grid_id,
            p.year,
            p.month,
            p.modis,
            p.noaa20,
            f.factor,
            p.noaa20 / f.factor AS adjusted_noaa20
        FROM paired p
        JOIN factors f ON p.month = f.month
        WHERE p.year = 2025
          AND p.modis > 0
          AND p.noaa20 > 0
    )
    SELECT
        grid_id,
        year,
        month,
        modis,
        noaa20,
        ROUND(factor, 4) AS factor,
        ROUND(adjusted_noaa20, 4) AS adjusted_noaa20,
        ABS(noaa20 - modis) AS error_before,
        ROUND(ABS(adjusted_noaa20 - modis), 4)
            AS error_after
    FROM test
    ORDER BY month, grid_id
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

result = con.execute(f"""
    SELECT
        COUNT(*) AS test_pairs,
        ROUND(AVG(error_before), 2) AS mae_before,
        ROUND(AVG(error_after), 2) AS mae_after,
        ROUND(
            100.0 * (
                1 - AVG(error_after) / NULLIF(AVG(error_before), 0)
            ), 2
        ) AS error_reduction_percent
    FROM read_csv_auto('{output}')
""").df()

print("\nHARMONIZATION VALIDATION - 2025")
print(result.to_string(index=False))
print("\nDosya:", OUTPUT)

con.close()
