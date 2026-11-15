
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

SOURCE = DATA / "harmonized_activity.csv"
OUTPUT = DATA / "harmonized_activity_filled.csv"


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Source file not found: {SOURCE}"
        )

    con = duckdb.connect()

    try:
        con.execute("SET memory_limit='8GB'")
        con.execute("SET threads=4")

        source = SOURCE.as_posix().replace("'", "''")
        output = OUTPUT.as_posix().replace("'", "''")

        # 1. Load existing harmonized data
        con.execute(f"""
            CREATE TEMP TABLE source AS
            SELECT
                grid_id,
                grid_lat,
                grid_lon,
                year,
                month,
                activity_index,
                source
            FROM read_csv_auto('{source}')
        """)

        # 2. Validate source records
        invalid = con.execute("""
            SELECT COUNT(*)
            FROM source
            WHERE grid_id IS NULL
               OR year IS NULL
               OR month NOT BETWEEN 1 AND 12
               OR activity_index IS NULL
               OR activity_index < 0
        """).fetchone()[0]

        if invalid:
            raise ValueError(
                f"Invalid source records: {invalid}"
            )

        # 3. Check unique grid-month records
        duplicates = con.execute("""
            SELECT COUNT(*)
            FROM (
                SELECT grid_id, year, month
                FROM source
                GROUP BY grid_id, year, month
                HAVING COUNT(*) > 1
            )
        """).fetchone()[0]

        if duplicates:
            raise ValueError(
                f"Duplicate grid-month keys: {duplicates}"
            )

        # 4. Generate monthly calendar for each grid
        query = f"""
        COPY (
            WITH grid_bounds AS (
                SELECT
                    grid_id,
                    MIN(grid_lat) AS grid_lat,
                    MIN(grid_lon) AS grid_lon,
                    MIN(make_date(year, month, 1))
                        AS first_month,
                    MAX(make_date(year, month, 1))
                        AS last_month
                FROM source
                GROUP BY grid_id
            ),
            calendar AS (
                SELECT
                    g.grid_id,
                    g.grid_lat,
                    g.grid_lon,
                    CAST(m.month_date AS DATE) AS month_date
                FROM grid_bounds g,
                UNNEST(
                    generate_series(
                        g.first_month,
                        g.last_month,
                        INTERVAL 1 MONTH
                    )
                ) AS m(month_date)
            )
            SELECT
                c.grid_id,
                c.grid_lat,
                c.grid_lon,
                YEAR(c.month_date) AS year,
                MONTH(c.month_date) AS month,

                COALESCE(
                    s.activity_index,
                    0
                ) AS activity_index,

                CASE
                    WHEN s.grid_id IS NULL
                        THEN 'NO_DETECTION'
                    ELSE s.source
                END AS source

            FROM calendar c

            LEFT JOIN source s
                ON c.grid_id = s.grid_id
                AND YEAR(c.month_date) = s.year
                AND MONTH(c.month_date) = s.month

            ORDER BY
                c.grid_id,
                c.month_date
        )
        TO '{output}'
        (FORMAT CSV, HEADER TRUE);
        """

        # 5. Export filled dataset
        con.execute(query)

        # 6. Validation summary
        summary = con.execute(f"""
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT grid_id) AS total_grids,
                COUNT(*) FILTER (
                    WHERE source = 'NO_DETECTION'
                ) AS filled_rows,
                COUNT(*) FILTER (
                    WHERE activity_index = 0
                ) AS zero_activity_rows,
                COUNT(*) FILTER (
                    WHERE source != 'NO_DETECTION'
                ) AS original_rows
            FROM read_csv_auto('{output}')
        """).df()

        print("\nB4 - MONTHLY GAP FILLING")
        print(summary.to_string(index=False))

        print("\nOutput:", OUTPUT)

        print("\nSOURCE DISTRIBUTION")

        distribution = con.execute(f"""
            SELECT
                source,
                COUNT(*) AS records
            FROM read_csv_auto('{output}')
            GROUP BY source
            ORDER BY source
        """).df()

        print(distribution.to_string(index=False))

        print("\nB4 VALIDATION")

        duplicate_output = con.execute(f"""
            SELECT COUNT(*)
            FROM (
                SELECT grid_id, year, month
                FROM read_csv_auto('{output}')
                GROUP BY grid_id, year, month
                HAVING COUNT(*) > 1
            )
        """).fetchone()[0]

        print("Duplicate grid-month keys:", duplicate_output)

        if duplicate_output:
            raise ValueError(
                "Duplicate records detected after filling"
            )

        print("RESULT: PASSED")

    finally:
        con.close()


if __name__ == "__main__":
    main()
