#!/usr/bin/env python3
"""Build an immutable manifest for DAV and Dược thư source snapshots."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from app.services.source_manifest import build_manifest

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dav", type=Path, required=True)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--dav-url", default="https://dichvucong.dav.gov.vn/congbothuoc/index")
    parser.add_argument("--pdf-url", default="http://localhost:3002/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf")
    args = parser.parse_args()
    manifest = build_manifest(dav_path=args.dav, pdf_path=args.pdf, source_urls={"dav": args.dav_url, "pdf": args.pdf_url})
    args.out.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    args.out.write_text(serialized, encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
