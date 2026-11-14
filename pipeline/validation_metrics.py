
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonization_validation.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")

result = con.execute(f"""
    SELECT
        COUNT(*) AS test_pairs,

        ROUND(
            100.0 * SUM(error_after)
            / NULLIF(SUM(modis), 0),
            2
        ) AS wape_percent,

        ROUND(
            AVG(adjusted_noaa20 - modis),
            2
        ) AS mean_bias,

        ROUND(
            100.0 * (
                SUM(adjusted_noaa20) - SUM(modis)
            ) / NULLIF(SUM(modis), 0),
            2
        ) AS relative_bias_percent,

        ROUND(
            AVG(
                ABS(adjusted_noaa20 - modis)
                / NULLIF(modis, 0)
            ) * 100.0,
            2
        ) AS mape_percent

    FROM read_csv_auto('{source}')
""").df()

print("\nHARMONIZATION - EK VALIDATION METRIKLERI")
print(result.to_string(index=False))

monthly = con.execute(f"""
    SELECT
        month,
        COUNT(*) AS test_pairs,
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
    FROM read_csv_auto('{source}')
    GROUP BY month
    ORDER BY month
""").df()

print("\nAYLIK VALIDATION SONUCLARI")
print(monthly.to_string(index=False))

con.close()
