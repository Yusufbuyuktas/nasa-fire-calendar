
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "data_quality_report.csv"
OUTPUT = DATA / "missing_months_report.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH sensor_ranges AS (
        SELECT
            sensor,
            MIN(make_date(year, month, 1)) AS first_month,
            MAX(make_date(year, month, 1)) AS last_month
        FROM read_csv_auto('{source}')
        GROUP BY sensor
    ),
    expected_months AS (
        SELECT
            sensor,
            CAST(month_date AS DATE) AS month_date
        FROM sensor_ranges,
        UNNEST(
            generate_series(
                first_month,
                last_month,
                INTERVAL 1 MONTH
            )
        ) AS t(month_date)
    ),
    actual_months AS (
        SELECT
            sensor,
            make_date(year, month, 1) AS month_date,
            total_hotspots
        FROM read_csv_auto('{source}')
    )
    SELECT
        e.sensor,
        YEAR(e.month_date) AS year,
        MONTH(e.month_date) AS month,
        COALESCE(a.total_hotspots, 0) AS recorded_hotspots,
        CASE
            WHEN a.month_date IS NULL
            THEN 'NO_HOTSPOT_RECORD'
            ELSE 'HAS_HOTSPOT_RECORD'
        END AS record_status
    FROM expected_months e
    LEFT JOIN actual_months a
        ON e.sensor = a.sensor
        AND e.month_date = a.month_date
    ORDER BY e.sensor, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nEksik ay kontrolü tamamlandı!")

summary = con.execute(f"""
    SELECT
        sensor,
        COUNT(*) AS expected_months,
        COUNT(*) FILTER (
            WHERE record_status = 'HAS_HOTSPOT_RECORD'
        ) AS months_with_records,
        COUNT(*) FILTER (
            WHERE record_status = 'NO_HOTSPOT_RECORD'
        ) AS months_without_records
    FROM read_csv_auto('{output}')
    GROUP BY sensor
    ORDER BY sensor
""").df()

print("\nAYLIK VERİ SÜREKLİLİĞİ")
print(summary.to_string(index=False))

missing = con.execute(f"""
    SELECT sensor, year, month
    FROM read_csv_auto('{output}')
    WHERE record_status = 'NO_HOTSPOT_RECORD'
    ORDER BY sensor, year, month
""").df()

print("\nKAYIT BULUNMAYAN AYLAR")

if missing.empty:
    print("Sensörlerin kayıt aralıklarında tamamen boş ay bulunmadı.")
else:
    print(missing.to_string(index=False))

con.close()
