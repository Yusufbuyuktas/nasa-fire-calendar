
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "grid_observation_status.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH activity AS (
        SELECT
            grid_id,
            year,
            month,
            activity_index
        FROM read_csv_auto('{source}')
    ),
    grids AS (
        SELECT DISTINCT grid_id
        FROM activity
    ),
    months AS (
        SELECT DISTINCT year, month
        FROM activity
    )
    SELECT
        g.grid_id,
        m.year,
        m.month,
        CASE
            WHEN a.grid_id IS NOT NULL
                THEN 'HAS_HOTSPOT_RECORD'
            ELSE 'NO_HOTSPOT_RECORD'
        END AS record_status,
        CASE
            WHEN a.grid_id IS NOT NULL
                THEN a.activity_index
            ELSE NULL
        END AS activity_index,
        'UNKNOWN' AS observation_coverage
    FROM grids g
    CROSS JOIN months m
    LEFT JOIN activity a
        ON g.grid_id = a.grid_id
        AND m.year = a.year
        AND m.month = a.month
    ORDER BY g.grid_id, m.year, m.month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

summary = con.execute(f"""
    SELECT
        record_status,
        COUNT(*) AS grid_months
    FROM read_csv_auto('{output}')
    GROUP BY record_status
    ORDER BY record_status
""").df()

print("\nGRID OBSERVATION STATUS")
print(summary.to_string(index=False))

print(f"\nReport saved: {OUTPUT}")

con.close()
