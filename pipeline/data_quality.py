
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_activity.csv"
OUTPUT = DATA / "data_quality_report.csv"

if not SOURCE.exists():
    raise FileNotFoundError(f"Dosya bulunamadı: {SOURCE}")

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH monthly AS (
        SELECT
            year,
            month,
            sensor,
            SUM(hotspot_count) AS total_hotspots,
            COUNT(DISTINCT grid_id) AS active_grids
        FROM read_csv_auto('{source}')
        GROUP BY year, month, sensor
    ),
    with_previous AS (
        SELECT
            *,
            LAG(total_hotspots) OVER (
                PARTITION BY sensor
                ORDER BY year, month
            ) AS previous_month_hotspots,
            LAG(year * 12 + month) OVER (
                PARTITION BY sensor
                ORDER BY year, month
            ) AS previous_month_number
        FROM monthly
    )
    SELECT
        year,
        month,
        sensor,
        total_hotspots,
        active_grids,
        previous_month_hotspots,
        CASE
            WHEN previous_month_number = year * 12 + month - 1
                 AND previous_month_hotspots > 0
            THEN ROUND(
                100.0 * (total_hotspots - previous_month_hotspots)
                / previous_month_hotspots,
                2
            )
            ELSE NULL
        END AS monthly_change_percent
    FROM with_previous
    ORDER BY sensor, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nVeri kalite raporu oluşturuldu!")
print("Dosya:", OUTPUT)

result = con.execute(f"""
    SELECT
        sensor,
        MIN(year) AS first_year,
        MAX(year) AS last_year,
        COUNT(*) AS months_with_hotspots,
        SUM(total_hotspots) AS total_hotspots
    FROM read_csv_auto('{output}')
    GROUP BY sensor
    ORDER BY sensor
""").df()

print("\nSENSÖR ÖZETİ")
print(result.to_string(index=False))

drops = con.execute(f"""
    SELECT
        sensor,
        year,
        month,
        total_hotspots,
        previous_month_hotspots,
        monthly_change_percent
    FROM read_csv_auto('{output}')
    WHERE monthly_change_percent IS NOT NULL
    ORDER BY monthly_change_percent ASC
    LIMIT 15
""").df()

print("\nEN BÜYÜK AYLIK DÜŞÜŞLER")
print(drops.to_string(index=False))

con.close()
