
import os
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent

DATA = Path(
    os.environ.get(
        "PIPELINE_OUTPUT_DIR",
        str(BASE / "data" / "processed")
    )
)

SOURCE = DATA / "harmonized_activity_filled.csv"
OUTPUT = DATA / "monthly_anomalies_loyo_v2.csv"

STD_FLOOR = 0.6
MIN_HISTORY = 3

if not SOURCE.exists():
    raise FileNotFoundError(SOURCE)

con = duckdb.connect()

try:
    con.execute("SET memory_limit='8GB'")
    con.execute("SET threads=4")

    source = SOURCE.as_posix().replace("'", "''")
    output = OUTPUT.as_posix().replace("'", "''")

    query = f"""
    COPY (
        WITH original AS (
            SELECT
                grid_id,
                grid_lat,
                grid_lon,
                year,
                month,
                activity_index,
                source
            FROM read_csv_auto('{source}')
        ),

        observations AS (
            SELECT
                grid_id,
                year,
                month,
                LN(1 + activity_index) AS log_activity
            FROM original
            WHERE source != 'NO_DETECTION'
        ),

        totals AS (
            SELECT
                *,
                COUNT(*) OVER w AS total_count,
                SUM(log_activity) OVER w AS total_log,
                SUM(log_activity * log_activity)
                    OVER w AS total_log_sq
            FROM observations
            WINDOW w AS (
                PARTITION BY grid_id, month
            )
        ),

        reference AS (
            SELECT
                grid_id,
                year,
                month,
                log_activity,
                total_count - 1 AS history_count,

                (total_log - log_activity)
                    / NULLIF(total_count - 1, 0)
                    AS historical_mean,

                SQRT(
                    GREATEST(
                        (
                            total_log_sq
                            - log_activity * log_activity
                            - POWER(
                                total_log - log_activity, 2
                            ) / NULLIF(total_count - 1, 0)
                        ) / NULLIF(total_count - 2, 0),
                        0
                    )
                ) AS historical_std

            FROM totals
        ),

        scored AS (
            SELECT
                *,
                CASE
                    WHEN history_count >= {MIN_HISTORY}
                    THEN
                        (log_activity - historical_mean)
                        / GREATEST(
                            historical_std,
                            {STD_FLOOR}
                        )
                    ELSE NULL
                END AS z_score
            FROM reference
        )

        SELECT
            o.grid_id,
            o.grid_lat,
            o.grid_lon,
            o.year,
            o.month,
            o.activity_index,
            o.source,

            s.history_count,

            ROUND(s.historical_mean, 4)
                AS historical_mean,
            ROUND(s.historical_std, 4)
                AS historical_std,
            ROUND(s.z_score, 4) AS z_score,

            CASE
                WHEN o.source = 'NO_DETECTION'
                    THEN NULL
                WHEN s.z_score IS NULL
                    THEN NULL
                ELSE ROUND(
                    LEAST(
                        10.0,
                        GREATEST(-10.0, s.z_score)
                    ),
                    4
                )
            END AS display_z_score,

            CASE
                WHEN o.source = 'NO_DETECTION'
                    THEN 'UNVERIFIED_ZERO'
                WHEN s.z_score IS NULL
                    THEN 'INSUFFICIENT_DATA'
                WHEN s.z_score >= 2
                    THEN 'VERY_HIGH'
                WHEN s.z_score >= 1
                    THEN 'HIGH'
                WHEN s.z_score <= -2
                    THEN 'VERY_LOW'
                WHEN s.z_score <= -1
                    THEN 'LOW'
                ELSE 'NORMAL'
            END AS anomaly_level,

            CASE
                WHEN o.source = 'NO_DETECTION'
                    THEN 'UNVERIFIED'
                WHEN s.history_count IS NULL
                    OR s.history_count < {MIN_HISTORY}
                    THEN 'INSUFFICIENT'
                WHEN s.history_count < 10
                    THEN 'LOW'
                WHEN s.history_count < 20
                    THEN 'MEDIUM'
                ELSE 'HIGH'
            END AS confidence_level

        FROM original o
        LEFT JOIN scored s
          ON o.grid_id = s.grid_id
         AND o.year = s.year
         AND o.month = s.month

        ORDER BY o.grid_id, o.year, o.month
    )
    TO '{output}'
    (FORMAT CSV, HEADER TRUE);
    """

    con.execute(query)

    summary = con.execute(f"""
        SELECT
            COUNT(*) AS total_rows,

            COUNT(z_score) AS scored_rows,

            COUNT(*) FILTER (
                WHERE source = 'NO_DETECTION'
            ) AS unverified_zero_rows,

            ROUND(MAX(ABS(z_score)), 2)
                AS max_abs_z,

            COUNT(*) FILTER (
                WHERE ABS(z_score) > 10
            ) AS above_10,

            COUNT(*) FILTER (
                WHERE source = 'NO_DETECTION'
                  AND z_score IS NOT NULL
            ) AS invalid_zero_scores

        FROM read_csv_auto('{output}')
    """).df()

    print("\nB5 - LOG LOYO V2")
    print(summary.to_string(index=False))

    distribution = con.execute(f"""
        SELECT
            anomaly_level,
            COUNT(*) AS records
        FROM read_csv_auto('{output}')
        GROUP BY anomaly_level
        ORDER BY anomaly_level
    """).df()

    print("\nANOMALY DISTRIBUTION")
    print(distribution.to_string(index=False))

    print("\nOutput:", OUTPUT)

finally:
    con.close()
