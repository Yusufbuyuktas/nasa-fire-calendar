
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "data" / "processed" / "monthly_anomalies_v2.csv"

if not SOURCE.exists():
    raise FileNotFoundError(f"Dosya bulunamadı: {SOURCE}")

con = duckdb.connect()
source = SOURCE.as_posix().replace("'", "''")

result = con.execute(f"""
    WITH data AS (
        SELECT *
        FROM read_csv_auto('{source}')
    ),
    duplicates AS (
        SELECT COUNT(*) AS duplicate_groups
        FROM (
            SELECT grid_id, year, month
            FROM data
            GROUP BY grid_id, year, month
            HAVING COUNT(*) > 1
        )
    )
    SELECT
        COUNT(*) AS total_records,
        COUNT(*) FILTER (
            WHERE year NOT BETWEEN 2000 AND 2026
               OR month NOT BETWEEN 1 AND 12
        ) AS invalid_dates,
        COUNT(*) FILTER (
            WHERE history_count < 0
        ) AS invalid_history,
        COUNT(*) FILTER (
            WHERE NOT isfinite(z_score)
        ) AS nonfinite_z_scores,
        COUNT(*) FILTER (
            WHERE z_score IS NULL
              AND anomaly_level <> 'INSUFFICIENT_DATA'
        ) AS invalid_null_labels,
        COUNT(*) FILTER (
            WHERE z_score IS NOT NULL
              AND anomaly_level = 'INSUFFICIENT_DATA'
        ) AS invalid_scored_labels,
        (SELECT duplicate_groups FROM duplicates)
            AS duplicate_groups
    FROM data
""").df()

print("\nANOMALY V2 - DATA VALIDATION")
print(result.to_string(index=False))

con.close()
