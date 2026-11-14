
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    BASE_DIR / "data" / "processed" / "monthly_activity.csv"
)

OUTPUT_FILE = (
    BASE_DIR / "data" / "processed" / "sensor_comparison.csv"
)

con = duckdb.connect()

con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

input_path = INPUT_FILE.as_posix().replace("'", "''")
output_path = OUTPUT_FILE.as_posix().replace("'", "''")

# Sensörleri aynı grid ve ay üzerinde karşılaştır
query = f"""
COPY (
    WITH monthly AS (
        SELECT
            grid_id,
            year,
            month,

            SUM(
                CASE WHEN sensor = 'MODIS'
                THEN hotspot_count ELSE 0 END
            ) AS modis_count,

            SUM(
                CASE WHEN sensor = 'VIIRS_NOAA20'
                THEN hotspot_count ELSE 0 END
            ) AS noaa20_count,

            SUM(
                CASE WHEN sensor = 'VIIRS_NOAA21'
                THEN hotspot_count ELSE 0 END
            ) AS noaa21_count

        FROM read_csv_auto('{input_path}')

        WHERE year BETWEEN 2018 AND 2025

        GROUP BY grid_id, year, month
    )

    SELECT
        grid_id,
        year,
        month,
        modis_count,
        noaa20_count,
        noaa21_count,

        CASE
            WHEN modis_count > 0
             AND noaa20_count > 0
            THEN ROUND(
                noaa20_count * 1.0 / modis_count, 4
            )
            ELSE NULL
        END AS noaa20_modis_ratio,

        CASE
            WHEN modis_count > 0
             AND noaa21_count > 0
            THEN ROUND(
                noaa21_count * 1.0 / modis_count, 4
            )
            ELSE NULL
        END AS noaa21_modis_ratio

    FROM monthly
    ORDER BY year, month, grid_id
)
TO '{output_path}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("Sensör karşılaştırması oluşturuldu.")
print("Çıktı:", OUTPUT_FILE)

print("\n=== ORTAK AKTİF GRID-AY KARŞILAŞTIRMASI ===")

result = con.execute(f"""
    SELECT
        COUNT(*) FILTER (
            WHERE modis_count > 0
              AND noaa20_count > 0
        ) AS modis_noaa20_pairs,

        COUNT(*) FILTER (
            WHERE modis_count > 0
              AND noaa21_count > 0
        ) AS modis_noaa21_pairs,

        ROUND(
            SUM(noaa20_count) FILTER (
                WHERE modis_count > 0
                  AND noaa20_count > 0
            ) * 1.0 /
            NULLIF(
                SUM(modis_count) FILTER (
                    WHERE modis_count > 0
                      AND noaa20_count > 0
                ), 0
            ), 3
        ) AS noaa20_weighted_ratio,

        ROUND(
            SUM(noaa21_count) FILTER (
                WHERE modis_count > 0
                  AND noaa21_count > 0
            ) * 1.0 /
            NULLIF(
                SUM(modis_count) FILTER (
                    WHERE modis_count > 0
                      AND noaa21_count > 0
                ), 0
            ), 3
        ) AS noaa21_weighted_ratio

    FROM read_csv_auto('{output_path}')
""").df()

print(result.to_string(index=False))

con.close()
