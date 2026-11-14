
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "monthly_anomalies.csv"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH activity AS (
        SELECT *
        FROM read_csv_auto('{source}')
        WHERE activity_index IS NOT NULL
    ),

    baseline AS (
        SELECT
            grid_id,
            month,
            COUNT(*) AS baseline_years,
            AVG(activity_index) AS mean_activity,
            STDDEV_SAMP(activity_index) AS std_activity
        FROM activity
        WHERE year BETWEEN 2001 AND 2025
        GROUP BY grid_id, month
    ),

    scored AS (
        SELECT
            a.grid_id,
            a.grid_lat,
            a.grid_lon,
            a.year,
            a.month,
            a.activity_index,
            a.source,
            b.baseline_years,
            ROUND(b.mean_activity, 2) AS mean_activity,

            CASE
                WHEN b.baseline_years >= 5
                 AND b.std_activity > 0
                THEN ROUND(
                    (a.activity_index - b.mean_activity)
                    / b.std_activity, 3
                )
                ELSE NULL
            END AS z_score

        FROM activity a
        LEFT JOIN baseline b
          ON a.grid_id = b.grid_id
         AND a.month = b.month
    )

    SELECT *,
        CASE
            WHEN z_score IS NULL THEN 'INSUFFICIENT_DATA'
            WHEN z_score >= 2 THEN 'VERY_HIGH'
            WHEN z_score >= 1 THEN 'HIGH'
            WHEN z_score <= -2 THEN 'VERY_LOW'
            WHEN z_score <= -1 THEN 'LOW'
            ELSE 'NORMAL'
        END AS anomaly_level

    FROM scored
    ORDER BY year, month, grid_id
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

print("Anomaly Detection başlıyor...")

con.execute(query)

print("\nAnomaly Detection tamamlandı!")
print("Çıktı:", OUTPUT)

print("\n=== ANOMALY DAĞILIMI ===")

result = con.execute(f"""
SELECT
    anomaly_level,
    COUNT(*) AS total
FROM read_csv_auto('{output}')
GROUP BY anomaly_level
ORDER BY total DESC
""").df()

print(result.to_string(index=False))

con.close()
