import argparse
import json
import math
import os
from pathlib import Path

import duckdb

BASE = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("PIPELINE_OUTPUT_DIR", str(BASE / "data" / "processed")))
SOURCE = DATA / "frontend_activity.csv"
OUTPUT = BASE / "web" / "public" / "data" / "cells"

FIELDS = [
    "grid_id", "lat", "lon", "year", "month",
    "activity_index", "z_score", "anomaly_level",
    "source", "history_count", "confidence_level",
]


def clean_value(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def export_cells(limit=None):
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source CSV not found: {SOURCE}")

    OUTPUT.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect()
    try:
        source_path = SOURCE.as_posix().replace("'", "''")

        columns = {
            row[0]
            for row in con.execute(
                f"DESCRIBE SELECT * FROM read_csv_auto('{source_path}')"
            ).fetchall()
        }

        missing = set(FIELDS) - columns
        if missing:
            raise ValueError(f"Missing CSV columns: {sorted(missing)}")

        query = f"""
            SELECT {", ".join(FIELDS)}
            FROM read_csv_auto('{source_path}')
            ORDER BY grid_id, year, month
        """

        cursor = con.execute(query)
        current_id = None
        current_rows = []
        exported = 0
        total_rows = 0

        def write_cell(grid_id, rows):
            if not grid_id.replace("_", "").isdigit():
                raise ValueError(f"Invalid grid_id: {grid_id}")

            destination = OUTPUT / f"{grid_id}.json"
            temporary = OUTPUT / f"{grid_id}.json.tmp"

            with temporary.open("w", encoding="utf-8") as file:
                json.dump(
                    {"rows": rows},
                    file,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    allow_nan=False,
                )

            temporary.replace(destination)

        while True:
            batch = cursor.fetchmany(5000)
            if not batch:
                break

            for record in batch:
                row = {
                    field: clean_value(value)
                    for field, value in zip(FIELDS, record)
                }

                grid_id = str(row["grid_id"])

                if current_id is not None and grid_id != current_id:
                    write_cell(current_id, current_rows)
                    exported += 1
                    current_rows = []

                    if limit is not None and exported >= limit:
                        print(f"Test completed: {exported} cells")
                        print(f"Rows exported: {total_rows}")
                        return

                current_id = grid_id
                current_rows.append(row)
                total_rows += 1

        if current_id is not None:
            write_cell(current_id, current_rows)
            exported += 1

        print(f"Cells exported: {exported}")
        print(f"Rows exported: {total_rows}")
        print(f"Output: {OUTPUT}")

    finally:
        con.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")

    export_cells(args.limit)
