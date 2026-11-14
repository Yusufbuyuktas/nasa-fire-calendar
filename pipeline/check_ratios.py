
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent

FILE = (
    BASE_DIR / "data" / "processed" / "sensor_comparison.csv"
)

con = duckdb.connect()

file_path = FILE.as_posix().replace("'", "''")

query = f"""
SELECT
    year,
    month,

    COUNT(*) FILTER (
        WHERE modis_count > 0
          AND noaa20_count > 0
    ) AS noaa20_pairs,

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
    ) AS noaa20_ratio,

    COUNT(*) FILTER (
        WHERE modis_count > 0
          AND noaa21_count > 0
    ) AS noaa21_pairs,

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
    ) AS noaa21_ratio

FROM read_csv_auto('{file_path}')
GROUP BY year, month
ORDER BY year, month
"""

result = con.execute(query).df()

print("\n=== YILLIK ORTALAMA ORANLAR ===")

annual = (
    result.groupby("year")[
        ["noaa20_ratio", "noaa21_ratio"]
    ]
    .mean()
    .round(3)
)

print(annual.to_string())

print("\n=== AYLIK ORANLAR (SON 12 SATIR) ===")
print(result.tail(12).to_string(index=False))

con.close()
