#!/usr/bin/env python3
import argparse
import csv
import json
import sqlite3
from pathlib import Path
from app.services.ingredient_review_queue import build_unmapped_review_queue
from app.services.ingredient_source_gaps import build_source_gap_report
ROOT = Path(__file__).resolve().parents[1]
def main():
    parser = argparse.ArgumentParser(description="Export unmapped DAV ingredients for human review")
    parser.add_argument("--db", type=Path, default=ROOT / "artifacts/source-staging-raw.sqlite")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/unmapped-ingredients.json")
    args = parser.parse_args()
    conn = sqlite3.connect(f"file:{args.db.resolve()}?mode=ro", uri=True)
    queue = build_unmapped_review_queue(conn)
    gaps = build_source_gap_report(conn)
    conn.close()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
    csv_path = args.out.with_suffix(".csv")
    with csv_path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=["raw_name", "ingredient_rows", "product_count", "examples", "decision", "proposed_canonical_inn", "reviewer", "reviewed_at"])
        writer.writeheader()
        for row in queue:
            writer.writerow({**row, "examples": json.dumps(row["examples"], ensure_ascii=False)})
    print(json.dumps({"unique_unmapped_names": len(queue), "unmapped_ingredient_rows": sum(row["ingredient_rows"] for row in queue), "top_names": queue[:20], "json": str(args.out), "csv": str(csv_path)}, ensure_ascii=False, indent=2))
    gap_path = args.out.with_name("ingredient-source-gaps.json")
    gap_path.write_text(json.dumps(gaps, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
    print(f"Source gap report: {gap_path}")
if __name__ == "__main__": main()
