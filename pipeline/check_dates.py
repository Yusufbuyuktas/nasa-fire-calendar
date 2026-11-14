
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"

con = duckdb.connect()
con.execute("SET memory_limit='8GB'")
con.execute("SET threads=4")

files = sorted(DATA_DIR.glob("*_clean.csv"))

for file in files:
    print(f"\nKontrol ediliyor: {file.name}")

    result = con.execute("""
        SELECT
            MIN(date) AS first_date,
            MAX(date) AS last_date,
            COUNT(*) AS total_records,
            COUNT(DISTINCT date) AS active_days
        FROM read_csv_auto(?)
    """, [str(file)]).fetchone()

    print("İlk tarih:", result[0])
    print("Son tarih:", result[1])
    print("Toplam kayıt:", result[2])
    print("Veri bulunan gün:", result[3])

con.close()
