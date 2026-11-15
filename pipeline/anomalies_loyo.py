
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "monthly_anomalies_loyo.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH reference_data AS (
        SELECT
            a.grid_id,
            a.grid_lat,
            a.grid_lon,
            a.year,
            a.month,
            a.activity_index,
            a.source,

            COUNT(b.activity_index) AS history_count,
            AVG(b.activity_index) AS historical_mean,
            STDDEV_SAMP(b.activity_index) AS historical_std

        FROM read_csv_auto('{source}') a
        LEFT JOIN read_csv_auto('{source}') b
            ON a.grid_id = b.grid_id
           AND a.month = b.month
           AND a.year <> b.year

        GROUP BY
            a.grid_id,
            a.grid_lat,
            a.grid_lon,
            a.year,
            a.month,
            a.activity_index,
            a.source
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
        FROM reference_data
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

print("\nANOMALY LOYO - NUMERICALLY STABLE")
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
        COUNT(*) AS total_records,
        COUNT(*) FILTER (
            WHERE z_score IS NOT NULL
        ) AS scored_records,
        COUNT(*) FILTER (
            WHERE ABS(z_score) > 1000000
        ) AS extreme_z_scores
    FROM read_csv_auto('{output}')
""").df()

print("\nSAYISAL KONTROL")
print(check.to_string(index=False))

con.close()
