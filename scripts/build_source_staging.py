#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.source_staging import build_source_staging


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a raw DAV/PDF staging snapshot")
    parser.add_argument("--dav", type=Path, default=ROOT / "data/vietnam_drug_registry/dav_master_registry.json")
    parser.add_argument("--dav-raw", type=Path)
    parser.add_argument("--pdf", type=Path, default=ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/source-staging.sqlite")
    args = parser.parse_args()
    result = build_source_staging(
        dav_json=None if args.dav_raw else args.dav, dav_snapshot_dir=args.dav_raw, pdf_path=args.pdf, staging_db=args.out,
        dav_url="https://dichvucong.dav.gov.vn/congbothuoc/index",
        pdf_url="http://localhost:3002/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
