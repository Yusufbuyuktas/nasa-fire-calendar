
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data" / "processed"
OUTPUT_FILE = DATA_DIR / "monthly_activity.csv"
TEMP_DIR = BASE_DIR / "data" / "duckdb_temp"

TEMP_DIR.mkdir(parents=True, exist_ok=True)

con = duckdb.connect()

con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")
con.execute(
    f"SET temp_directory='{TEMP_DIR.as_posix()}'"
)

files = sorted(DATA_DIR.glob("*_clean.csv"))

if not files:
    raise FileNotFoundError(
        "Temizlenmiş CSV dosyaları bulunamadı!"
    )

print(f"{len(files)} CSV dosyası bulundu.")

file_list = ", ".join(
    "'" + str(file).replace("\\", "/").replace("'", "''") + "'"
    for file in files
)

query = f"""
COPY (
    WITH grid_data AS (
        SELECT
            LEAST(
                89,
                CAST(FLOOR((latitude + 90) / 2) AS INTEGER)
            ) AS grid_lat,

            LEAST(
                179,
                CAST(FLOOR((longitude + 180) / 2) AS INTEGER)
            ) AS grid_lon,

            YEAR(CAST(date AS DATE)) AS year,
            MONTH(CAST(date AS DATE)) AS month,
            sensor

        FROM read_csv_auto(
            [{file_list}],
            union_by_name=true
        )

        WHERE latitude >= -90
          AND latitude <= 90
          AND longitude >= -180
          AND longitude <= 180
    )

    SELECT
        CAST(grid_lat AS VARCHAR)
        || '_'
        || CAST(grid_lon AS VARCHAR)
        AS grid_id,

        grid_lat,
        grid_lon,
        year,
        month,
        sensor,
        COUNT(*) AS hotspot_count

    FROM grid_data

    GROUP BY
        grid_lat,
        grid_lon,
        year,
        month,
        sensor

    ORDER BY
        year,
        month,
        grid_lat,
        grid_lon,
        sensor
)
TO '{OUTPUT_FILE.as_posix()}'
(FORMAT CSV, HEADER TRUE, DELIMITER ',');
"""

print("Aggregation başlıyor...")
print("SQL başlangıcı:", repr(query[:200]))
con.execute(query)

print("Aggregation tamamlandı!")
print("Çıktı:", OUTPUT_FILE)

con.close()
