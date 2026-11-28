"""
Short-lived subprocess worker for PyMuPDF / PyMuPDF4LLM operations.

Isolating C/C++ MuPDF allocations in a child process ensures 100% of PDF parsing
memory (~40-150 MiB) is immediately returned to the OS on exit instead of
staying pinned inside the 512 MiB Render web process.
"""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def _collect_suspicious_spans(doc: Any, max_pages: int) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []
    for i in range(min(len(doc), max_pages)):
        page_dict = doc[i].get_text("dict") or {}
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = (span.get("text") or "").strip()
                    if len(txt) < 8:
                        continue
                    size = float(span.get("size") or 10.0)
                    color = int(span.get("color") or 0)
                    r = (color >> 16) & 0xFF
                    g = (color >> 8) & 0xFF
                    b = color & 0xFF
                    if size < 2.5 or (r >= 245 and g >= 245 and b >= 245):
                        spans.append({"size": size, "r": r, "g": g, "b": b, "text": txt})
    return spans


def _handle_inspect(pdf_path: str, max_pages: int) -> dict[str, Any]:
    import pymupdf

    doc = pymupdf.open(pdf_path)
    try:
        total_pages = len(doc)
        pages_to_check = min(total_pages, max_pages)
        empty_pages = 0
        total_chars = 0
        sample_texts: list[str] = []
        for i in range(pages_to_check):
            txt = (doc[i].get_text("text") or "").strip()
            total_chars += len(txt)
            if len(re.sub(r"\s+", "", txt)) < 30:
                empty_pages += 1
            elif len(sample_texts) < 3:
                sample_texts.append(txt[:1000])
        spans = _collect_suspicious_spans(doc, pages_to_check)
        return {
            "total_pages": total_pages,
            "empty_pages": empty_pages,
            "total_chars": total_chars,
            "sample_texts": sample_texts,
            "spans": spans,
        }
    finally:
        doc.close()


def _handle_spans(pdf_path: str, max_pages: int) -> dict[str, Any]:
    import pymupdf

    doc = pymupdf.open(pdf_path)
    try:
        return {"spans": _collect_suspicious_spans(doc, max_pages)}
    finally:
        doc.close()


def _handle_extract(pdf_path: str, max_ocr_pages: int) -> dict[str, Any]:
    import pymupdf
    import pymupdf4llm

    doc = pymupdf.open(pdf_path)
    try:
        total_pages = len(doc)
        if total_pages == 0:
            return {"total_pages": 0, "pages": []}

        md_by_page: dict[int, str] = {}
        try:
            page_items = pymupdf4llm.to_markdown(doc, page_chunks=True)
            for idx, item in enumerate(page_items, start=1):
                if isinstance(item, dict):
                    p_num = int((item.get("metadata") or {}).get("page") or idx)
                    md_by_page[p_num] = str(item.get("text") or "")
        except Exception:
            pass

        pages_out: list[dict[str, Any]] = []
        ocr_slots_used = 0
        for page_idx in range(1, total_pages + 1):
            page = doc[page_idx - 1]
            page_text = (md_by_page.get(page_idx) or "").strip()
            if len(page_text) < 40:
                raw_txt = (page.get_text("text") or "").strip()
                if len(raw_txt) > len(page_text):
                    page_text = raw_txt

            b64_img = None
            if len(re.sub(r"\s+", "", page_text)) < 30 and ocr_slots_used < max_ocr_pages:
                try:
                    pix = page.get_pixmap(dpi=150)
                    b64_img = base64.b64encode(pix.tobytes("png")).decode("ascii")
                    ocr_slots_used += 1
                except Exception:
                    b64_img = None

            pages_out.append({
                "page": page_idx,
                "text": page_text.strip(),
                "image_b64": b64_img,
            })

        return {"total_pages": total_pages, "pages": pages_out}
    finally:
        doc.close()


def run_pdf_worker(mode: str, file_bytes: bytes, arg: int = 15, timeout_sec: int = 90) -> dict[str, Any]:
    """Execute a PyMuPDF task in an isolated short-lived subprocess via JSON output file."""
    backend_dir = str(Path(__file__).resolve().parents[3])
    env = os.environ.copy()
    existing_pp = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = f"{backend_dir}{os.pathsep}{existing_pp}" if existing_pp else backend_dir

    tmp_pdf = ""
    tmp_out = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fp:
            fp.write(file_bytes)
            tmp_pdf = fp.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as fo:
            tmp_out = fo.name

        proc = subprocess.run(
            [sys.executable, "-m", "app.services.rag.pdf_worker", mode, tmp_pdf, str(arg), tmp_out],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=env,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or f"pdf_worker exited with code {proc.returncode}")
        return json.loads(Path(tmp_out).read_text(encoding="utf-8"))
    finally:
        for path_str in (tmp_pdf, tmp_out):
            if path_str:
                try:
                    os.unlink(path_str)
                except OSError:
                    pass


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: pdf_worker <inspect|spans|extract> <pdf_path> [arg] [out_json_path]", file=sys.stderr)
        return 2
    mode, pdf_path = argv[1], argv[2]
    arg = int(argv[3]) if len(argv) > 3 else 15
    out_path = argv[4] if len(argv) > 4 else None

    if mode == "inspect":
        payload = _handle_inspect(pdf_path, arg)
    elif mode == "spans":
        payload = _handle_spans(pdf_path, arg)
    elif mode == "extract":
        payload = _handle_extract(pdf_path, arg)
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        return 2

    serialized = json.dumps(payload, ensure_ascii=False)
    if out_path:
        Path(out_path).write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
