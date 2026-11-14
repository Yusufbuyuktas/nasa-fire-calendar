
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

source = SOURCE.as_posix().replace("'", "''")

con.execute(f"""
CREATE TEMP TABLE comparisons AS
WITH yearly AS (
    SELECT
        grid_id,
        year,
        month,
        activity_index,
        source,
        LAG(year) OVER (
            PARTITION BY grid_id, month
            ORDER BY year
        ) AS previous_year,
        LAG(activity_index) OVER (
            PARTITION BY grid_id, month
            ORDER BY year
        ) AS previous_activity,
        LAG(source) OVER (
            PARTITION BY grid_id, month
            ORDER BY year
        ) AS previous_source
    FROM read_csv_auto('{source}')
)
SELECT
    grid_id,
    year,
    month,
    previous_source,
    source AS current_source,
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
FROM yearly
WHERE previous_year = year - 1
  AND activity_index >= 0
  AND previous_activity >= 0
""")

print("\n=== AYNI AY / FARKLI YIL ANALIZI ===")

result = con.execute("""
SELECT
    transition_type,
    COUNT(*) AS comparison_count,
    ROUND(AVG(log_change), 4) AS mean_log_change,
    ROUND(MEDIAN(log_change), 4) AS median_log_change,
    ROUND(QUANTILE_CONT(log_change, 0.9), 4)
        AS p90_log_change
FROM comparisons
GROUP BY transition_type
ORDER BY transition_type
""").df()

print(result.to_string(index=False))

print("\n=== SENSOR GECIS DETAYLARI ===")

detail = con.execute("""
SELECT
    previous_source,
    current_source,
    COUNT(*) AS comparison_count,
    ROUND(AVG(log_change), 4) AS mean_log_change,
    ROUND(MEDIAN(log_change), 4) AS median_log_change
FROM comparisons
WHERE transition_type = 'SENSOR_SWITCH'
GROUP BY previous_source, current_source
ORDER BY comparison_count DESC
""").df()

print(detail.to_string(index=False))

print("\n=== YILLARA GORE SENSOR GECISI ===")

by_year = con.execute("""
SELECT
    year,
    transition_type,
    COUNT(*) AS comparison_count,
    ROUND(AVG(log_change), 4) AS mean_log_change
FROM comparisons
WHERE year BETWEEN 2018 AND 2025
GROUP BY year, transition_type
ORDER BY year, transition_type
""").df()

print(by_year.to_string(index=False))

con.close()
