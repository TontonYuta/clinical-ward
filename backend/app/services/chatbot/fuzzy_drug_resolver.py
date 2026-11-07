"""
Fuzzy Levenshtein & Soundex Drug Resolver (Kỹ thuật 4).
Hỗ trợ tìm kiếm mờ, nhận diện biệt dược gõ sai chính tả hoặc viết tắt từ CSDL 55.000 thuốc.
"""
import difflib
from typing import List, Dict, Set, Optional
from pydantic import BaseModel, Field
from app.services.chatbot.trie_dictionary import strip_accents, COMMON_EXCLUSIONS

class FuzzyDrugMatch(BaseModel):
    query_token: str = Field(description="Từ khóa hoặc biệt dược người dùng gõ")
    matched_name: str = Field(description="Tên thuốc chuẩn hóa từ CSDL")
    similarity: float = Field(default=1.0, ge=0.0, le=1.0)
    entity_type: str = Field(default="brand", description="Loại: brand, ingredient, monograph")

def compute_levenshtein_similarity(s1: str, s2: str) -> float:
    """Tính độ tương đồng Levenshtein chuẩn hóa giữa 2 xâu (0.0 đến 1.0)."""
    return difflib.SequenceMatcher(None, s1, s2).ratio()

class FuzzyDrugResolver:
    """Bộ phân giải tên thuốc mờ dựa trên khoảng cách Levenshtein và tiền tố Trie."""

    @staticmethod
    def resolve_token(
        token: str,
        canonical_brands: Set[str],
        name_map: Dict[str, str],
        candidates_by_first: Dict[str, List[str]],
        top_k: int = 3,
        cutoff: float = 0.6
    ) -> List[str]:
        """Tìm kiếm các ứng viên tên thuốc gần nhất khi bác sĩ gõ sai chính tả."""
        token_clean = strip_accents(token.strip().lower())
        if len(token_clean) < 3 or token_clean in COMMON_EXCLUSIONS:
            return []

        matches: List[str] = []
        seen: Set[str] = set()

        # 1. Quét tiền tố hoặc xâu con trực tiếp
        for brand in canonical_brands:
            b_norm = strip_accents(brand.lower())
            if b_norm.startswith(token_clean) or (len(token_clean) >= 5 and token_clean in b_norm):
                if b_norm not in seen:
                    seen.add(b_norm)
                    matches.append(brand)
                    if len(matches) >= top_k:
                        break

        # 2. Tìm kiếm khoảng cách Levenshtein khi chưa đủ ứng viên
        if len(matches) < top_k and token_clean:
            first_char = token_clean[0]
            pool = candidates_by_first.get(first_char, [])
            close = difflib.get_close_matches(token_clean, pool, n=top_k, cutoff=cutoff)
            for c in close:
                orig = name_map.get(c, c.title())
                if orig.lower() not in seen:
                    seen.add(orig.lower())
                    matches.append(orig)
                    if len(matches) >= top_k:
                        break

        return matches
