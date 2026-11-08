import json
import sqlite3
import re
import difflib
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.bhyt import (
    DavDrugCandidate,
    BhytDrugRuleSummary,
    DrugResolutionResult,
    DrugBatchResolutionResponse
)
from app.seed_bhyt_catalog import resolve_db_path, remove_vietnamese_accents

RE_CONC = re.compile(r'(\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|%|iu|ui))\b', re.IGNORECASE)
RE_STT = re.compile(r'^\s*\[?\d+[.)\]]\s*')
RE_QTY = re.compile(r'(?:x|sl:?|số lượng:?|\*)\s*\d+\s*(?:viên|ống|gói|lọ|chai|vỉ|hộp|nang|bột|ml|gam|tuýp)\b.*$', re.IGNORECASE)
RE_BATCH_EXP = re.compile(r'\b(?:lô|batch|lot|hsd|exp|hạn dùng)[:\s#]*[A-Z0-9\-\/.]+', re.IGNORECASE)
RE_FINANCIAL = re.compile(r'\b(?:đvt|đơn vị|đơn giá|thành tiền|vat|thuế)\b.*$', re.IGNORECASE)
RE_PARENS = re.compile(r'\(([^)]+)\)')
RE_PARENS_SUB = re.compile(r'\([^)]+\)')
RE_DOSAGE_TAIL = re.compile(r'\b(?:ngày|uống|tiêm|truyền|sáng|trưa|chiều|tối|lần|mỗi|sau|trước|viên)\b.*$', re.IGNORECASE)
RE_TOKENS = re.compile(r'[a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+')
RE_NUMERIC_TOKEN = re.compile(r'^\d+$')
RE_DOSAGE_TOKEN = re.compile(r'^\d+(?:[.,]\d+)?(mg|g|mcg|ml|%|iu|ui)$', re.IGNORECASE)

