#!/usr/bin/env python3
"""Create a read-only quality report for the configured SQLite drug database."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.drug_db_audit import audit_drug_database

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=ROOT / "backend/clinical_hospital.db")
    parser.add_argument("--dtqg", type=Path, default=ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/drug-db-audit")
    args = parser.parse_args()

    report = audit_drug_database(args.db, args.dtqg)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "summary.json").write_text(
        json.dumps({key: value for key, value in report.items() if key != "review_queue"}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.out / "review_queue.json").write_text(
        json.dumps(report["review_queue"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({key: value for key, value in report.items() if key != "review_queue"}, ensure_ascii=False, indent=2))
    print(f"Review queue: {len(report['review_queue'])} products -> {args.out / 'review_queue.json'}")


if __name__ == "__main__":
    main()
