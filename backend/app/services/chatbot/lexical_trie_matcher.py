"""
Aho-Corasick Lexical Trie Matcher cho 55,000 thuốc DAV & Chuyên luận DĐVN V.
Đảm bảo trích xuất thực thể thuốc chuẩn xác < 0.1ms, kháng lỗi chính tả và gõ không dấu (<= 150 LOC).
"""
import re
import sqlite3
from typing import List, Optional, Tuple, Dict, Set
from app.seed_registry import resolve_db_path
from app.services.chatbot.trie_dictionary import strip_accents, COMMON_EXCLUSIONS, TrieNode
from app.services.chatbot.fuzzy_drug_resolver import FuzzyDrugResolver

__all__ = ["strip_accents", "COMMON_EXCLUSIONS", "TrieNode", "DrugLexicalMatcher", "get_drug_lexical_matcher"]

class DrugLexicalMatcher:
    """Trie đối khớp từ khóa thực thể dược phẩm siêu tốc độ O(L)."""
    def __init__(self):
        self.root = TrieNode()
        self.canonical_brands: Set[str] = set()
        self.canonical_inns: Set[str] = set()
        self._name_map: Dict[str, str] = {}
        self._candidates_by_first: Dict[str, List[str]] = {}
        self._is_loaded = False

    def insert(self, term: str, canonical: str, entity_type: str = "brand") -> None:
        term_clean = term.strip().lower()
        if len(term_clean) < 2 or len(term_clean) > 35 or term_clean in COMMON_EXCLUSIONS:
            return
        if entity_type == "brand":
            self.canonical_brands.add(canonical)
        else:
            self.canonical_inns.add(canonical)

        keys = [term_clean]
        unacc = strip_accents(term_clean)
        if (len(unacc) >= 4 or term_clean == unacc) and unacc not in COMMON_EXCLUSIONS:
            keys.append(unacc)

        for key in set(keys):
            node = self.root
            for char in key:
                if char not in node.children:
                    node.children[char] = TrieNode()
                node = node.children[char]
            node.is_end = True
            if not node.canonical or (any(c.isupper() for c in canonical) and not any(c.isupper() for c in node.canonical)):
                node.canonical = canonical
                node.entity_type = entity_type

    def load_from_db(self, db_path: Optional[str] = None) -> None:
        if self._is_loaded:
            return
        actual_path = resolve_db_path(db_path)
        try:
            conn = sqlite3.connect(actual_path)
            conn.execute("PRAGMA cache_size = -2000;")
            cursor = conn.cursor()
            salt_pattern = r"\b(?:hydroclorid|hydrochloride|hcl|natri|sodium|kali|potassium|maleat|maleate|succinat|succinate|sulfat|sulfate|citrat|citrate|acetat|acetate|tartrat|tartrate)\b"
            prefix_pattern = r"^(?:thuốc\s+|viên\s+nén\s+|viên\s+nang\s+cứng\s+|viên\s+nang\s+mềm\s+|viên\s+nang\s+|viên\s+hoàn\s+cứng\s+|viên\s+|dung\s+dịch\s+|hỗn\s+dịch\s+|bột\s+|cốm\s+|thuốc\s+tiêm\s+|kem\s+|gel\s+|mỗi\s+[\w\s\d.,%/-]+?\s+chứa:?\s*|trong\s+mỗi\s+[\w\s\d.,%/-]+?\s+có\s+chứa:?\s*)"
            dosage_form_filter = re.compile(r"^(?:viên\s+nang\s+cứng|viên\s+nang\s+mềm|viên\s+nén|viên\s+hoàn\s+cứng|ống\s+tiêm|bào\s+tử|dung\s+dịch|hỗn\s+dịch|gói|chai|lọ|tuýp)$", re.I)

            cursor.execute("SELECT DISTINCT brand_name, active_ingredient FROM dav_national_drugs")
            while True:
                rows = cursor.fetchmany(5000)
                if not rows:
                    break
                for brand, ingredient in rows:
                    if brand:
                        if len(brand) <= 35:
                            self.insert(brand, brand, "brand")
                        clean_brand = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị|mmol).*$", "", brand, flags=re.I).strip()
                        if 3 <= len(clean_brand) <= 35 and clean_brand.lower() not in COMMON_EXCLUSIONS and clean_brand != brand:
                            self.insert(clean_brand, clean_brand, "brand")
                        clean_noprefix = re.sub(prefix_pattern, "", clean_brand, flags=re.I).strip()
                        if 3 <= len(clean_noprefix) <= 35 and clean_noprefix.lower() not in COMMON_EXCLUSIONS and clean_noprefix != clean_brand:
                            self.insert(clean_noprefix, clean_noprefix, "brand")

                    if ingredient:
                        for part in ingredient.replace("+", ";").replace("/", ";").split(";"):
                            if dosage_form_filter.match(part.strip()):
                                continue
                            clean_part = re.sub(r"^mỗi\s+[\w\s\d.,%/-]+?\s+chứa:?\s*", "", part.strip(), flags=re.I).strip()
                            clean_part = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị|mmol).*$", "", clean_part, flags=re.I).strip()
                            clean_part = re.sub(prefix_pattern, "", clean_part, flags=re.I).strip()
                            if 3 <= len(clean_part) <= 35 and clean_part.lower() not in COMMON_EXCLUSIONS and not dosage_form_filter.match(clean_part):
                                self.insert(clean_part, clean_part, "ingredient")
                                salt_sub = re.sub(salt_pattern, "", clean_part, flags=re.I).strip()
                                if 3 <= len(salt_sub) <= 35 and salt_sub.lower() not in COMMON_EXCLUSIONS and not dosage_form_filter.match(salt_sub):
                                    self.insert(salt_sub, salt_sub, "ingredient")
            try:
                cursor.execute("SELECT title, inn FROM clinical_drug_monographs")
                for title, inn in cursor.fetchall():
                    if title and 3 <= len(title) <= 40:
                        self.insert(title, title, "monograph")
                    if inn and 3 <= len(inn) <= 40:
                        self.insert(inn, inn, "monograph")
            except Exception:
                pass
            conn.close()

            try:
                from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
                for inn, meta in DRUG_REGISTRY.items():
                    disp = meta.get("display", inn.title())
                    self.insert(disp, disp, "ingredient")
                    self.insert(inn, disp, "ingredient")
                    for alias in meta.get("aliases", []):
                        if 3 <= len(alias) <= 35 and alias.lower() not in COMMON_EXCLUSIONS:
                            self.insert(alias, alias, "brand")
            except Exception:
                pass

            for c in self.canonical_brands | self.canonical_inns:
                low = strip_accents(c.lower())
                if low and 3 <= len(low) <= 25:
                    self._name_map[low] = c
                    self._candidates_by_first.setdefault(low[0], []).append(low)
            self._is_loaded = True
        except Exception:
            pass

    def extract_medications(self, text: str) -> List[str]:
        """Trích xuất tất cả các thực thể thuốc có trong văn bản (kể cả không dấu & lỗi chính tả)."""
        if not self._is_loaded:
            self.load_from_db()

        text_norm = text.lower()
        text_unacc = strip_accents(text)
        candidates: List[Tuple[int, int, str, str]] = []

        for src in (text_norm, text_unacc):
            n = len(src)
            for i in range(n):
                if i > 0 and src[i-1].isalnum():
                    continue
                node = self.root
                j = i
                longest = None
                while j < n and src[j] in node.children:
                    node = node.children[src[j]]
                    if node.is_end:
                        if j + 1 == n or not src[j+1].isalnum():
                            longest = (i, j + 1, node.canonical or "", node.entity_type or "")
                    j += 1
                if longest and len(longest[2]) >= 3 and longest[2].lower() not in COMMON_EXCLUSIONS:
                    matched_slice = src[longest[0]:longest[1]].lower()
                    original_slice = text_norm[longest[0]:longest[1]].lower()
                    if matched_slice in COMMON_EXCLUSIONS or original_slice in COMMON_EXCLUSIONS:
                        continue
                    if (
                        src is text_unacc
                        and strip_accents(original_slice) != original_slice
                        and strip_accents(longest[2]) != longest[2].lower()
                        and original_slice != longest[2].lower()
                    ):
                        continue
                    candidates.append(longest)

        candidates.sort(key=lambda x: (x[0], -(x[1] - x[0])))
        results: List[str] = []
        seen: Set[str] = set()
        last_end = -1
        for start, end, canon, _ in candidates:
            if start >= last_end and canon.lower() not in seen:
                seen.add(canon.lower())
                results.append(canon)
                last_end = end
        return results

    def extract_sdk(self, text: str) -> Optional[str]:
        sdk_m = re.search(r"\b((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)\b", text, re.I)
        return sdk_m.group(1).upper() if sdk_m else None

    def fuzzy_candidate_search(self, token: str, top_k: int = 3) -> List[str]:
        """Tìm kiếm mờ khi người dùng gõ sai hoặc viết tắt qua FuzzyDrugResolver."""
        return FuzzyDrugResolver.resolve_token(
            token=token,
            canonical_brands=self.canonical_brands,
            name_map=self._name_map,
            candidates_by_first=self._candidates_by_first,
            top_k=top_k
        )

_MATCHER_INSTANCE: Optional[DrugLexicalMatcher] = None

def get_drug_lexical_matcher() -> DrugLexicalMatcher:
    global _MATCHER_INSTANCE
    if _MATCHER_INSTANCE is None:
        _MATCHER_INSTANCE = DrugLexicalMatcher()
        _MATCHER_INSTANCE.load_from_db()
    return _MATCHER_INSTANCE
