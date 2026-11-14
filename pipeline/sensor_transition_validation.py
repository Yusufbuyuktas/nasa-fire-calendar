
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "sensor_transition_validation.csv"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

con.execute(f"""
CREATE TEMP TABLE transitions AS
WITH ordered AS (
    SELECT
        grid_id,
        year,
        month,
        activity_index,
        source,
        LAG(activity_index) OVER (
            PARTITION BY grid_id
            ORDER BY year, month
        ) AS previous_activity,
        LAG(source) OVER (
            PARTITION BY grid_id
            ORDER BY year, month
        ) AS previous_source,
        LAG(year * 12 + month) OVER (
            PARTITION BY grid_id
            ORDER BY year, month
        ) AS previous_period
    FROM read_csv_auto('{source}')
),
compared AS (
    SELECT
        *,
        CASE
            WHEN source = previous_source
                THEN 'SAME_SENSOR'
            ELSE 'SENSOR_SWITCH'
        END AS transition_type,
        ABS(
            LN(
                (activity_index + 1.0) /
                (previous_activity + 1.0)
            )
        ) AS log_change
    FROM ordered
    WHERE previous_period = year * 12 + month - 1
      AND activity_index >= 0
      AND previous_activity >= 0
)
SELECT *
FROM compared
""")

print("\n=== SENSÖR GEÇİŞ ANALİZİ ===")

result = con.execute("""
SELECT
    transition_type,
    COUNT(*) AS transition_count,
    ROUND(AVG(log_change), 4) AS mean_log_change,
    ROUND(MEDIAN(log_change), 4) AS median_log_change,
    ROUND(QUANTILE_CONT(log_change, 0.9), 4)
        AS p90_log_change
FROM transitions
GROUP BY transition_type
ORDER BY transition_type
""").df()

print(result.to_string(index=False))

print("\n=== KAYNAK GEÇİŞLERİ ===")

detail = con.execute("""
SELECT
    previous_source,
    source AS current_source,
    COUNT(*) AS transition_count,
    ROUND(AVG(log_change), 4) AS mean_log_change,
    ROUND(MEDIAN(log_change), 4) AS median_log_change
FROM transitions
WHERE transition_type = 'SENSOR_SWITCH'
GROUP BY previous_source, source
ORDER BY transition_count DESC
""").df()

print(detail.to_string(index=False))

con.execute(f"""
COPY (
    SELECT
        grid_id,
        year,
        month,
        previous_source,
        source AS current_source,
        previous_activity,
        activity_index,
        transition_type,
        ROUND(log_change, 6) AS log_change
    FROM transitions
    ORDER BY year, month, grid_id
) TO '{output}'
(FORMAT CSV, HEADER TRUE)
""")

print("\nSonuç dosyası:", OUTPUT)

con.close()
