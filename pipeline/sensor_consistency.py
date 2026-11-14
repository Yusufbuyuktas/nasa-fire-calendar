
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "seasonal_quality_report.csv"
OUTPUT = DATA / "sensor_consistency_report.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    SELECT
        year,
        month,

        MAX(CASE
            WHEN sensor = 'MODIS'
            THEN deviation_percent
        END) AS modis_deviation,

        MAX(CASE
            WHEN sensor = 'VIIRS_NOAA20'
            THEN deviation_percent
        END) AS noaa20_deviation,

        MAX(CASE
            WHEN sensor = 'VIIRS_NOAA21'
            THEN deviation_percent
        END) AS noaa21_deviation

    FROM read_csv_auto('{source}')
    GROUP BY year, month
    ORDER BY year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nSensör tutarlılık raporu oluşturuldu!")

result = con.execute(f"""
    SELECT *
    FROM read_csv_auto('{output}')
    WHERE modis_deviation IS NOT NULL
      AND noaa20_deviation IS NOT NULL
      AND year >= 2023
    ORDER BY year DESC, month DESC
    LIMIT 20
""").df()

print("\nSON DÖNEM SENSÖR KARŞILAŞTIRMASI")
print(result.to_string(index=False))

con.close()
