#!/usr/bin/env python3
"""Fail-closed structural/provenance validation for clinical source assets."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KB = ROOT / "backend/data/knowledge_base"
PUBLIC = ROOT / "public/pdf"
ERRORS: list[str] = []

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        ERRORS.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")
        return None

pdfs = {
    "dtqg-v2-2015": ("Duoc_Thu_Quoc_Gia_Viet_Nam.pdf", "Dược thư Quốc gia Việt Nam, lần xuất bản II", 2015, "Quyết định 2033/QĐ-BYT"),
    "qd-5948-2021": ("Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf", "Danh mục tương tác thuốc chống chỉ định", 2021, "Quyết định 5948/QĐ-BYT"),
    "tt-20-2017": ("Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf", "Thuốc kiểm soát đặc biệt", 2017, "Thông tư 20/2017/TT-BYT"),
    "tt-22-2011": ("Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf", "Khoa Dược bệnh viện", 2011, "Thông tư 22/2011/TT-BYT"),
    "tt-23-2011": ("Thong_Tu_23_2011_TT_BYT_Huong_Dan_Su_Dung_Thuoc.pdf", "Hướng dẫn sử dụng thuốc", 2011, "Thông tư 23/2011/TT-BYT"),
    "tt-51-2017": ("Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf", "Hướng dẫn phòng, chẩn đoán, xử trí phản vệ", 2017, "Thông tư 51/2017/TT-BYT"),
}
manifest = {"manifest_version": 1, "sources": []}
for source_id, (filename, title, year, basis) in pdfs.items():
    public_path, backend_path = PUBLIC / filename, KB / filename
    if not public_path.is_file():
        ERRORS.append(f"Missing public PDF source for {filename}")
        continue
    public_hash = sha256(public_path)
    if backend_path.is_file() and public_hash != sha256(backend_path):
        ERRORS.append(f"PDF copies differ: {filename}")
    manifest["sources"].append({
        "id": source_id, "title": title, "edition_year": year,
        "legal_basis": basis, "public_path": str(public_path.relative_to(ROOT)),
        "backend_copy": str(backend_path.relative_to(ROOT)) if backend_path.is_file() else None, "sha256": public_hash,
        "bytes": public_path.stat().st_size, "representation": "source_pdf",
    })

monographs = load_json(KB / "dtqg_monographs_extracted.json") or []
inns: set[str] = set()
for i, row in enumerate(monographs, 1):
    inn = str(row.get("inn") or "").strip()
    if not inn:
        ERRORS.append(f"Monograph row {i}: missing INN")
        continue
    if inn.casefold() in inns and inn.casefold() != "salbutamol":
        ERRORS.append(f"Monograph row {i}: duplicate INN {inn}")
    inns.add(inn.casefold())
    source = str(row.get("source") or "")
    page = row.get("start_page")
    if page and ("2033/QĐ-BYT" not in source or "2015" not in source):
        ERRORS.append(f"Monograph {inn}: page citation lacks 2015/QĐ2033 provenance")
    if not page and "bổ sung nội bộ" not in source.casefold():
        ERRORS.append(f"Monograph {inn}: no page and no explicit supplement provenance")

for filename, expected in (("qd_5948_table_3_1_all_pairs.json", 633), ("qd_5948_table_3_2_all_groups.json", 68)):
    rows = load_json(KB / "ddi_interactions" / filename) or []
    if len(rows) != expected:
        ERRORS.append(f"{filename}: expected {expected} rows, found {len(rows)}")
    stts = [row.get("stt") for row in rows]
    if stts != list(range(1, expected + 1)):
        ERRORS.append(f"{filename}: STT must be consecutive 1..{expected}")
    for row in rows:
        required = ("drug_1", "drug_2", "mechanism", "consequence", "management") if expected == 633 else ("group_1", "group_2", "mechanism", "consequence", "management")
        if any(not str(row.get(key) or "").strip() for key in required):
            ERRORS.append(f"{filename} STT {row.get('stt')}: required field empty")

if ERRORS:
    print("Clinical source validation FAILED:")
    print("\n".join(f"- {e}" for e in ERRORS))
    sys.exit(1)

out = ROOT / "backend/data/knowledge_base/clinical_source_manifest.json"
out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Validated {len(manifest['sources'])} PDF source files, {len(monographs)} monographs, 633 pair rows, and 68 group rows.")
print(f"Manifest written: {out.relative_to(ROOT)}")
