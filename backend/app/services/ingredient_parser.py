from __future__ import annotations
import re
from typing import Any


# Deliberately narrow: split only when each segment is a simple name followed by a strength.
_STRENGTH = r"\d+(?:[.,]\d+)?\s*(?:mcg|microgram|µg|μg|mg|g|kg|iu|ui|units?|%)"
_SEGMENT = re.compile(rf"^\s*(?P<name>[A-Za-zÀ-ỹ0-9βµμ][A-Za-zÀ-ỹ0-9βµμ()'’., -]*?)\s+(?P<strength>{_STRENGTH})\s*$", re.IGNORECASE)


def parse_active_ingredients(active_raw: str | None, strength_raw: str | None = None) -> dict[str, Any]:
    raw = active_raw or ''
    if not raw.strip():
        return {"raw": raw, "status": "needs_review", "ingredients": [], "reason": "missing_active_ingredient"}
    if not re.search(r"[;+]|\b(?:and|và)\b", raw, re.IGNORECASE):
        return {"raw": raw, "status": "parsed", "ingredients": [{"name_raw": raw.strip(), "strength_raw": (strength_raw or '').strip() or None}], "reason": None}
    segments = re.split(r"\s*;\s*", raw)
    if len(segments) < 2:
        return {"raw": raw, "status": "needs_review", "ingredients": [], "reason": "ambiguous_delimiter_or_expression"}
    parsed = []
    for segment in segments:
        match = _SEGMENT.fullmatch(segment)
        if not match:
            return {"raw": raw, "status": "needs_review", "ingredients": [], "reason": "segment_without_unambiguous_name_and_strength"}
        parsed.append({"name_raw": match.group('name').strip(), "strength_raw": match.group('strength').strip()})
    return {"raw": raw, "status": "parsed", "ingredients": parsed, "reason": None}
