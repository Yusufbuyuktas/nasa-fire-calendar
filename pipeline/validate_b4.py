
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
FILLED = DATA / "harmonized_activity_filled.csv"

con = duckdb.connect()

try:
    source = SOURCE.as_posix().replace("'", "''")
    filled = FILLED.as_posix().replace("'", "''")

    original_count = con.execute(f"""
        SELECT COUNT(*)
        FROM read_csv_auto('{source}')
    """).fetchone()[0]

    filled_count = con.execute(f"""
        SELECT COUNT(*)
        FROM read_csv_auto('{filled}')
    """).fetchone()[0]

    expected_count = con.execute(f"""
        WITH bounds AS (
            SELECT
                grid_id,
                MIN(make_date(year, month, 1)) AS first_month,
                MAX(make_date(year, month, 1)) AS last_month
            FROM read_csv_auto('{source}')
            GROUP BY grid_id
        )
        SELECT SUM(
            DATE_DIFF('month', first_month, last_month) + 1
        )
        FROM bounds
    """).fetchone()[0]

    missing_original = con.execute(f"""
        SELECT COUNT(*)
        FROM read_csv_auto('{source}') s
        LEFT JOIN read_csv_auto('{filled}') f
          ON s.grid_id = f.grid_id
         AND s.year = f.year
         AND s.month = f.month
        WHERE f.grid_id IS NULL
    """).fetchone()[0]

    changed_original = con.execute(f"""
        SELECT COUNT(*)
        FROM read_csv_auto('{source}') s
        JOIN read_csv_auto('{filled}') f
          ON s.grid_id = f.grid_id
         AND s.year = f.year
         AND s.month = f.month
        WHERE s.activity_index IS DISTINCT FROM f.activity_index
           OR s.source IS DISTINCT FROM f.source
    """).fetchone()[0]

    invalid_filled = con.execute(f"""
        SELECT COUNT(*)
        FROM read_csv_auto('{filled}')
        WHERE source = 'NO_DETECTION'
          AND activity_index != 0
    """).fetchone()[0]

    duplicate_count = con.execute(f"""
        SELECT COUNT(*)
        FROM (
            SELECT grid_id, year, month
            FROM read_csv_auto('{filled}')
            GROUP BY grid_id, year, month
            HAVING COUNT(*) > 1
        )
    """).fetchone()[0]

    print("\nB4 FINAL VALIDATION")
    print("Original rows:", original_count)
    print("Filled rows:", filled_count)
    print("Expected rows:", expected_count)
    print("Missing original rows:", missing_original)
    print("Changed original rows:", changed_original)
    print("Invalid NO_DETECTION rows:", invalid_filled)
    print("Duplicate grid-month keys:", duplicate_count)

    passed = (
        filled_count == expected_count
        and filled_count >= original_count
        and missing_original == 0
        and changed_original == 0
        and invalid_filled == 0
        and duplicate_count == 0
    )

    print("\nRESULT:", "PASSED" if passed else "FAILED")

    if not passed:
        raise SystemExit(1)

finally:
    con.close()
