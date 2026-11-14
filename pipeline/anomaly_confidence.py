
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "anomaly_confidence.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH historical AS (
        SELECT
            grid_id,
            year,
            month,
            activity_index,

            COUNT(*) OVER (
                PARTITION BY grid_id, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
            ) AS history_count

        FROM read_csv_auto('{source}')
        WHERE year >= 2001
    ),
    evaluated AS (
        SELECT
            grid_id,
            year,
            month,
            activity_index,
            COALESCE(history_count, 0)
                AS history_count,

            CASE
                WHEN COALESCE(history_count, 0) < 3
                    THEN 'INSUFFICIENT'
                WHEN history_count < 10
                    THEN 'LOW'
                WHEN history_count < 20
                    THEN 'MEDIUM'
                ELSE 'HIGH'
            END AS confidence_level

        FROM historical
    )
    SELECT *
    FROM evaluated
    ORDER BY grid_id, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nANOMALY CONFIDENCE - LEAKAGE FREE")

summary = con.execute(f"""
    SELECT
        confidence_level,
        COUNT(*) AS grid_months,
        COUNT(DISTINCT grid_id) AS unique_grids
    FROM read_csv_auto('{output}')
    GROUP BY confidence_level
    ORDER BY confidence_level
""").df()

print(summary.to_string(index=False))

check = con.execute(f"""
    SELECT
        year,
        COUNT(*) AS records,
        ROUND(AVG(history_count), 2)
            AS avg_history_count
    FROM read_csv_auto('{output}')
    WHERE year IN (2001, 2010, 2020, 2025, 2026)
    GROUP BY year
    ORDER BY year
""").df()

print("\nYILLARA GORE GECMIS KAYIT KONTROLU")
print(check.to_string(index=False))

con.close()
