"""
Specialty Clinical Knowledge Registry.
Quản lý và truy xuất động 75+ chủ đề lâm sàng chuyên sâu (Thai kỳ, Nhi khoa, Ung thư, Cấp cứu, Dược thư).
Thay thế hoàn toàn mảng tĩnh hardcode trong mã nguồn, hỗ trợ nạp động JSON và đối soát Hybrid RAG.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

KB_SPECIALTY_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "knowledge_base" / "specialty_guidelines"
KNOWLEDGE_FILE = KB_SPECIALTY_DIR / "specialty_clinical_knowledge.json"
ANCHORS_FILE = KB_SPECIALTY_DIR / "topic_anchors.json"


class SpecialtyKnowledgeRegistry:
    """Registry động quản lý tri thức chuyên khoa lâm sàng với In-Memory Indexing."""

    _instance: Optional[SpecialtyKnowledgeRegistry] = None

    def __init__(self, data_file: Optional[Path] = None, anchors_file: Optional[Path] = None):
        self._data_file = data_file or KNOWLEDGE_FILE
        self._anchors_file = anchors_file or ANCHORS_FILE
        self._knowledge_items: List[Dict[str, Any]] = []
        self._topic_map: Dict[str, Dict[str, Any]] = {}
        self._anchors_map: Dict[str, List[str]] = {}
        self._is_loaded = False
        self._load()

    @classmethod
    def get_instance(cls) -> SpecialtyKnowledgeRegistry:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load(self) -> None:
        if not self._data_file.exists():
            logger.warning("Specialty knowledge file not found at: %s", self._data_file)
            self._knowledge_items = []
            return

        try:
            with open(self._data_file, "r", encoding="utf-8") as f:
                self._knowledge_items = json.load(f)

            self._topic_map = {item["topic"]: item for item in self._knowledge_items if "topic" in item}

            if self._anchors_file.exists():
                with open(self._anchors_file, "r", encoding="utf-8") as f:
                    self._anchors_map = json.load(f)
            else:
                self._anchors_map = {}

            self._is_loaded = True
            logger.info("Successfully loaded %d specialty clinical topics.", len(self._knowledge_items))
        except Exception as exc:
            logger.error("Error loading specialty clinical knowledge: %s", exc)
            self._knowledge_items = []
            self._topic_map = {}
            self._anchors_map = {}

    def reload(self) -> None:
        """Nạp lại dữ liệu tri thức tức thì (Hot-reload) mà không cần restart server."""
        self._load()

    @property
    def total_topics(self) -> int:
        return len(self._knowledge_items)

    def get_topic_anchors(self) -> Dict[str, List[str]]:
        return self._anchors_map

    def get_knowledge_items(self) -> List[Dict[str, Any]]:
        return self._knowledge_items

    def get_by_topic(self, topic: str) -> Optional[Dict[str, Any]]:
        return self._topic_map.get(topic)

    def find_consultation(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Tìm kiếm chủ đề tư vấn lâm sàng chuyên khoa phù hợp nhất.
        Hỗ trợ đối soát đa ứng viên: chuỗi gốc, chuẩn hóa và không dấu.
        """
        if not self._is_loaded or not self._knowledge_items:
            self._load()

        if not self._knowledge_items:
            return None

        from app.services.chatbot.copilot_orchestrator import normalize_conversational_query
        from app.services.chatbot.clinical_schema_extractor import _normalize_str

        q_candidates = [query.lower()]
        norm = normalize_conversational_query(query).lower()
        if norm != q_candidates[0]:
            q_candidates.append(norm)
        unacc = _normalize_str(query).lower()
        if unacc not in q_candidates:
            q_candidates.append(unacc)

        best_item: Optional[Dict[str, Any]] = None
        best_score = 0

        for q_lower in q_candidates:
            for item in self._knowledge_items:
                topic = item.get("topic", "")
                anchors = self._anchors_map.get(topic, item.get("required_any"))
                if anchors and not any(a in q_lower for a in anchors):
                    continue

                keywords = item.get("keywords", [])
                matched = [kw for kw in keywords if kw in q_lower]
                if len(matched) >= 2 or (len(keywords) <= 2 and len(matched) >= 1):
                    score = len(matched) * 15 + sum(len(kw) for kw in matched)
                    if score > best_score:
                        best_score = score
                        best_item = item

            if best_item:
                return best_item

        return best_item
