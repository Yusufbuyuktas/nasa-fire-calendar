
from pathlib import Path
import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data" / "processed"

SOURCE = DATA / "harmonized_activity.csv"
LOYO = DATA / "monthly_anomalies_loyo.csv"

con = duckdb.connect()

source = SOURCE.as_posix().replace("'", "''")
loyo = LOYO.as_posix().replace("'", "''")

con.execute(f"""
CREATE TEMP VIEW activity AS
SELECT *
FROM read_csv_auto('{source}')
""")

con.execute(f"""
CREATE TEMP VIEW loyo AS
SELECT *
FROM read_csv_auto('{loyo}')
""")

checks = con.execute("""
SELECT
    (SELECT COUNT(*) FROM activity) AS source_rows,
    (SELECT COUNT(*) FROM loyo) AS loyo_rows,

    (SELECT COUNT(*)
     FROM (
         SELECT grid_id, year, month
         FROM loyo
         GROUP BY grid_id, year, month
         HAVING COUNT(*) > 1
     )) AS duplicate_keys,

    (SELECT COUNT(*)
     FROM loyo
     WHERE NOT isfinite(z_score)
       AND z_score IS NOT NULL
    ) AS invalid_z_scores,

    (SELECT COUNT(*)
     FROM loyo
     WHERE history_count < 3
       AND z_score IS NOT NULL
    ) AS invalid_history,

    (SELECT COUNT(*)
     FROM loyo
     WHERE history_count >= 3
       AND historical_std > 0
       AND z_score IS NULL
    ) AS missing_scores
""").df()

print("\nLOYO VALIDATION")
print(checks.to_string(index=False))

# Bağımsız referans kontrolü:
# Bir örnek kayıt için hedef yıl çıkarılarak
# ortalama ve standart sapma yeniden hesaplanır.

sample = con.execute("""
SELECT
    grid_id, year, month,
    history_count,
    historical_mean,
    historical_std,
    z_score
FROM loyo
WHERE z_score IS NOT NULL
ORDER BY grid_id, year, month
LIMIT 1
""").fetchone()

if sample:
    grid_id, year, month, count, mean, std, z = sample

    reference = con.execute("""
        SELECT
            COUNT(*) AS n,
            AVG(activity_index) AS mean,
            STDDEV_SAMP(activity_index) AS std
        FROM activity
        WHERE grid_id = ?
          AND month = ?
          AND year <> ?
    """, [grid_id, month, year]).fetchone()

    print("\nINDEPENDENT SAMPLE CHECK")
    print("Grid:", grid_id)
    print("Year:", year, "Month:", month)
    print("LOYO history:", count)
    print("Reference history:", reference[0])
    print("LOYO mean:", mean)
    print("Reference mean:", reference[1])
    print("LOYO std:", std)
    print("Reference std:", reference[2])

    assert count == reference[0], "History count mismatch"
    assert abs(mean - reference[1]) < 0.001, "Mean mismatch"
    assert abs(std - reference[2]) < 0.001, "Std mismatch"

    print("\nIndependent sample check: PASSED")

con.close()
