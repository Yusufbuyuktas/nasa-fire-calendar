
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "monthly_anomalies_v2.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH historical AS (
        SELECT
            grid_id,
            grid_lat,
            grid_lon,
            year,
            month,
            activity_index,
            source,

            COUNT(*) OVER (
                PARTITION BY grid_id, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
            ) AS history_count,

            AVG(activity_index) OVER (
                PARTITION BY grid_id, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
            ) AS historical_mean,

            STDDEV_SAMP(activity_index) OVER (
                PARTITION BY grid_id, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
            ) AS historical_std

        FROM read_csv_auto('{source}')
    ),
    scored AS (
        SELECT
            *,
            CASE
                WHEN history_count >= 3
                     AND historical_std > 0
                THEN (
                    activity_index - historical_mean
                ) / historical_std
                ELSE NULL
            END AS z_score
        FROM historical
    )
    SELECT
        grid_id,
        grid_lat,
        grid_lon,
        year,
        month,
        activity_index,
        source,
        history_count,
        ROUND(historical_mean, 4) AS historical_mean,
        ROUND(historical_std, 4) AS historical_std,
        ROUND(z_score, 4) AS z_score,

        CASE
            WHEN z_score IS NULL
                THEN 'INSUFFICIENT_DATA'
            WHEN z_score >= 2
                THEN 'VERY_HIGH'
            WHEN z_score >= 1
                THEN 'HIGH'
            WHEN z_score <= -2
                THEN 'VERY_LOW'
            WHEN z_score <= -1
                THEN 'LOW'
            ELSE 'NORMAL'
        END AS anomaly_level,

        CASE
            WHEN history_count < 3
                THEN 'INSUFFICIENT'
            WHEN history_count < 10
                THEN 'LOW'
            WHEN history_count < 20
                THEN 'MEDIUM'
            ELSE 'HIGH'
        END AS confidence_level

    FROM scored
    ORDER BY grid_id, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nANOMALY V2 - LEAKAGE FREE")
print("Dosya:", OUTPUT)

summary = con.execute(f"""
    SELECT
        anomaly_level,
        COUNT(*) AS records
    FROM read_csv_auto('{output}')
    GROUP BY anomaly_level
    ORDER BY anomaly_level
""").df()

print("\nANOMALI DAGILIMI")
print(summary.to_string(index=False))

check = con.execute(f"""
    SELECT
        year,
        COUNT(*) AS records,
        COUNT(*) FILTER (
            WHERE z_score IS NOT NULL
        ) AS scored_records,
        ROUND(AVG(history_count), 2)
            AS avg_history_count
    FROM read_csv_auto('{output}')
    WHERE year IN (2000, 2001, 2010, 2020, 2025, 2026)
    GROUP BY year
    ORDER BY year
""").df()

print("\nYILLARA GORE KONTROL")
print(check.to_string(index=False))

con.close()
