"""Boundary-aware deterministic medication alias resolution. (<=100 LOC)"""
import re
import unicodedata

from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY


def resolve_registered_medications(text: str) -> list[str]:
    """Return canonical registry keys for aliases present in text.

    Longest matches win when aliases overlap; output order follows first
    appearance in the input, with each canonical key returned once.
    """
    if not text:
        return []
    normalized = unicodedata.normalize("NFKD", text).casefold()
    normalized = "".join(char for char in normalized if not unicodedata.combining(char)).replace("đ", "d")
    aliases: list[tuple[str, str]] = []
    for key, entry in DRUG_REGISTRY.items():
        for alias in entry.get("aliases", []):
            alias = unicodedata.normalize("NFKD", alias).casefold().strip()
            alias = "".join(char for char in alias if not unicodedata.combining(char)).replace("đ", "d")
            if len(alias) >= 3:
                aliases.append((alias, key))
    # A plain electrolyte/context word should not become a drug entity. Only
    # resolve potassium chloride when the full medication name is present.
    # Exclude single generic tokens like 'kali', 'nhom' (collides with 'nhóm'), 'sat' (collides with 'sát').
    aliases = [(alias, key) for alias, key in aliases if alias not in ("kali", "nhom", "sat")]
    aliases.sort(key=lambda pair: len(pair[0]), reverse=True)

    matches: list[tuple[int, int, str]] = []
    occupied: list[tuple[int, int]] = []
    for alias, key in aliases:
        for match in re.finditer(r"(?<![\w])" + re.escape(alias) + r"(?![\w])", normalized):
            start, end = match.span()
            if any(start < used_end and end > used_start for used_start, used_end in occupied):
                continue
            occupied.append((start, end))
            matches.append((start, end, key))
    output: list[str] = []
    for _, _, key in sorted(matches):
        if key not in output:
            output.append(key)
    return output
