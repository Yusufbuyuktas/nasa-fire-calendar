
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "data" / "processed" / "harmonized_activity.csv"

con = duckdb.connect()

try:
    source = SOURCE.as_posix().replace("'", "''")

    result = con.execute(f"""
        SELECT
            year,
            COUNT(*) AS combined_records,

            COUNT(*) FILTER (
                WHERE source = 'MODIS'
            ) AS modis_records,

            COUNT(*) FILTER (
                WHERE source LIKE 'VIIRS%'
            ) AS viirs_records,

            ROUND(
                MEDIAN(activity_index), 2
            ) AS combined_activity_median,

            ROUND(
                MEDIAN(activity_index) FILTER (
                    WHERE source = 'MODIS'
                ), 2
            ) AS modis_reference_median,

            ROUND(
                100.0 * (
                    MEDIAN(activity_index)
                    / NULLIF(
                        MEDIAN(activity_index) FILTER (
                            WHERE source = 'MODIS'
                        ), 0
                    ) - 1
                ), 2
            ) AS median_change_pct

        FROM read_csv_auto('{source}')
        WHERE year BETWEEN 2015 AND 2025
        GROUP BY year
        ORDER BY year
    """).df()

    print("\nB6 - SENSOR TRANSITION VALIDATION")
    print(result.to_string(index=False))

    before = result[result["year"] < 2018]
    after = result[result["year"] >= 2018]

    checks = {
        "No VIIRS records before 2018":
            (before["viirs_records"] == 0).all(),

        "VIIRS records present after 2018":
            (after["viirs_records"] > 0).all(),

        "MODIS reference available":
            result["modis_reference_median"].notna().all(),

        "Combined median positive":
            (result["combined_activity_median"] > 0).all(),

        "No missing years":
            len(result) == 11,
    }

    print("\nCHECKS")
    for name, passed in checks.items():
        print(f"{name}: {'PASS' if passed else 'FAIL'}")

    if not all(checks.values()):
        raise SystemExit("B6 VALIDATION FAILED")

    print("\nRESULT: PASSED")

finally:
    con.close()
