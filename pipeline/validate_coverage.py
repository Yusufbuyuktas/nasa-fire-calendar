
from pathlib import Path
import sys
import duckdb

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "data" / "raw"
PROCESSED = BASE / "data" / "processed"

EXPECTED = {
    "min_lat": -57.8,
    "max_lat": 38.9,
    "min_lon": -120.6,
    "max_lon": 180.0,
}

TOLERANCE = 0.02
GRID_TOLERANCE = 1.1

RAW_FILES = [
    RAW / "modis" / "fire_archive_M-C61_847319.csv",
    RAW / "modis" / "fire_nrt_M-C61_847319.csv",
    RAW / "viirs" / "noaa20" / "fire_archive_J1V-C2_847320.csv",
    RAW / "viirs" / "noaa20" / "fire_nrt_J1V-C2_847320.csv",
    RAW / "viirs" / "noaa21" / "fire_archive_J2V-C2_847321.csv",
    RAW / "viirs" / "noaa21" / "fire_nrt_J2V-C2_847321.csv",
]

PROCESSED_FILE = PROCESSED / "harmonized_activity.csv"


def main():
    errors = []
    con = duckdb.connect()

    combined = {
        "min_lat": float("inf"),
        "max_lat": float("-inf"),
        "min_lon": float("inf"),
        "max_lon": float("-inf"),
    }

    try:
        print("\nNASA FIRMS - RAW COVERAGE VALIDATION")

        for file in RAW_FILES:
            if not file.exists():
                errors.append(f"Missing file: {file}")
                continue

            path = file.as_posix().replace("'", "''")

            result = con.execute(f"""
                SELECT
                    COUNT(*),
                    COUNT(*) FILTER (
                        WHERE latitude IS NULL OR longitude IS NULL
                    ),
                    COUNT(*) FILTER (
                        WHERE latitude < -90 OR latitude > 90
                           OR longitude < -180 OR longitude > 180
                    ),
                    MIN(latitude),
                    MAX(latitude),
                    MIN(longitude),
                    MAX(longitude)
                FROM read_csv_auto('{path}')
            """).fetchone()

            total, missing, invalid, min_lat, max_lat, min_lon, max_lon = result

            print(f"\nFILE: {file.name}")
            print(f"Rows: {total:,}")
            print(f"Missing coordinates: {missing:,}")
            print(f"Invalid coordinates: {invalid:,}")
            print(f"Latitude: {min_lat} to {max_lat}")
            print(f"Longitude: {min_lon} to {max_lon}")

            if total == 0:
                errors.append(f"Empty file: {file.name}")
                continue

            if missing:
                errors.append(f"Missing coordinates in {file.name}")

            if invalid:
                errors.append(f"Invalid coordinates in {file.name}")

            combined["min_lat"] = min(combined["min_lat"], min_lat)
            combined["max_lat"] = max(combined["max_lat"], max_lat)
            combined["min_lon"] = min(combined["min_lon"], min_lon)
            combined["max_lon"] = max(combined["max_lon"], max_lon)

        print("\nCOMBINED RAW COVERAGE")
        for key, value in combined.items():
            print(f"{key}: {value}")

        if combined["min_lat"] < EXPECTED["min_lat"] - TOLERANCE:
            errors.append("Raw data extends south of expected bounds")

        if combined["max_lat"] > EXPECTED["max_lat"] + TOLERANCE:
            errors.append("Raw data extends north of expected bounds")

        if combined["min_lon"] < EXPECTED["min_lon"] - TOLERANCE:
            errors.append("Raw data extends west of expected bounds")

        if combined["max_lon"] > EXPECTED["max_lon"] + TOLERANCE:
            errors.append("Raw data extends east of expected bounds")

        if not errors:
            for key in EXPECTED:
                if abs(combined[key] - EXPECTED[key]) > TOLERANCE:
                    errors.append(f"Raw coverage does not reach expected {key}")

        print("\nPROCESSED GRID VALIDATION")

        if not PROCESSED_FILE.exists():
            errors.append(f"Missing processed file: {PROCESSED_FILE}")
        else:
            path = PROCESSED_FILE.as_posix().replace("'", "''")

            result = con.execute(f"""
                SELECT
                    COUNT(*),
                    MIN(grid_lat * 2 - 89),
                    MAX(grid_lat * 2 - 89),
                    MIN(grid_lon * 2 - 179),
                    MAX(grid_lon * 2 - 179),
                    COUNT(*) FILTER (
                        WHERE grid_lat < 0 OR grid_lat > 89
                           OR grid_lon < 0 OR grid_lon > 179
                    )
                FROM read_csv_auto('{path}')
            """).fetchone()

            total, min_lat, max_lat, min_lon, max_lon, invalid = result

            print(f"Records: {total:,}")
            print(f"Latitude: {min_lat} to {max_lat}")
            print(f"Longitude: {min_lon} to {max_lon}")
            print(f"Invalid grid coordinates: {invalid}")

            if total == 0:
                errors.append("Processed dataset is empty")

            if invalid:
                errors.append(f"{invalid} invalid grid coordinates")

            if total > 0:
                if min_lat < EXPECTED["min_lat"] - GRID_TOLERANCE:
                    errors.append("Processed latitude below expected bounds")

                if max_lat > EXPECTED["max_lat"] + GRID_TOLERANCE:
                    errors.append("Processed latitude above expected bounds")

                if min_lon < EXPECTED["min_lon"] - GRID_TOLERANCE:
                    errors.append("Processed longitude below expected bounds")

                if max_lon > EXPECTED["max_lon"] + GRID_TOLERANCE:
                    errors.append("Processed longitude above expected bounds")

    finally:
        con.close()

    print("\nEXPECTED SOURCE AREA")
    print(EXPECTED)

    if errors:
        print("\nVALIDATION ERRORS")
        for error in errors:
            print("ERROR:", error)

        print("\nRESULT: FAILED")
        sys.exit(1)

    print("\nRESULT: PASSED")
    print("Raw sensor files and processed grid bounds validated.")
    print("NOTE: Geographic bounds do not prove regional completeness.")


if __name__ == "__main__":
    main()
