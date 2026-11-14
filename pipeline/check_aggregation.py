
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
FILE = BASE_DIR / "data" / "processed" / "monthly_activity.csv"

if not FILE.exists():
    raise FileNotFoundError("monthly_activity.csv bulunamadı!")

con = duckdb.connect()
file_path = FILE.as_posix().replace("'", "''")

con.execute(f"""
    CREATE VIEW activity AS
    SELECT *
    FROM read_csv_auto('{file_path}')
""")
print("\n=== GENEL BİLGİLER ===")

print(con.execute("""
    SELECT
        COUNT(*) AS rows,
        SUM(hotspot_count) AS total_hotspots,
        MIN(year) AS first_year,
        MAX(year) AS last_year,
        COUNT(DISTINCT grid_id) AS grid_count
    FROM activity
""").df().to_string(index=False))

print("\n=== SENSÖR BAZINDA ===")

print(con.execute("""
    SELECT
        sensor,
        SUM(hotspot_count) AS hotspots,
        MIN(year) AS first_year,
        MAX(year) AS last_year
    FROM activity
    GROUP BY sensor
    ORDER BY sensor
""").df().to_string(index=False))

print("\n=== İLK 10 SATIR ===")

print(con.execute("""
    SELECT *
    FROM activity
    LIMIT 10
""").df().to_string(index=False))

con.close()
