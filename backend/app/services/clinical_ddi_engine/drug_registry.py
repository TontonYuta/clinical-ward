"""
Clinical Drug Registry & Pharmacological Taxonomy.
Dữ liệu được nạp động từ: backend/data/knowledge_base/drug_registry.json
Tuân thủ chuẩn Zero Hardcode: Không nhúng danh sách thực thể thuốc thô trực tiếp trong code Python.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parents[3] / "data" / "knowledge_base" / "drug_registry.json"

def _load_drug_registry() -> Dict[str, Dict[str, Any]]:
    if _DATA_PATH.is_file():
        try:
            with open(_DATA_PATH, "r", encoding="utf-8") as f:
                content = json.load(f)
                return content.get("drugs", {})
        except Exception as err:
            logger.error("Failed to load drug_registry.json: %s", err)
    return {}

DRUG_REGISTRY: Dict[str, Dict[str, Any]] = _load_drug_registry()