class DrugEntityResolver:
    """
    Hệ thống Hybrid Entity Resolution cho thuốc BHYT & Dược Quốc Gia:
    - Tra cứu 54.885 thuốc từ CSDL Dược Quốc Gia (dav_national_drugs & FTS5)
    - Ánh xạ tự động về 110 danh mục hoạt chất Thông tư 20/2022/TT-BYT
    - Xử lý gõ sai chính tả (fuzzy SequenceMatcher), trích xuất hàm lượng, dạng bào chế
    - Trả về độ tin cậy Confidence Score [0.0, 1.0] và danh sách gợi ý HITL
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or resolve_db_path()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.execute("PRAGMA case_sensitive_like = 1;")
        self._conn.execute("PRAGMA cache_size = -1000;")
        self._conn.execute("PRAGMA mmap_size = 0;")
        self._conn.row_factory = sqlite3.Row
        self._bhyt_cache: List[Dict[str, Any]] = []
        self._load_bhyt_cache()

    def _get_connection(self) -> sqlite3.Connection:
        return self._conn

    def _load_bhyt_cache(self):
        try:
            cur = self._conn.cursor()
            cur.execute("SELECT * FROM bhyt_drug_catalog")
            rows = cur.fetchall()

            self._bhyt_cache = []
            for r in rows:
                item = dict(r)
                item["brand_names_list"] = json.loads(r["brand_names_json"]) if r["brand_names_json"] else []
                item["allowed_ranks_list"] = json.loads(r["allowed_ranks_json"]) if r["allowed_ranks_json"] else []
                item["allowed_icd10_list"] = json.loads(r["allowed_icd10_json"]) if r["allowed_icd10_json"] else []
                item["forbidden_icd10_list"] = json.loads(r["forbidden_icd10_json"]) if r["forbidden_icd10_json"] else []
                self._bhyt_cache.append(item)
        except Exception as e:
            self._bhyt_cache = []

    def extract_features(self, raw_text: str) -> Dict[str, Any]:
        """
        Trích xuất đặc trưng từ chuỗi thô của đơn thuốc:
        - Tách hàm lượng (concentration: 40mg, 500mg, 1g, 20mg/ml...)
        - Loại bỏ số thứ tự đầu dòng (1., 2), [3]...)
        - Loại bỏ thông tin số lượng (x 30 viên, SL: 20 gói...)
        - Tách cụm từ trong ngoặc đơn (hoạt chất bổ trợ: (Esomeprazole))
        - Lọc bỏ các từ dừng / chỉ dẫn liều dùng (uống sáng, ngày 2 lần...)
        """
        clean = raw_text.strip()

        # 1. Trích xuất hàm lượng
        conc_match = RE_CONC.search(clean)
        conc = conc_match.group(1).lower().replace(' ', '').replace(',', '.') if conc_match else None

        # 2. Loại bỏ STT đầu dòng
        clean = RE_STT.sub('', clean)

        # 3. Loại bỏ số lượng & đơn vị tính, số lô, hạn dùng
        clean = RE_QTY.sub('', clean)
        clean = RE_BATCH_EXP.sub('', clean)
        clean = RE_FINANCIAL.sub('', clean)

        # 4. Trích xuất ngoặc đơn
        paren_terms = RE_PARENS.findall(clean)
        clean_no_parens = RE_PARENS_SUB.sub('', clean).strip()

        # 5. Loại bỏ chỉ dẫn liều dùng phổ biến ở đuôi
        clean_no_parens = RE_DOSAGE_TAIL.sub('', clean_no_parens).strip()

        # 6. Tách từ khóa tên thuốc
        tokens = RE_TOKENS.findall(clean_no_parens)
        # Bỏ các token thuần số hoặc hàm lượng hoặc từ phụ
        filtered_keywords = [
            t for t in tokens
            if len(t) >= 2
            and not RE_NUMERIC_TOKEN.match(t)
            and not RE_DOSAGE_TOKEN.match(t)
            and t.lower() not in ['mg', 'ml', 'mcg', 'sl', 'vien', 'uong', 'thuoc', 'stt']
        ]

        cleaned_name = ' '.join(filtered_keywords)
        return {
            "cleaned_name": cleaned_name,
            "detected_concentration": conc,
            "keywords": filtered_keywords,
            "parenthesis_terms": paren_terms
        }

    def _match_bhyt_catalog_fuzzy(self, token: str) -> List[Tuple[float, Dict[str, Any]]]:
        """Khớp mờ bộ nhớ đệm 110 hoạt chất & biệt dược Thông tư 20 siêu tốc."""
        token_l = token.lower()
        if RE_DOSAGE_TOKEN.match(token_l) or len(token_l) < 3:
            return []

        token_norm = remove_vietnamese_accents(token_l)
        matches = []

        for item in self._bhyt_cache:
            score = 0.0

            # 1. Kiểm tra nhanh trùng khớp chính xác hoặc từ vựng (O(1) / nano-giây)
            exact_match = False
            for b in item.get("brand_names_list", []):
                b_l = b.lower()
                if token_l == b_l:
                    score = 0.98
                    exact_match = True
                    break
                elif len(token_l) >= 4 and token_l in b_l.split():
                    score = max(score, 0.92)

            if not exact_match and len(token_l) >= 4:
                if token_norm in item["active_ingredient_normalized"].split():
                    score = max(score, 0.90)

            # 2. Nếu chưa có điểm cao, chỉ chạy SequenceMatcher khi độ dài tương đồng
            if score < 0.90:
                if abs(len(token_norm) - len(item["active_ingredient_normalized"])) <= 4:
                    ai_ratio = difflib.SequenceMatcher(None, token_norm, item["active_ingredient_normalized"]).ratio()
                    score = max(score, ai_ratio)

                if score < 0.85:
                    for b in item.get("brand_names_list", []):
                        b_l = b.lower()
                        if abs(len(token_l) - len(b_l)) <= 4:
                            b_ratio = difflib.SequenceMatcher(None, token_l, b_l).ratio()
                            if b_ratio > score:
                                score = b_ratio

            if score >= 0.65:
                matches.append((score, item))

        matches.sort(key=lambda x: x[0], reverse=True)
        return matches

    def _search_dav_fts(self, search_terms: List[str], atc_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Truy vấn FTS5 và ATC trên 54.885 thuốc CSDL Dược Quốc Gia."""
        conn = self._get_connection()
        cur = conn.cursor()
        candidates = []
        seen_ids = set()

        # 1. Truy vấn FTS5 theo các từ khóa thương hiệu / hoạt chất trước tiên
        for term in search_terms:
            clean_term = ''.join(c for c in term if c.isalnum())
            if len(clean_term) < 3:
                continue
            try:
                cur.execute("""
                    SELECT d.id, d.national_code, d.brand_name, d.active_ingredient, d.concentration, d.dosage_form, d.route, d.atc_code
                    FROM dav_national_drugs d
                    WHERE d.rowid IN (
                        SELECT rowid FROM dav_national_drugs_fts WHERE dav_national_drugs_fts MATCH ? LIMIT 20
                    )
                """, (f"{clean_term}*",))
                for r in cur.fetchall():
                    if r["id"] not in seen_ids:
                        seen_ids.add(r["id"])
                        candidates.append(dict(r))
            except Exception:
                pass

        # 2. Nếu có mã ATC từ BHYT catalog, bổ sung thêm các thuốc cùng nhóm
        if atc_filter:
            cur.execute("""
                SELECT id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, atc_code
                FROM dav_national_drugs
                WHERE atc_code = ? OR atc_code LIKE ?
                LIMIT 25
            """, (atc_filter, f"{atc_filter}%"))
            for r in cur.fetchall():
                if r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    candidates.append(dict(r))

        # 3. Fallback: Nếu không tìm thấy, thử prefix 4 ký tự đầu
        if not candidates and search_terms:
            first_term = ''.join(c for c in search_terms[0] if c.isalnum())
            if len(first_term) >= 4:
                prefix = first_term[:4]
                try:
                    cur.execute("""
                        SELECT d.id, d.national_code, d.brand_name, d.active_ingredient, d.concentration, d.dosage_form, d.route, d.atc_code
                        FROM dav_national_drugs d
                        WHERE d.rowid IN (
                            SELECT rowid FROM dav_national_drugs_fts WHERE dav_national_drugs_fts MATCH ? LIMIT 15
                        )
                    """, (f"{prefix}*",))
                    for r in cur.fetchall():
                        if r["id"] not in seen_ids:
                            seen_ids.add(r["id"])
                            candidates.append(dict(r))
                except Exception:
                    pass

        return candidates

    def resolve_drug(self, raw_query: str) -> DrugResolutionResult:
        """Thực hiện giải quyết thực thể thuốc đầy đủ."""
        if not raw_query or not raw_query.strip():
            return DrugResolutionResult(
                raw_query="",
                cleaned_name="",
                detected_concentration=None,
                confidence_score=0.0,
                match_status="UNRESOLVED",
                match_strategy="NONE",
                matched_dav=None,
                matched_bhyt=None,
                alternatives=[]
            )

        feats = self.extract_features(raw_query)
        cleaned_name = feats["cleaned_name"]
        conc = feats["detected_concentration"]
        keywords = feats["keywords"]
        paren_terms = feats["parenthesis_terms"]

        # Bước 1: Khớp BHYT catalog (in-memory)
        bhyt_matches = []
        for kw in keywords + paren_terms:
            if len(kw) >= 3:
                bhyt_matches.extend(self._match_bhyt_catalog_fuzzy(kw))
        # Thử khử lặp chữ (ví dụ nexxium -> nexium)
        if keywords:
            dedup_kw = re.sub(r'(.)\1+', r'\1', keywords[0])
            if dedup_kw != keywords[0]:
                bhyt_matches.extend(self._match_bhyt_catalog_fuzzy(dedup_kw))

        best_bhyt_rule: Optional[Dict[str, Any]] = None
        best_bhyt_score = 0.0
        if bhyt_matches:
            bhyt_matches.sort(key=lambda x: x[0], reverse=True)
            best_bhyt_score, best_bhyt_rule = bhyt_matches[0]

        atc_filter = best_bhyt_rule["atc_code"] if (best_bhyt_rule and best_bhyt_score >= 0.70) else None

        # Bước 2: Truy vấn CSDL Dược Quốc Gia
        search_terms = list(keywords[:2]) + list(paren_terms[:1])
        if keywords:
            dedup_kw = re.sub(r'(.)\1+', r'\1', keywords[0])
            if dedup_kw not in search_terms:
                search_terms.append(dedup_kw)

        dav_candidates = self._search_dav_fts(search_terms, atc_filter=atc_filter)

        # Bước 3: Đánh giá điểm tin cậy cho từng ứng viên DAV
        scored_candidates: List[Tuple[float, Dict[str, Any]]] = []
        target_norm = cleaned_name.lower()
        target_no_accent = remove_vietnamese_accents(target_norm)

        for cand in dav_candidates:
            b_name = cand["brand_name"].lower()
            b_norm = remove_vietnamese_accents(b_name)
            a_name = cand["active_ingredient"].lower()
            a_norm = remove_vietnamese_accents(a_name)

            # Độ tương đồng tên siêu tốc
            if target_norm == b_name or target_no_accent == b_norm:
                base_sim = 1.0
            elif target_norm == a_name or target_no_accent == a_norm:
                base_sim = 0.95
            else:
                sim_b = difflib.SequenceMatcher(None, target_no_accent, b_norm).ratio() if abs(len(target_no_accent) - len(b_norm)) <= 10 else 0.0
                sim_a = difflib.SequenceMatcher(None, target_no_accent, a_norm).ratio() if abs(len(target_no_accent) - len(a_norm)) <= 10 else 0.0
                base_sim = max(sim_b, sim_a)

            # Thưởng thương hiệu chính xác: Nếu từ đầu tiên của tên biệt dược trùng khớp với từ khóa
            brand_first_word = b_norm.split()[0] if b_norm.split() else ""
            brand_exact_bonus = 0.0
            if brand_first_word and brand_first_word in [remove_vietnamese_accents(k.lower()) for k in keywords]:
                base_sim = max(base_sim, 0.95)
                brand_exact_bonus = 0.95

            # Thưởng nếu chứa trọn vẹn từ khóa chính
            contain_bonus = 0.0
            for kw in keywords:
                kw_l = kw.lower()
                kw_norm = remove_vietnamese_accents(kw_l)
                if kw_l == b_name or kw_norm == b_norm:
                    contain_bonus = max(contain_bonus, 0.98)
                    brand_exact_bonus = max(brand_exact_bonus, 0.98)
                elif kw_l in b_name or kw_norm in b_norm:
                    contain_bonus = max(contain_bonus, 0.88)
                    brand_exact_bonus = max(brand_exact_bonus, 0.88)
                elif kw_l in a_name or kw_norm in a_norm:
                    contain_bonus = max(contain_bonus, 0.82)

            for p in paren_terms:
                p_l = p.lower()
                p_norm = remove_vietnamese_accents(p_l)
                if p_l in a_name or p_norm in a_norm:
                    contain_bonus = max(contain_bonus, 0.92)

            eff_sim = max(base_sim, contain_bonus)

            # Thưởng nếu khớp nồng độ/hàm lượng
            conc_bonus = 0.0
            if conc and cand.get("concentration"):
                c_cand_norm = cand["concentration"].lower().replace(' ', '').replace(',', '.')
                if conc in c_cand_norm:
                    conc_bonus = 0.12
                elif conc in b_name or conc in a_name:
                    conc_bonus = 0.10

            # Thưởng nếu khớp nhóm ATC đã xác định từ BHYT
            atc_bonus = 0.0
            if atc_filter and cand.get("atc_code") and cand["atc_code"].startswith(atc_filter[:5]):
                atc_bonus = 0.08

            final_score = min(1.0, eff_sim + conc_bonus + atc_bonus)
            scored_candidates.append((final_score, brand_exact_bonus, base_sim, conc_bonus, cand))

        scored_candidates.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)

        # Bước 4: Tạo cấu trúc kết quả
        matched_dav: Optional[DavDrugCandidate] = None
        alternatives: List[DavDrugCandidate] = []
        conf_score = 0.0
        strategy = "NONE"

        if scored_candidates:
            top_tuple = scored_candidates[0]
            top_score = top_tuple[0]
            top_cand = top_tuple[4]
            conf_score = round(top_score, 3)
            matched_dav = DavDrugCandidate(
                id=top_cand["id"],
                national_code=top_cand["national_code"] or "",
                brand_name=top_cand["brand_name"] or "",
                active_ingredient=top_cand["active_ingredient"] or "",
                concentration=top_cand["concentration"] or "",
                dosage_form=top_cand["dosage_form"] or "",
                route=top_cand["route"] or "Uống",
                atc_code=top_cand["atc_code"] or ""
            )
            strategy = "HYBRID_DAV_FTS"

            # Top gợi ý khác (loại bỏ trùng tên thương mại)
            seen_alt_names = {matched_dav.brand_name.lower()}
            for item in scored_candidates[1:]:
                c = item[4]
                bn = (c["brand_name"] or "").lower()
                if bn not in seen_alt_names:
                    seen_alt_names.add(bn)
                    alternatives.append(DavDrugCandidate(
                        id=c["id"],
                        national_code=c["national_code"] or "",
                        brand_name=c["brand_name"] or "",
                        active_ingredient=c["active_ingredient"] or "",
                        concentration=c["concentration"] or "",
                        dosage_form=c["dosage_form"] or "",
                        route=c["route"] or "Uống",
                        atc_code=c["atc_code"] or ""
                    ))
                    if len(alternatives) >= 3:
                        break

        # Nếu không có ứng viên DAV nhưng có match từ BHYT catalog
        matched_bhyt_summary: Optional[BhytDrugRuleSummary] = None
        if best_bhyt_rule:
            matched_bhyt_summary = BhytDrugRuleSummary(
                stt_thong_tu_20=best_bhyt_rule.get("stt_thong_tu_20"),
                atc_code=best_bhyt_rule.get("atc_code", ""),
                active_ingredient=best_bhyt_rule.get("active_ingredient", ""),
                payment_ratio=float(best_bhyt_rule.get("payment_ratio", 1.0)),
                allowed_ranks=best_bhyt_rule.get("allowed_ranks_list", []),
                requires_consultation=bool(best_bhyt_rule.get("requires_consultation", False)),
                max_outpatient_days=int(best_bhyt_rule.get("max_outpatient_days", 30)),
                special_conditions=best_bhyt_rule.get("special_conditions"),
                allowed_icd10=best_bhyt_rule.get("allowed_icd10_list", []),
                forbidden_icd10=best_bhyt_rule.get("forbidden_icd10_list", [])
            )
            if not matched_dav and best_bhyt_score >= 0.70:
                conf_score = round(best_bhyt_score, 3)
                strategy = "FUZZY_BHYT_CATALOG"
        elif matched_dav and matched_dav.atc_code:
            # Tra ngược BHYT catalog từ ATC của DAV
            for b in self._bhyt_cache:
                if b["atc_code"] == matched_dav.atc_code or matched_dav.atc_code.startswith(b["atc_code"]):
                    matched_bhyt_summary = BhytDrugRuleSummary(
                        stt_thong_tu_20=b.get("stt_thong_tu_20"),
                        atc_code=b.get("atc_code", ""),
                        active_ingredient=b.get("active_ingredient", ""),
                        payment_ratio=float(b.get("payment_ratio", 1.0)),
                        allowed_ranks=b.get("allowed_ranks_list", []),
                        requires_consultation=bool(b.get("requires_consultation", False)),
                        max_outpatient_days=int(b.get("max_outpatient_days", 30)),
                        special_conditions=b.get("special_conditions"),
                        allowed_icd10=b.get("allowed_icd10_list", []),
                        forbidden_icd10=b.get("forbidden_icd10_list", [])
                    )
                    break

        # Phân loại trạng thái tin cậy
        if conf_score >= 0.85:
            status = "HIGH"
        elif conf_score >= 0.60:
            status = "MEDIUM"
        elif conf_score >= 0.35:
            status = "LOW"
        else:
            status = "UNRESOLVED"

        return DrugResolutionResult(
            raw_query=raw_query,
            cleaned_name=cleaned_name,
            detected_concentration=conc,
            confidence_score=conf_score,
            match_status=status,
            match_strategy=strategy,
            matched_dav=matched_dav,
            matched_bhyt=matched_bhyt_summary,
            alternatives=alternatives
        )

    def batch_resolve_drugs(self, raw_drugs: List[str]) -> DrugBatchResolutionResponse:
        """Xử lý phân giải hàng loạt danh sách thuốc (cho đơn thuốc OCR/HITL)."""
        results = [self.resolve_drug(raw) for raw in raw_drugs]
        resolved = sum(1 for r in results if r.match_status in ["HIGH", "MEDIUM"])
        return DrugBatchResolutionResponse(
            total=len(raw_drugs),
            resolved_count=resolved,
            results=results
        )
