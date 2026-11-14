import json
import sqlite3
import unicodedata
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from app.seed_bhyt_catalog import resolve_db_path, remove_vietnamese_accents
from app.schemas.bhyt import (
    BhytPrescriptionPayload,
    BhytAuditReportSchema,
    BhytViolationItemSchema,
    BhytLegalRefSchema,
    BhytDrugRuleResponse,
    BhytCatalogQueryResponse
)

def is_icd10_matching(candidate_code: str, rule_prefix: str) -> bool:
    """So khớp ICD-10 chuẩn hóa không phân biệt dấu chấm."""
    if not candidate_code or not rule_prefix:
        return False
    c_norm = candidate_code.strip().upper()
    p_norm = rule_prefix.strip().upper()
    if c_norm.startswith(p_norm):
        return True
    c_no_dot = c_norm.replace(".", "")
    p_no_dot = p_norm.replace(".", "")
    if c_no_dot.startswith(p_no_dot):
        return True
    c_base = c_norm.split(".")[0]
    p_base = p_norm.split(".")[0]
    if c_base == p_base or c_base.startswith(p_base):
        return True
    return False

class BhytAuditService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or resolve_db_path()
        self._therapeutic_classes: Optional[List[sqlite3.Row]] = None
        self._incompatible_classes: Optional[List[sqlite3.Row]] = None
        self._catalog_cache: Optional[List[sqlite3.Row]] = None

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute("PRAGMA cache_size = -1000;")
        conn.row_factory = sqlite3.Row
        return conn

    def get_declarative_therapeutic_classes(self) -> List[sqlite3.Row]:
        if self._therapeutic_classes is None:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM bhyt_therapeutic_classes")
                self._therapeutic_classes = cursor.fetchall()
            finally:
                conn.close()
        return self._therapeutic_classes

    def get_declarative_incompatible_classes(self) -> List[sqlite3.Row]:
        if self._incompatible_classes is None:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM bhyt_incompatible_classes")
                self._incompatible_classes = cursor.fetchall()
            finally:
                conn.close()
        return self._incompatible_classes

    def _get_catalog_rules(self) -> List[sqlite3.Row]:
        if self._catalog_cache is None:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM bhyt_drug_catalog")
                self._catalog_cache = cursor.fetchall()
            finally:
                conn.close()
        return self._catalog_cache

    def search_catalog(
        self,
        query: str = "",
        rank: str = "ALL",
        limit: int = 100,
        offset: int = 0
    ) -> BhytCatalogQueryResponse:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            sql = "SELECT * FROM bhyt_drug_catalog WHERE 1=1"
            params: list = []

            if query.strip():
                norm_q = f"%{remove_vietnamese_accents(query)}%"
                sql += " AND (active_ingredient_normalized LIKE ? OR atc_code LIKE ? OR brand_names_json LIKE ?)"
                params.extend([norm_q, f"%{query.upper()}%", f"%{query}%"])

            cursor.execute(sql, params)
            all_rows = cursor.fetchall()

            # Lọc rank trong Python vì lưu dưới dạng JSON
            filtered_rows = []
            for r in all_rows:
                ranks = json.loads(r["allowed_ranks_json"]) if r["allowed_ranks_json"] else []
                if rank != "ALL" and rank not in ranks:
                    continue
                filtered_rows.append(r)

            total = len(filtered_rows)
            paged_rows = filtered_rows[offset : offset + limit]

            items = []
            for r in paged_rows:
                items.append(BhytDrugRuleResponse(
                    id=r["id"],
                    stt_thong_tu_20=r["stt_thong_tu_20"],
                    atc_code=r["atc_code"],
                    active_ingredient=r["active_ingredient"],
                    brand_names=json.loads(r["brand_names_json"]) if r["brand_names_json"] else [],
                    route=r["route"] or "Uống",
                    allowed_ranks=json.loads(r["allowed_ranks_json"]) if r["allowed_ranks_json"] else [],
                    payment_ratio=r["payment_ratio"] or 1.0,
                    requires_consultation=bool(r["requires_consultation"]),
                    max_outpatient_days=r["max_outpatient_days"] or 30,
                    approved_icd10_prefixes=json.loads(r["allowed_icd10_json"]) if r["allowed_icd10_json"] else None,
                    forbidden_icd10_prefixes=json.loads(r["forbidden_icd10_json"]) if r["forbidden_icd10_json"] else None,
                    special_conditions=r["special_conditions"],
                    pdf_page=r["pdf_page"] or 1
                ))
            return BhytCatalogQueryResponse(total=total, items=items)
        finally:
            conn.close()

    def find_rule_for_drug(self, drug_name: str, active_ingredient: str) -> Optional[sqlite3.Row]:
        all_rules = self._get_catalog_rules()

        # 1. Tìm theo tên hoạt chất chính xác
        if active_ingredient:
            norm_ing = remove_vietnamese_accents(active_ingredient)
            for r in all_rules:
                if r["active_ingredient_normalized"] == norm_ing:
                    return r

        # 2. Tìm theo từ khóa trong hoạt chất hoặc biệt dược
        target = f"{drug_name} {active_ingredient}".strip()
        norm_target = remove_vietnamese_accents(target)

        for r in all_rules:
            ing_norm = r["active_ingredient_normalized"]
            if ing_norm and ing_norm in norm_target:
                return r

            # Check brand names
            brands = json.loads(r["brand_names_json"]) if r["brand_names_json"] else []
            for b in brands:
                if remove_vietnamese_accents(b) in norm_target:
                    return r

        return None

    def audit_prescription(self, payload: BhytPrescriptionPayload) -> BhytAuditReportSchema:
        violations: List[BhytViolationItemSchema] = []
        at_risk_cost = 0.0
        total_cost = 0.0
        pass_count = 0
        warning_count = 0
        reject_count = 0
        missing_fields: List[str] = []
        if not payload.primary_icd10:
            missing_fields.append("primary_icd10")
        if not payload.primary_diagnosis:
            missing_fields.append("primary_diagnosis")
        if not payload.hospital_rank:
            missing_fields.append("hospital_rank")
        if not payload.treatment_type:
            missing_fields.append("treatment_type")

        # Tra cứu quy tắc cho từng thuốc
        matched_rules: Dict[str, Optional[sqlite3.Row]] = {}
        for item in payload.items:
            item_cost = item.quantity * item.unit_price
            total_cost += item_cost
            rule = self.find_rule_for_drug(item.drug_name, item.active_ingredient or "")
            matched_rules[item.id] = rule

        # Kiểm tra 1: Vượt tuyến KCB (HOSPITAL_RANK_MISMATCH)
        for item in payload.items:
            rule = matched_rules.get(item.id)
            if rule:
                ranks = json.loads(rule["allowed_ranks_json"]) if rule["allowed_ranks_json"] else []
                if payload.hospital_rank not in ranks:
                    rejection_vnd = item.quantity * item.unit_price
                    at_risk_cost += rejection_vnd
                    reject_count += 1
                    violations.append(BhytViolationItemSchema(
                        id=f"VIO-RANK-{item.id}",
                        drug_code=item.drug_code or rule["atc_code"],
                        drug_name=item.drug_name,
                        active_ingredient=rule["active_ingredient"],
                        severity="REJECT",
                        category="HOSPITAL_RANK_MISMATCH",
                        title="Vượt tuyến / Hạng BV không được dùng",
                        detail=f"Thuốc chỉ được thanh toán tại: {', '.join(ranks)}. Tuyến hiện tại ({payload.hospital_rank}) không được thanh toán.",
                        legal_ref=BhytLegalRefSchema(
                            doc_code="20/2022/TT-BYT",
                            doc_title="Thông tư 20/2022/TT-BYT Danh mục Thuốc BHYT",
                            section="Phụ lục I (Phân tuyến kỹ thuật)",
                            page_number=rule["pdf_page"] or 1,
                            local_pdf_path="/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf"
                        ),
                        rejection_risk_vnd=rejection_vnd,
                        action="Chuyển tuyến bệnh nhân hoặc thay thế bằng hoạt chất được phân hạng cho tuyến cơ sở."
                    ))

        # Kiểm tra 2: Trùng lặp hoạt chất / Nhóm tác dụng điều trị (ĐỘNG CƠ LUẬT KHAI BÁO CSDL - ZERO HARDCODE)
        therapeutic_classes = self.get_declarative_therapeutic_classes()
        incompatible_classes = self.get_declarative_incompatible_classes()

        # 2a. Phân nhóm theo bhyt_therapeutic_classes từ CSDL
        atc_groups: Dict[str, Tuple[str, str, str, str, int, List[Any]]] = {}
        for item in payload.items:
            rule = matched_rules.get(item.id)
            if rule and rule["atc_code"]:
                item_atc = rule["atc_code"].strip().upper()
                for tc in therapeutic_classes:
                    prefixes = json.loads(tc["atc_prefixes_json"]) if tc["atc_prefixes_json"] else []
                    if any(item_atc.startswith(p.strip().upper()) for p in prefixes):
                        grp_id = tc["id"]
                        if grp_id not in atc_groups:
                            atc_groups[grp_id] = (
                                tc["class_name"],
                                tc["rejection_title"],
                                tc["rejection_rationale"],
                                tc["legal_doc_code"],
                                tc["legal_page"] or 22,
                                []
                            )
                        atc_groups[grp_id][5].append((item, rule))

        for grp_id, (class_name, rej_title, rationale, doc_code, page_no, group_items) in atc_groups.items():
            if len(group_items) >= 2:
                for duplicate_item, duplicate_rule in group_items[1:]:
                    rejection_vnd = duplicate_item.quantity * duplicate_item.unit_price
                    at_risk_cost += rejection_vnd
                    reject_count += 1
                    violations.append(BhytViolationItemSchema(
                        id=f"VIO-DUP-{duplicate_item.id}",
                        drug_code=duplicate_item.drug_code or duplicate_rule["atc_code"],
                        drug_name=duplicate_item.drug_name,
                        active_ingredient=duplicate_rule["active_ingredient"],
                        severity="REJECT",
                        category="THERAPEUTIC_DUPLICATION",
                        title=rej_title,
                        detail=f"Đơn đã có '{group_items[0][0].drug_name}'. {rationale}",
                        legal_ref=BhytLegalRefSchema(
                            doc_code=doc_code,
                            doc_title="Quy trình Giám định BHYT",
                            section="Mục 3.2.b (Kiểm tra trùng lặp chỉ định)",
                            page_number=page_no,
                            local_pdf_path="/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf"
                        ),
                        rejection_risk_vnd=rejection_vnd,
                        action=f"Lược bỏ '{duplicate_item.drug_name}', chỉ giữ lại một loại thuốc đại diện cho nhóm."
                    ))

        # 2b. Kiểm tra các cặp thuốc chống chỉ định phối hợp từ bhyt_incompatible_classes
        for incomp in incompatible_classes:
            prefix_a = incomp["atc_prefix_a"].strip().upper()
            prefix_b = incomp["atc_prefix_b"].strip().upper()
            items_a = []
            items_b = []
            for item in payload.items:
                rule = matched_rules.get(item.id)
                if rule and rule["atc_code"]:
                    c = rule["atc_code"].strip().upper()
                    if c.startswith(prefix_a):
                        items_a.append((item, rule))
                    elif c.startswith(prefix_b):
                        items_b.append((item, rule))
            if items_a and items_b:
                for duplicate_item, duplicate_rule in items_b:
                    rejection_vnd = duplicate_item.quantity * duplicate_item.unit_price
                    at_risk_cost += rejection_vnd
                    reject_count += 1
                    violations.append(BhytViolationItemSchema(
                        id=f"VIO-INCOMP-{duplicate_item.id}",
                        drug_code=duplicate_item.drug_code or duplicate_rule["atc_code"],
                        drug_name=duplicate_item.drug_name,
                        active_ingredient=duplicate_rule["active_ingredient"],
                        severity="REJECT",
                        category="THERAPEUTIC_DUPLICATION",
                        title=incomp["rejection_title"],
                        detail=f"Đơn phối hợp '{items_a[0][0].drug_name}' ({incomp['class_code_a']}) với '{duplicate_item.drug_name}' ({incomp['class_code_b']}). {incomp['rejection_rationale']}",
                        legal_ref=BhytLegalRefSchema(
                            doc_code=incomp["legal_doc_code"],
                            doc_title="Quy trình Giám định BHYT",
                            section=incomp["legal_section"],
                            page_number=incomp["legal_page"] or 22,
                            local_pdf_path="/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf"
                        ),
                        rejection_risk_vnd=rejection_vnd,
                        action=f"Ngưng phối hợp '{duplicate_item.drug_name}', chuyển sang đơn trị liệu hoặc nhóm hạ áp phù hợp theo phác đồ."
                    ))

        # Kiểm tra 3: Kháng sinh dự trữ thiếu Biên bản Hội chẩn (MISSING_CONSULTATION_FORM)
        for item in payload.items:
            rule = matched_rules.get(item.id)
            if rule and rule["requires_consultation"] and not item.has_consultation_form:
                rejection_vnd = item.quantity * item.unit_price
                at_risk_cost += rejection_vnd
                reject_count += 1
                violations.append(BhytViolationItemSchema(
                    id=f"VIO-CONSULT-{item.id}",
                    drug_code=item.drug_code or rule["atc_code"],
                    drug_name=item.drug_name,
                    active_ingredient=rule["active_ingredient"],
                    severity="REJECT",
                    category="MISSING_CONSULTATION_FORM",
                    title="Thiếu biên bản hội chẩn thuốc kiểm soát đặc biệt",
                    detail=f"Hoạt chất '{rule['active_ingredient']}' là kháng sinh dự trữ / thuốc đặc trị yêu cầu phải có Biên bản Hội chẩn đính kèm hồ sơ.",
                    legal_ref=BhytLegalRefSchema(
                        doc_code="20/2022/TT-BYT",
                        doc_title="Thông tư 20/2022/TT-BYT",
                        section="Điều 5 & Hướng dẫn sử dụng kháng sinh BYT",
                        page_number=rule["pdf_page"] or 23,
                        local_pdf_path="/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf"
                    ),
                    rejection_risk_vnd=rejection_vnd,
                    action="Ký duyệt Biên bản Hội chẩn chuyên khoa và lưu trữ kèm bệnh án trước khi xuất viện."
                ))

        # Kiểm tra 4: Tỷ lệ thanh toán BHYT (PARTIAL_PAYMENT_ALERT)
        for item in payload.items:
            rule = matched_rules.get(item.id)
            if rule and rule["payment_ratio"] < 1.0 and rule["payment_ratio"] > 0:
                warning_count += 1
                ratio_pct = int(rule["payment_ratio"] * 100)
                violations.append(BhytViolationItemSchema(
                    id=f"VIO-RATIO-{item.id}",
                    drug_code=item.drug_code or rule["atc_code"],
                    drug_name=item.drug_name,
                    active_ingredient=rule["active_ingredient"],
                    severity="WARNING",
                    category="PARTIAL_PAYMENT_ALERT",
                    title=f"Thuốc thanh toán theo tỷ lệ {ratio_pct}%",
                    detail=f"Thuốc '{rule['active_ingredient']}' chỉ được quỹ BHYT chi trả {ratio_pct}%. Người bệnh phải đồng chi trả {100 - ratio_pct}%.",
                    legal_ref=BhytLegalRefSchema(
                        doc_code="20/2022/TT-BYT",
                        doc_title="Thông tư 20/2022/TT-BYT",
                        section="Cột 7 (Tỷ lệ thanh toán)",
                        page_number=rule["pdf_page"] or 35,
                        local_pdf_path="/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf"
                    ),
                    rejection_risk_vnd=0.0,
                    action=f"Giải thích cho người bệnh biết trước về khoản đồng chi trả {100 - ratio_pct}% theo quy định."
                ))

        # Kiểm tra 5: Quá số ngày kê đơn ngoại trú (OVER_MAX_OUTPATIENT_DAYS)
        if payload.treatment_type == "NGOAI_TRU":
            for item in payload.items:
                if item.days_supply > 30:
                    warning_count += 1
                    violations.append(BhytViolationItemSchema(
                        id=f"VIO-DAYS-{item.id}",
                        drug_code=item.drug_code or "",
                        drug_name=item.drug_name,
                        active_ingredient=item.active_ingredient or item.drug_name,
                        severity="WARNING",
                        category="OVER_MAX_OUTPATIENT_DAYS",
                        title="Vượt quá 30 ngày kê đơn ngoại trú",
                        detail=f"Kê {item.days_supply} ngày điều trị ngoại trú vượt trần tối đa 30 ngày theo quy định kê đơn ngoại trú.",
                        legal_ref=BhytLegalRefSchema(
                            doc_code="52/2017/TT-BYT",
                            doc_title="Thông tư 52/2017/TT-BYT",
                            section="Điều 12 (Kê đơn thuốc ngoại trú)",
                            page_number=5,
                            local_pdf_path="/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf"
                        ),
                        rejection_risk_vnd=0.0,
                        action="Chỉnh sửa số lượng cấp về tối đa 30 ngày và hẹn bệnh nhân tái khám định kỳ."
                    ))

        # Kiểm tra 6: Ràng buộc mã bệnh ICD-10 (ICD10_UNSUPPORTED)
        is_invoice_doc = getattr(payload, "document_type", "DON_THUOC") in ("HOA_DON_VAT", "PHIEU_XUAT_KHO", "HOA_DON_BAN_LE")
        all_icd10s = [payload.primary_icd10] + (payload.secondary_icd10s or [])
        all_icd10s = [c.strip().upper() for c in all_icd10s if c and c.strip()]

        # Nếu là Hóa đơn mua sắm / Bảng kê xuất kho không gắn mã ca bệnh -> Bỏ qua ràng buộc ICD-10 để tránh phạt sai
        if all_icd10s:
            for item in payload.items:
                rule = matched_rules.get(item.id)
                if rule:
                    forbidden = json.loads(rule["forbidden_icd10_json"]) if rule["forbidden_icd10_json"] else []
                    approved = json.loads(rule["allowed_icd10_json"]) if rule["allowed_icd10_json"] else []

                    # Kiểm tra mã bị cấm
                    is_forbidden = any(
                        any(is_icd10_matching(icd, f) for f in forbidden)
                        for icd in all_icd10s
                    ) if forbidden else False

                    # Kiểm tra mã được duyệt
                    is_approved = any(
                        any(is_icd10_matching(icd, a) for a in approved)
                        for icd in all_icd10s
                    ) if approved else True

                    if is_forbidden or not is_approved:
                        rejection_vnd = item.quantity * item.unit_price
                        at_risk_cost += rejection_vnd
                        reject_count += 1
                        violations.append(BhytViolationItemSchema(
                            id=f"VIO-ICD-{item.id}",
                            drug_code=item.drug_code or rule["atc_code"],
                            drug_name=item.drug_name,
                            active_ingredient=rule["active_ingredient"],
                            severity="REJECT",
                            category="ICD10_UNSUPPORTED",
                            title=f"Chỉ định không đúng điều kiện BHYT ({rule['active_ingredient']})",
                            detail=f"BHYT không thanh toán cho chẩn đoán [{', '.join(all_icd10s)}]. Thuốc chỉ được thanh toán theo điều kiện chấn thương, phẫu thuật hoặc nhóm bệnh quy định.",
                            legal_ref=BhytLegalRefSchema(
                                doc_code="3618/QĐ-BHXH",
                                doc_title="Quy trình giám định BHYT",
                                section="Điều 14 (Kiểm tra điều kiện chỉ định thuốc)",
                                page_number=18,
                                local_pdf_path="/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf"
                            ),
                            rejection_risk_vnd=rejection_vnd,
                            action="Chỉ kê khi có chẩn đoán chấn thương hoặc phẫu thuật, nếu kê cho viêm đường hô hấp bệnh nhân phải tự túc."
                        ))

        # Kiểm tra Hạn dùng cận hạn (< 6 tháng) đối với Hóa đơn / Bảng kê nhập xuất dược phẩm
        if is_invoice_doc:
            for item in payload.items:
                exp = getattr(item, "expiry_date", None)
                if exp and len(exp.strip()) >= 7:
                    try:
                        clean_exp = exp.strip()
                        if "/" in clean_exp:
                            parts = clean_exp.split("/")
                            if len(parts) == 3:
                                exp_dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                            elif len(parts) == 2:
                                exp_dt = datetime(int(parts[1]), int(parts[0]), 28)
                        else:
                            exp_dt = datetime.fromisoformat(clean_exp)
                        days_diff = (exp_dt - datetime.now()).days
                        if 0 <= days_diff < 180:
                            warning_count += 1
                            violations.append(BhytViolationItemSchema(
                                id=f"VIO-EXPIRY-{item.id}",
                                drug_code=item.drug_code or "",
                                drug_name=item.drug_name,
                                active_ingredient=item.active_ingredient or item.drug_name,
                                severity="WARNING",
                                category="PARTIAL_PAYMENT_ALERT",
                                title="Thuốc cận hạn dùng (< 6 tháng)",
                                detail=f"Mặt hàng có hạn dùng ({exp}) còn {days_diff} ngày, cần ưu tiên xuất kho FEFO và giám sát chặt chẽ theo Thông tư 36/2018/TT-BYT GSP.",
                                legal_ref=BhytLegalRefSchema(
                                    doc_code="36/2018/TT-BYT",
                                    doc_title="Thực hành tốt bảo quản thuốc GSP",
                                    section="Mục 12 Phụ lục I (Nguyên tắc FEFO)",
                                    page_number=14,
                                    local_pdf_path="/pdf/Thong_Tu_36_2018_TT_BYT_GSP.pdf"
                                ),
                                rejection_risk_vnd=0.0,
                                action="Gắn nhãn cận hạn, bố trí khu vực bảo quản riêng biệt và luân chuyển cấp phát trước theo nguyên tắc FEFO."
                            ))
                    except Exception:
                        pass

        # Thuốc không vi phạm nào
        violated_item_ids = {v.id.split('-')[-1] for v in violations if v.severity == 'REJECT'}
        pass_count = len(payload.items) - len(violated_item_ids)

        if missing_fields:
            violations.append(BhytViolationItemSchema(
                id="VIO-MISSING-DATA", drug_code="", drug_name="Toàn bộ đơn thuốc", active_ingredient="",
                severity="WARNING", category="MISSING_DATA", title="Chưa đủ dữ liệu để kết luận",
                detail=f"Thiếu trường: {', '.join(missing_fields)}. Không kết luận vi phạm từ trường đang thiếu.",
                legal_ref=BhytLegalRefSchema(doc_code="", doc_title="", section="", page_number=0, local_pdf_path=""),
                rejection_risk_vnd=0.0, action="Bổ sung thông tin gốc rồi thực hiện giám định lại."
            ))
        status = "REJECT" if reject_count > 0 else ("WARNING" if warning_count > 0 else ("NEEDS_REVIEW" if missing_fields else "PASS"))

        # Lưu log vào SQLite
        self.save_audit_log(payload, status, total_cost, at_risk_cost, violations)

        return BhytAuditReportSchema(
            status=status,
            evaluated_at=datetime.now().isoformat(),
            hospital_rank=payload.hospital_rank,
            treatment_type=payload.treatment_type,
            primary_icd10=payload.primary_icd10,
            primary_diagnosis=payload.primary_diagnosis,
            total_cost_vnd=total_cost,
            at_risk_cost_vnd=at_risk_cost,
            items_count=len(payload.items),
            pass_count=max(0, pass_count),
            warning_count=warning_count,
            reject_count=reject_count,
            violations=violations
            ,missing_fields=missing_fields
        )

    def save_audit_log(
        self,
        payload: BhytPrescriptionPayload,
        status: str,
        total_cost: float,
        at_risk_cost: float,
        violations: List[BhytViolationItemSchema]
    ) -> None:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            now = datetime.now()
            log_id = f"LOG-{now.strftime('%Y%m%d%H%M%S')}-{payload.prescription_id or 'RX'}"
            violations_data = json.dumps([v.model_dump() for v in violations], ensure_ascii=False)
            now_str = now.strftime('%Y-%m-%d %H:%M:%S')

            cursor.execute("""
            INSERT INTO bhyt_audit_logs (
                id, prescription_id, patient_name, insurance_card_number,
                hospital_rank, treatment_type, primary_icd10, status,
                total_cost_vnd, at_risk_cost_vnd, violations_count, violations_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, payload.prescription_id or "RX", payload.patient_name,
                payload.insurance_card_number, payload.hospital_rank,
                payload.treatment_type, payload.primary_icd10, status,
                total_cost, at_risk_cost, len(violations), violations_data, now_str
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Warning: Failed to save audit log: {e}")

    def save_audit_error_log(
        self,
        payload: BhytPrescriptionPayload,
        error_detail: str
    ) -> None:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            now = datetime.now()
            log_id = f"ERR-{now.strftime('%Y%m%d%H%M%S')}-{payload.prescription_id or 'RX'}"
            now_str = now.strftime('%Y-%m-%d %H:%M:%S')
            error_violation = [{
                "id": f"ERR-{payload.prescription_id or 'RX'}",
                "severity": "ERROR",
                "category": "SYSTEM_AUDIT_EXCEPTION",
                "title": "Lỗi hệ thống khi giám định BHYT",
                "detail": error_detail,
                "rejection_risk_vnd": 0.0,
                "action": "Kiểm tra log hệ thống hoặc thử lại với dữ liệu chuẩn."
            }]
            cursor.execute("""
            INSERT INTO bhyt_audit_logs (
                id, prescription_id, patient_name, insurance_card_number,
                hospital_rank, treatment_type, primary_icd10, status,
                total_cost_vnd, at_risk_cost_vnd, violations_count, violations_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, payload.prescription_id or "RX", payload.patient_name,
                payload.insurance_card_number, payload.hospital_rank,
                payload.treatment_type, payload.primary_icd10, "ERROR",
                0.0, 0.0, 1, json.dumps(error_violation, ensure_ascii=False), now_str
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Warning: Failed to save audit error log: {e}")

    def record_custom_log(
        self,
        prescription_id: str,
        patient_name: str,
        insurance_card_number: str,
        hospital_rank: str,
        treatment_type: str,
        primary_icd10: str,
        status: str,
        total_cost: float,
        at_risk_cost: float,
        violations_count: int,
        violations_json: str
    ) -> str:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            now = datetime.now()
            log_id = f"LOG-{now.strftime('%Y%m%d%H%M%S')}-{prescription_id or 'RX'}"
            now_str = now.strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("""
            INSERT INTO bhyt_audit_logs (
                id, prescription_id, patient_name, insurance_card_number,
                hospital_rank, treatment_type, primary_icd10, status,
                total_cost_vnd, at_risk_cost_vnd, violations_count, violations_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, prescription_id or "RX", patient_name,
                insurance_card_number, hospital_rank,
                treatment_type, primary_icd10, status,
                total_cost, at_risk_cost, violations_count, violations_json, now_str
            ))
            conn.commit()
            conn.close()
            return log_id
        except Exception as e:
            print(f"Warning: Failed to record custom audit log: {e}")
            return ""
