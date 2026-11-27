"""
Gemini-powered Semantic Heading Selector for PDF Highlighting.
Given a clinical query, optional drug monograph anchor, and the actual short
heading candidates visible on a rendered PDF page, uses gemini-2.5-flash-lite
to select only the exact relevant headings from that page (zero hallucination).
"""

from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from typing import Any, Dict, List, Optional

import httpx

from app.services.admin_key_vault import get_active_api_key_async
from app.services.gemini_model_discovery import get_available_gemini_models_async

GEMINI_HIGHLIGHT_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview"]
_MAX_CACHE_SIZE = 200
_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def build_highlight_prompt(
    query: str,
    page_candidates: List[str],
    drug_anchor: Optional[str] = None,
) -> str:
    """Build a compact strict-JSON prompt for Gemini to pick headings from page_candidates."""
    candidates_block = "\n".join(f"- {c}" for c in page_candidates[:60])
    anchor_line = f"Thuốc / chuyên luận mục tiêu: {drug_anchor}\n" if drug_anchor else ""
    return (
        "Bạn là bộ chọn chỉ mục tài liệu y khoa chính xác tuyệt đối.\n"
        f"Câu hỏi lâm sàng: {query.strip()}\n"
        f"{anchor_line}"
        "Danh sách các dòng/tiêu đề ngắn thực tế đang hiển thị trên trang PDF:\n"
        f"{candidates_block}\n\n"
        "Yêu cầu:\n"
        "1. Chỉ chọn 1 đến 3 chuỗi CHÍNH XÁC có trong danh sách trên là tiêu đề/chỉ mục trả lời trực tiếp cho câu hỏi.\n"
        "2. Nếu trang có nhiều thuốc khác nhau, chỉ chọn chỉ mục thuộc thuốc mục tiêu.\n"
        "3. Không bịa thêm chuỗi ngoài danh sách, không chọn câu văn dài.\n"
        '4. Trả về JSON đúng mẫu: {"drug_anchor": "<tên thuốc nếu thấy hoặc rỗng>", "selected_headings": ["..."]}'
    )


def parse_highlight_response(
    raw_text: str,
    page_candidates: List[str],
) -> Dict[str, Any]:
    """Parse Gemini JSON and strictly keep only headings present in page_candidates."""
    candidate_lookup = {c.strip().lower(): c.strip() for c in page_candidates if c and c.strip()}
    try:
        data = json.loads(raw_text)
    except Exception:
        return {"drug_anchor": None, "selected_headings": []}

    raw_headings = data.get("selected_headings") if isinstance(data, dict) else []
    selected: List[str] = []
    seen = set()
    if isinstance(raw_headings, list):
        for h in raw_headings:
            if not isinstance(h, str):
                continue
            key = h.strip().lower()
            matched = candidate_lookup.get(key)
            if not matched:
                # Try matching without trailing colon
                key_no_colon = key.rstrip(":")
                for ck, orig in candidate_lookup.items():
                    if ck.rstrip(":") == key_no_colon:
                        matched = orig
                        break
            if matched and matched.lower() not in seen:
                seen.add(matched.lower())
                selected.append(matched)

    anchor = data.get("drug_anchor") if isinstance(data, dict) else None
    clean_anchor = anchor.strip() if isinstance(anchor, str) and anchor.strip() else None
    return {
        "drug_anchor": clean_anchor,
        "selected_headings": selected[:4],
    }


def _cache_key(query: str, drug_anchor: Optional[str], candidates: List[str]) -> str:
    joined = "|".join([query.strip().lower(), (drug_anchor or "").strip().lower(), *candidates[:60]])
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def clear_highlight_selector_cache() -> None:
    _CACHE.clear()


async def select_highlight_headings_with_gemini(
    query: str,
    page_candidates: List[str],
    drug_anchor: Optional[str] = None,
    *,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call gemini-2.5-flash-lite to semantically select relevant headings on a PDF page.
    Returns {"drug_anchor": str | None, "selected_headings": List[str], "cached": bool}.
    """
    clean_query = (query or "").strip()
    clean_candidates = [c.strip() for c in page_candidates if isinstance(c, str) and 3 <= len(c.strip()) <= 65]
    if not clean_query or not clean_candidates:
        return {"drug_anchor": drug_anchor, "selected_headings": [], "cached": False}

    ck = _cache_key(clean_query, drug_anchor, clean_candidates)
    if ck in _CACHE:
        _CACHE.move_to_end(ck)
        cached_val = dict(_CACHE[ck])
        cached_val["cached"] = True
        return cached_val

    key = api_key or await get_active_api_key_async(provider="gemini")
    if not key or len(key.strip()) < 10:
        return {"drug_anchor": drug_anchor, "selected_headings": [], "cached": False}

    prompt = build_highlight_prompt(clean_query, clean_candidates, drug_anchor=drug_anchor)
    try:
        discovered = await get_available_gemini_models_async(key.strip())
    except Exception:
        discovered = []
    candidate_models = discovered[:2] if discovered else GEMINI_HIGHLIGHT_FALLBACK_MODELS
    headers = {"x-goog-api-key": key.strip(), "Content-Type": "application/json"}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 160,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = None
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code == 200:
                    res = r
                    break
            if res is None:
                return {"drug_anchor": drug_anchor, "selected_headings": [], "cached": False}
            body = res.json()
            raw_text = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            parsed = parse_highlight_response(raw_text, clean_candidates)
            result = {
                "drug_anchor": parsed["drug_anchor"] or drug_anchor,
                "selected_headings": parsed["selected_headings"],
                "cached": False,
            }
            _CACHE[ck] = result
            if len(_CACHE) > _MAX_CACHE_SIZE:
                _CACHE.popitem(last=False)
            return result
    except Exception:
        return {"drug_anchor": drug_anchor, "selected_headings": [], "cached": False}
