
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonization_validation.csv"

con = duckdb.connect()
source = SOURCE.as_posix().replace("'", "''")

result = con.execute(f"""
    WITH grouped AS (
        SELECT
            *,
            NTILE(4) OVER (
                ORDER BY modis, grid_id, month
            ) AS activity_group
        FROM read_csv_auto('{source}')
    )
    SELECT
        activity_group,
        COUNT(*) AS test_pairs,
        MIN(modis) AS min_modis,
        MAX(modis) AS max_modis,

        ROUND(AVG(error_after), 2) AS mae,

        ROUND(
            100.0 * SUM(error_after)
            / NULLIF(SUM(modis), 0),
            2
        ) AS wape_percent,

        ROUND(
            100.0 * (
                SUM(adjusted_noaa20) - SUM(modis)
            ) / NULLIF(SUM(modis), 0),
            2
        ) AS relative_bias_percent

    FROM grouped
    GROUP BY activity_group
    ORDER BY activity_group
""").df()

print("\nAKTIVITE SEVIYESINE GORE HATA ANALIZI")
print(result.to_string(index=False))

con.close()
