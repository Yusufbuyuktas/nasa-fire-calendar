
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "data_quality_report.csv"
OUTPUT = DATA / "seasonal_quality_report.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    WITH history AS (
        SELECT
            sensor,
            year,
            month,
            total_hotspots,
            active_grids,
            AVG(total_hotspots) OVER (
                PARTITION BY sensor, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS historical_average,
            COUNT(*) OVER (
                PARTITION BY sensor, month
                ORDER BY year
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS historical_years
        FROM read_csv_auto('{source}')
        WHERE NOT (year = 2026 AND month = 11)
    )
    SELECT
        sensor,
        year,
        month,
        total_hotspots,
        active_grids,
        historical_years,
        ROUND(historical_average, 2) AS historical_average,
        CASE
            WHEN historical_years >= 3
                 AND historical_average > 0
            THEN ROUND(
                100.0 * (
                    total_hotspots - historical_average
                ) / historical_average,
                2
            )
            ELSE NULL
        END AS deviation_percent
    FROM history
    ORDER BY sensor, year, month
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("\nMevsimsel kalite raporu oluşturuldu!")
print("Dosya:", OUTPUT)

result = con.execute(f"""
    SELECT
        sensor,
        year,
        month,
        total_hotspots,
        historical_years,
        historical_average,
        deviation_percent
    FROM read_csv_auto('{output}')
    WHERE historical_years >= 3
      AND deviation_percent IS NOT NULL
    ORDER BY deviation_percent ASC
    LIMIT 15
""").df()

print("\nGEÇMİŞ YILLARA GÖRE EN BÜYÜK DÜŞÜŞLER")
print(result.to_string(index=False))

summary = con.execute(f"""
    SELECT
        sensor,
        COUNT(*) FILTER (
            WHERE deviation_percent < -40
        ) AS months_below_40_percent,
        COUNT(*) FILTER (
            WHERE deviation_percent > 40
        ) AS months_above_40_percent
    FROM read_csv_auto('{output}')
    GROUP BY sensor
    ORDER BY sensor
""").df()

print("\nMEVSİMSEL SAPMA ÖZETİ")
print(summary.to_string(index=False))

con.close()

