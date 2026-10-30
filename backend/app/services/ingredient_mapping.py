from __future__ import annotations
import re
import json
from pathlib import Path
from typing import Any

def _key(value: str) -> str:
    value = value.casefold().replace('β','beta').replace('µ','u').replace('μ','u')
    return re.sub(r'[^a-z0-9]+', '', value)

def build_ingredient_dictionary(monographs: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result = {}
    for row in monographs:
        inn = str(row.get('inn') or '').strip()
        if not inn: continue
        canonical = {'canonical_inn': inn, 'atc_code': row.get('atc_code')}
        names = [inn]
        without_parenthetical = re.sub(r"\s*\([^()]+\)", "", inn).strip()
        if without_parenthetical:
            names.append(without_parenthetical)
        names += re.findall(r'\(([^()]+)\)', inn)
        for name in names:
            key = _key(name)
            if key: result.setdefault(key, {**canonical, "_match_type": "exact" if key == _key(inn) or key == _key(without_parenthetical) else "alias"})
    return result

def map_ingredient_name(raw_name: str, dictionary: dict[str, dict[str, Any]], reviewed_aliases: dict[str, str] | None = None) -> dict[str, Any]:
    raw = raw_name.strip()
    key = _key(raw)
    alias_target = (reviewed_aliases or {}).get(raw.casefold().strip()) or CURATED_ALIASES.get(raw.casefold().strip())
    if alias_target:
        target_key = _key(alias_target)
        if target_key in dictionary:
            item = dictionary[target_key]
            return {**{k: v for k, v in item.items() if k != "_match_type"}, "status": "mapped", "match_type": "reviewed_alias" if reviewed_aliases and raw.casefold().strip() in reviewed_aliases else "curated_alias"}
    normalized = re.sub(r"\s+\d+(?:[.,]\d+)?\s*(?:mcg|µg|μg|ug|mg|g|kg|iu|ui|%)\b", "", raw, flags=re.IGNORECASE).strip()
    normalized_key = _key(normalized)
    if normalized_key != key and normalized_key in dictionary:
        item = dictionary[normalized_key]
        return {**{k: v for k, v in item.items() if k != "_match_type"}, "status": "mapped", "match_type": "normalized_form"}
    if key in dictionary:
        item = dictionary[key]
        return {k: v for k, v in {**item, 'status': 'mapped', 'match_type': item.get('_match_type', 'alias')}.items() if k != '_match_type'}
    return {'canonical_inn': None, 'atc_code': None, 'status': 'unmapped', 'match_type': None, 'raw_name': raw}
CURATED_ALIASES = {
    "hydroclorothiazid": "hydrochlorothiazide",
    "acetylcystein": "acetylcysteine",
    "metronidazol": "metronidazole",
    "clorpheniramin maleat": "chlorpheniramine maleate",
    "loratadin": "loratadine",
    "fexofenadin": "fexofenadine",
    "desloratadin": "desloratadine",
    "simvastatin": "simvastatin",
    "acetaminophen": "paracetamol",
    "cafein": "caffeine",
    "acid ascorbic": "ascorbic acid",
    "pyridoxin": "pyridoxine",
    "natri clorid": "sodium chloride",
    "lamivudin": "lamivudine",
    "dextromethorphan hbr": "dextromethorphan",
    "dextromethorphan hydrobromid": "dextromethorphan",
    "enalapril maleat": "enalapril",
    "enalapril maleate": "enalapril",
    "losartan kali": "losartan",
    "losartan potassium": "losartan",
    "amoxicilin": "amoxicillin",
    "hydrochlorothiazid": "hydrochlorothiazide",
    "acetylcystein": "acetylcysteine",
    "metronidazol": "metronidazole",
    "clorpheniramin maleat": "chlorpheniramine",
    "loratadin": "loratadine",
    "fexofenadin": "fexofenadine",
    "desloratadin": "desloratadine",
    "methylprednisolon": "methylprednisolone",
    "prednison": "prednisone",
    "prednisolon": "prednisolone",
    "diclofenac natri": "diclofenac",
    "sulfamethoxazol": "sulfamethoxazole",
    "ezetimib": "ezetimibe",
    "fenofibrat": "fenofibrate",
}
def load_reviewed_aliases(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("Reviewed alias file must be a JSON list")
    aliases = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        alias = str(row.get("alias") or "").strip()
        canonical = str(row.get("canonical_inn") or "").strip()
        if alias and canonical and row.get("status") == "approved" and row.get("source") and row.get("reviewer"):
            aliases[alias.casefold()] = canonical
    return aliases


def validate_reviewed_aliases(rows: list[dict[str, Any]], dictionary: dict[str, dict[str, Any]]) -> list[str]:
    canonical_inns = {str(item.get("canonical_inn") or "").strip() for item in dictionary.values()}
    canonical_keys = {_key(value) for value in canonical_inns if value}
    errors: list[str] = []
    seen: dict[str, str] = {}
    for index, row in enumerate(rows, 1):
        alias = str(row.get("alias") or "").strip()
        canonical = str(row.get("canonical_inn") or "").strip()
        if row.get("status") != "approved":
            continue
        if not alias or not canonical or not row.get("source") or not row.get("reviewer") or not row.get("reviewed_at"):
            errors.append(f"row {index}: approved alias requires alias, canonical INN, source, reviewer and reviewed_at")
        if canonical not in canonical_inns and _key(canonical) not in canonical_keys:
            errors.append(f"row {index}: canonical INN is not in DTQG dictionary: {canonical}")
        alias_key = _key(alias)
        if alias_key in dictionary and dictionary[alias_key].get("canonical_inn") != canonical:
            errors.append(f"row {index}: alias collides with existing dictionary mapping: {alias}")
        previous = seen.get(alias_key)
        if previous and previous != canonical:
            errors.append(f"row {index}: alias maps to conflicting canonical INNs: {alias}")
        seen[alias_key] = canonical
    return errors
