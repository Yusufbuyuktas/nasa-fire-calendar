
import argparse
import json
import math
from pathlib import Path


def validate(path: Path):
    if not path.is_file():
        print(f"ERROR: File not found: {path}")
        return False

    size = path.stat().st_size

    try:
        with path.open("r", encoding="utf-8-sig") as f:
            stations = json.load(f)
    except (UnicodeError, json.JSONDecodeError) as exc:
        print(f"ERROR: Invalid JSON or encoding: {exc}")
        return False

    if not isinstance(stations, list):
        print("ERROR: Expected a JSON array.")
        return False

    errors = []
    seen_ids = set()
    seen_coords = set()
    duplicate_ids = 0
    duplicate_coords = 0

    for index, station in enumerate(stations, start=1):
        if not isinstance(station, dict):
            errors.append(f"Record {index}: not an object")
            continue

        missing = {"id", "name", "lat", "lon"} - station.keys()
        if missing:
            errors.append(f"Record {index}: missing {sorted(missing)}")
            continue

        station_id = station["id"]
        if not isinstance(station_id, (str, int)) or isinstance(station_id, bool):
            errors.append(f"Record {index}: invalid ID")
        elif station_id in seen_ids:
            duplicate_ids += 1
            errors.append(f"Record {index}: duplicate ID {station_id}")
        else:
            seen_ids.add(station_id)

        if not isinstance(station["name"], str) or not station["name"].strip():
            errors.append(f"Record {index}: invalid name")

        lat, lon = station["lat"], station["lon"]

        valid_numbers = all(
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            for value in (lat, lon)
        )

        if not valid_numbers or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            errors.append(f"Record {index}: invalid coordinates")
            continue

        coords = (lat, lon)
        if coords in seen_coords:
            duplicate_coords += 1
            errors.append(f"Record {index}: duplicate coordinates")
        else:
            seen_coords.add(coords)

    print("\nFIRE STATIONS - DATA QUALITY REPORT")
    print("-----------------------------------")
    print(f"File: {path}")
    print(f"Records: {len(stations)}")
    print(f"Size: {size:,} bytes")
    print(f"Duplicate IDs: {duplicate_ids}")
    print(f"Duplicate coordinates: {duplicate_coords}")
    print(f"Validation errors: {len(errors)}")

    for error in errors:
        print(f"  - {error}")

    if size > 5 * 1024 * 1024:
        print("WARNING: File exceeds 5 MB.")

    print(
        "\nNOTE: Structural validation does not verify real-world "
        "station locations or OSM provenance."
    )

    if errors:
        print("\nRESULT: FAILED")
        return False

    print("\nRESULT: PASSED")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path", type=Path)
    args = parser.parse_args()

    raise SystemExit(0 if validate(args.json_path) else 1)
