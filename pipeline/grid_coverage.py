
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"

if not SOURCE.exists():
    raise FileNotFoundError(
        f"Dosya bulunamadı: {SOURCE}"
    )

con = duckdb.connect()
source = SOURCE.as_posix().replace("'", "''")

print("\nDOSYA SUTUNLARI")
columns = con.execute(f"""
    DESCRIBE SELECT *
    FROM read_csv_auto('{source}')
""").df()

print(columns[["column_name", "column_type"]].to_string(index=False))

result = con.execute(f"""
    WITH grid_summary AS (
        SELECT
            grid_id,
            COUNT(DISTINCT year * 12 + month) AS recorded_months,
            MIN(year) AS first_year,
            MAX(year) AS last_year
        FROM read_csv_auto('{source}')
        GROUP BY grid_id
    )
    SELECT
        COUNT(*) AS total_grids,
        MIN(recorded_months) AS min_months,
        ROUND(AVG(recorded_months), 2) AS avg_months,
        MAX(recorded_months) AS max_months,
        COUNT(*) FILTER (
            WHERE recorded_months < 12
        ) AS grids_below_12_months,
        COUNT(*) FILTER (
            WHERE recorded_months >= 120
        ) AS grids_above_120_months
    FROM grid_summary
""").df()

print("\nGRID KAPSAM OZETI")
print(result.to_string(index=False))

distribution = con.execute(f"""
    WITH grid_summary AS (
        SELECT
            grid_id,
            COUNT(DISTINCT year * 12 + month) AS recorded_months
        FROM read_csv_auto('{source}')
        GROUP BY grid_id
    )
    SELECT
        CASE
            WHEN recorded_months < 12 THEN '1: <12'
            WHEN recorded_months < 60 THEN '2: 12-59'
            WHEN recorded_months < 120 THEN '3: 60-119'
            ELSE '4: 120+'
        END AS coverage_group,
        COUNT(*) AS grid_count
    FROM grid_summary
    GROUP BY coverage_group
    ORDER BY coverage_group
""").df()

print("\nGRID KAPSAM DAGILIMI")
print(distribution.to_string(index=False))

con.close()
