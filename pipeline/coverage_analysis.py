
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")

result = con.execute(f"""
    WITH paired AS (
        SELECT
            grid_id,
            year,
            month,
            SUM(
                CASE WHEN sensor = 'MODIS'
                THEN hotspot_count ELSE 0 END
            ) AS modis,
            SUM(
                CASE WHEN sensor = 'VIIRS_NOAA20'
                THEN hotspot_count ELSE 0 END
            ) AS noaa20
        FROM read_csv_auto('{source}')
        WHERE year = 2025
          AND sensor IN ('MODIS', 'VIIRS_NOAA20')
        GROUP BY grid_id, year, month
    ),
    classified AS (
        SELECT
            *,
            CASE
                WHEN modis > 0 AND noaa20 > 0
                    THEN 'BOTH'
                WHEN modis > 0 AND noaa20 = 0
                    THEN 'MODIS_ONLY'
                WHEN modis = 0 AND noaa20 > 0
                    THEN 'VIIRS_ONLY'
            END AS coverage_type
        FROM paired
    )
    SELECT
        coverage_type,
        COUNT(*) AS grid_months,
        SUM(modis) AS modis_hotspots,
        SUM(noaa20) AS noaa20_hotspots
    FROM classified
    GROUP BY coverage_type
    ORDER BY grid_months DESC
""").df()

print("\n2025 SENSOR COVERAGE ANALYSIS")
print(result.to_string(index=False))

con.close()
