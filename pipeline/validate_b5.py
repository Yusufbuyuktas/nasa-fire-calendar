
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity_filled.csv"
OUTPUT = DATA / "monthly_anomalies_loyo_v2.csv"

con = duckdb.connect()

try:
    source = SOURCE.as_posix().replace("'", "''")
    output = OUTPUT.as_posix().replace("'", "''")

    result = con.execute(f"""
        WITH source_stats AS (
            SELECT
                COUNT(*) AS source_rows,
                COUNT(*) FILTER (
                    WHERE source != 'NO_DETECTION'
                ) AS real_rows
            FROM read_csv_auto('{source}')
        ),
        output_stats AS (
            SELECT
                COUNT(*) AS output_rows,
                COUNT(z_score) AS scored_rows,
                COUNT(*) FILTER (
                    WHERE ABS(z_score) > 10
                ) AS extreme_scores,
                COUNT(*) FILTER (
                    WHERE source = 'NO_DETECTION'
                      AND z_score IS NOT NULL
                ) AS invalid_zero_scores,
                COUNT(*) FILTER (
                    WHERE source = 'NO_DETECTION'
                      AND anomaly_level != 'UNVERIFIED_ZERO'
                ) AS invalid_zero_labels,
                COUNT(*) FILTER (
                    WHERE ABS(display_z_score) > 10
                ) AS invalid_display_scores,
                COUNT(*) FILTER (
                    WHERE source != 'NO_DETECTION'
                      AND z_score IS NOT NULL
                      AND display_z_score IS NULL
                ) AS missing_display_scores
            FROM read_csv_auto('{output}')
        )
        SELECT *
        FROM source_stats
        CROSS JOIN output_stats
    """).df()

    print("\nB5 - AUTOMATED VALIDATION")
    print(result.to_string(index=False))

    row = result.iloc[0]

    checks = {
        "Row count preserved":
            row["source_rows"] == row["output_rows"],

        "Scored rows within real records":
            row["scored_rows"] <= row["real_rows"],

        "No extreme Z-scores":
            row["extreme_scores"] == 0,

        "No imputed zero scores":
            row["invalid_zero_scores"] == 0,

        "Correct imputed zero labels":
            row["invalid_zero_labels"] == 0,

        "Display scores within bounds":
            row["invalid_display_scores"] == 0,

        "No missing display scores":
            row["missing_display_scores"] == 0,
    }

    print("\nCHECKS")
    for name, passed in checks.items():
        print(f"{name}: {'PASS' if passed else 'FAIL'}")

    if not all(checks.values()):
        raise SystemExit("B5 VALIDATION FAILED")

    print("\nRESULT: PASSED")

finally:
    con.close()
