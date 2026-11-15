
from pathlib import Path
import sys
import duckdb

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "data" / "processed" / "harmonized_activity.csv"

# NASA FIRMS indirme e-postasındaki gerçek sınırlar
MIN_LAT, MAX_LAT = -57.8, 38.9
MIN_LON, MAX_LON = -120.6, 180.0

# 2 derecelik grid merkezleri için tolerans
TOLERANCE = 1.1


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Veri dosyası bulunamadı: {SOURCE}")

    con = duckdb.connect()

    try:
        path = SOURCE.as_posix().replace("'", "''")

        result = con.execute(f"""
            SELECT
                COUNT(*) AS total_rows,
                MIN(grid_lat * 2 - 89) AS min_lat,
                MAX(grid_lat * 2 - 89) AS max_lat,
                MIN(grid_lon * 2 - 179) AS min_lon,
                MAX(grid_lon * 2 - 179) AS max_lon,
                COUNT(*) FILTER (
                    WHERE grid_lat * 2 - 89 < -90
                       OR grid_lat * 2 - 89 > 90
                       OR grid_lon * 2 - 179 < -180
                       OR grid_lon * 2 - 179 > 180
                ) AS invalid_coordinates
            FROM read_csv_auto('{path}')
        """).fetchone()
    finally:
        con.close()

    total, min_lat, max_lat, min_lon, max_lon, invalid = result

    print("\nNASA FIRMS - COVERAGE VALIDATION")
    print(f"Records: {total:,}")
    print(f"Latitude: {min_lat} to {max_lat}")
    print(f"Longitude: {min_lon} to {max_lon}")
    print(f"Invalid coordinates: {invalid}")
    print("Declared source area:", MIN_LON, MIN_LAT, MAX_LON, MAX_LAT)

    errors = []

    if total == 0:
        errors.append("Dataset is empty")

    if invalid:
        errors.append(f"{invalid} invalid coordinates")

    if total > 0:
        if min_lat < MIN_LAT - TOLERANCE:
            errors.append("Latitude extends south of expected coverage")
        if max_lat > MAX_LAT + TOLERANCE:
            errors.append("Latitude extends north of expected coverage")
        if min_lon < MIN_LON - TOLERANCE:
            errors.append("Longitude extends west of expected coverage")
        if max_lon > MAX_LON + TOLERANCE:
            errors.append("Longitude extends east of expected coverage")

    if errors:
        for error in errors:
            print("ERROR:", error)
        print("RESULT: FAILED")
        sys.exit(1)

    print("RESULT: PASSED")
    print("NOTE: Coordinate bounds only; regional and global completeness are not verified.")


if __name__ == "__main__":
    main()


