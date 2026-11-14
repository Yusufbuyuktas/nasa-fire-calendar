
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "monthly_anomalies.csv"
OUTPUT = DATA / "frontend_activity.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
output = OUTPUT.as_posix().replace("'", "''")

query = f"""
COPY (
    SELECT
        grid_id,

        grid_lat * 2 - 89 AS lat,
        grid_lon * 2 - 179 AS lon,

        year,
        month,
        activity_index,
        z_score,
        anomaly_level,
        source

    FROM read_csv_auto('{source}')

    ORDER BY year, month, grid_id
)
TO '{output}'
(FORMAT CSV, HEADER TRUE);
"""

con.execute(query)

print("Frontend CSV oluşturuldu!")
print("Dosya:", OUTPUT)

result = con.execute(f"""
SELECT
    COUNT(*) AS total_rows,
    MIN(year) AS first_year,
    MAX(year) AS last_year
FROM read_csv_auto('{output}')
""").df()

print(result.to_string(index=False))

con.close()
