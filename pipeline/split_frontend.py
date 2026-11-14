from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent

SOURCE = BASE / "data" / "processed" / "frontend_activity.csv"
OUTPUT_DIR = BASE / "web" / "public" / "data"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")

years = con.execute(f"""
    SELECT DISTINCT year
    FROM read_csv_auto('{source}')
    ORDER BY year
""").fetchall()

for (year,) in years:
    output = OUTPUT_DIR / f"{year}.csv"
    output_path = output.as_posix().replace("'", "''")

    con.execute(f"""
    COPY (
        SELECT *
        FROM read_csv_auto('{source}')
        WHERE year = {int(year)}
          AND NOT (year = 2026 AND month >= 11)
        ORDER BY month, grid_id
    )
    TO '{output_path}'
    (FORMAT CSV, HEADER TRUE)
""")

    print(f"{year}.csv oluşturuldu")

con.close()

print("\nBütün yıllar hazır!")