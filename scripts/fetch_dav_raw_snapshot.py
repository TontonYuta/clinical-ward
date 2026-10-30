#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from app.services.dav_raw_snapshot import fetch_dav_snapshot

ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch raw paginated DAV API responses")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/dav-raw-snapshot")
    parser.add_argument("--page-size", type=int, default=200)
    parser.add_argument("--max-records", type=int)
    parser.add_argument("--sleep", type=float, default=0.25)
    args = parser.parse_args()
    if args.page_size < 1 or (args.max_records is not None and args.max_records < 1):
        parser.error("page-size and max-records must be positive")
    print(json.dumps(fetch_dav_snapshot(output_dir=args.out, page_size=args.page_size, max_records=args.max_records, sleep_seconds=args.sleep), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
