import csv
import json
from pathlib import Path
from collections import Counter

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "data/processed/frontend_activity.csv"
DATA_DIR = BASE / "web/public/data"
CELLS_DIR = DATA_DIR / "cells"

FIELDS = [
    "grid_id", "lat", "lon", "year", "month",
    "activity_index", "z_score", "anomaly_level",
    "source", "history_count", "confidence_level"
]

def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != FIELDS:
            raise ValueError(f"Invalid CSV schema: {path}")
        return list(reader)

def normalize(value):
    if value is None or value == "":
        return None
    return str(value)

def signature(row):
    return tuple(normalize(row.get(field)) for field in FIELDS)

def main():
    errors = []

    source_rows = read_csv(SOURCE)
    expected_rows = [
        row for row in source_rows
        if not (
            int(row["year"]) == 2026
            and int(row["month"]) >= 11
        )
    ]

    print("\nB8 - FRONTEND DATA VALIDATION")
    print("Source rows:", len(source_rows))
    print("Expected exported rows:", len(expected_rows))

    # Annual CSV validation
    actual_rows = []
    years = sorted({int(r["year"]) for r in source_rows})

    for year in years:
        path = DATA_DIR / f"{year}.csv"

        if not path.exists():
            errors.append(f"Missing annual CSV: {path.name}")
            continue

        rows = read_csv(path)

        for row in rows:
            if int(row["year"]) != year:
                errors.append(
                    f"Wrong year in {path.name}: {row['year']}"
                )

        actual_rows.extend(rows)

    expected_counter = Counter(
        signature(row) for row in expected_rows
    )
    actual_counter = Counter(
        signature(row) for row in actual_rows
    )

    if expected_counter != actual_counter:
        errors.append("Annual CSV data differs from source")

    print("Annual CSV files:", len(years))
    print("Actual annual rows:", len(actual_rows))

    # Cell JSON validation
    json_files = list(CELLS_DIR.glob("*.json"))
    print("Cell JSON files:", len(json_files))

    if len(json_files) != 3815:
        errors.append(
            f"Expected 3815 JSON files, found {len(json_files)}"
        )

    json_rows = 0
    seen_keys = set()

    for path in json_files:
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)

            rows = data.get("rows")

            if not isinstance(rows, list):
                errors.append(f"Invalid rows array: {path.name}")
                continue

            for row in rows:
                json_rows += 1

                if not all(field in row for field in FIELDS):
                    errors.append(f"Missing fields: {path.name}")
                    continue

                if str(row["grid_id"]) != path.stem:
                    errors.append(f"Grid ID mismatch: {path.name}")

                year = int(row["year"])
                month = int(row["month"])

                if not 1 <= month <= 12:
                    errors.append(f"Invalid month: {path.name}")

                if not -90 <= float(row["lat"]) <= 90:
                    errors.append(f"Invalid latitude: {path.name}")

                if not -180 <= float(row["lon"]) <= 180:
                    errors.append(f"Invalid longitude: {path.name}")

                if float(row["activity_index"]) < 0:
                    errors.append(f"Negative activity: {path.name}")

                key = (row["grid_id"], year, month)

                if key in seen_keys:
                    errors.append(f"Duplicate grid-month: {key}")

                seen_keys.add(key)

        except (ValueError, TypeError, json.JSONDecodeError) as e:
            errors.append(f"Invalid JSON {path.name}: {e}")

    print("JSON records:", json_rows)

    # Compare every cell JSON record against the source CSV.
    def normalized_signature(row):
        values = []

        for field in FIELDS:
            value = row[field]

            if value is None or value == "":
                values.append(None)
            elif field in ("lat", "lon", "activity_index", "z_score"):
                values.append(round(float(value), 6))
            elif field in ("year", "month", "history_count"):
                values.append(int(value))
            else:
                values.append(str(value))

        return tuple(values)

    expected_json = Counter(
        normalized_signature(row) for row in source_rows
    )

    actual_json = Counter()

    for path in json_files:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        for row in data["rows"]:
            actual_json[normalized_signature(row)] += 1

    missing = expected_json - actual_json
    extra = actual_json - expected_json

    print("JSON missing records:", missing.total())
    print("JSON extra records:", extra.total())

    if missing or extra:
        errors.append(
            f"JSON/source mismatch: "
            f"{missing.total()} missing, {extra.total()} extra"
        )


    print("\nCHECKS")

    if errors:
        for error in errors[:20]:
            print("FAIL:", error)

        print("Total errors:", len(errors))
        raise SystemExit("\nRESULT: FAILED")

    print("Annual CSV consistency: PASS")
    print("JSON file count: PASS")
    print("JSON schema: PASS")
    print("Grid ID consistency: PASS")
    print("Coordinates and activity: PASS")
    print("Duplicate grid-months: PASS")
print("JSON/source consistency: PASS")
    print("\nRESULT: PASSED")


if __name__ == "__main__":
    main()
