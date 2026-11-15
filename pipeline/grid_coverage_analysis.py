
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"
OUTPUT = DATA / "grid_coverage_report.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH monthly AS (
        SELECT
            sensor,
            year,
            month,
            COUNT(DISTINCT grid_id) AS active_grids,
            SUM(hotspot_count) AS total_hotspots
        FROM read_csv_auto('{source}')
        GROUP BY sensor, year, month
    ),
    changes AS (
        SELECT
            *,
            LAG(active_grids) OVER (
                PARTITION BY sensor
                ORDER BY year, month
            ) AS previous_active_grids,
            LAG(year * 12 + month) OVER (
                PARTITION BY sensor
                ORDER BY year, month
            ) AS previous_month_number
        FROM monthly
    )
    SELECT
        sensor,
        year,
        month,
        active_grids,
        total_hotspots,
        CASE
            WHEN previous_month_number = year * 12 + month - 1
            THEN previous_active_grids
            ELSE NULL
        END AS previous_active_grids,
        CASE
            WHEN previous_month_number = year * 12 + month - 1
             AND previous_active_grids > 0
            THEN ROUND(
                100.0 * (
                    active_grids - previous_active_grids
                ) / previous_active_grids,
                2
            )
            ELSE NULL
        END AS grid_change_percent
    FROM changes
    ORDER BY sensor, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

summary = con.execute(f"""
    SELECT
        sensor,
        COUNT(*) AS months_with_hotspot_records,
        MIN(active_grids) AS min_active_grids,
        MAX(active_grids) AS max_active_grids,
        ROUND(AVG(active_grids), 2) AS avg_active_grids
    FROM read_csv_auto('{output}')
    GROUP BY sensor
    ORDER BY sensor
""").df()

print("\nGRID COVERAGE ANALYSIS")
print(summary.to_string(index=False))

print(f"\nReport saved: {OUTPUT}")

con.close()
