"""
Multimodal Prescription Vision & Clinical-BHYT Synthesis Engine.
Connects Gemini Vision OCR facts to Clinical DDI Engine (QĐ 5948/QĐ-BYT)
and BHYT Audit Engine (Thông tư 20/2022/TT-BYT), generating actionable interactive reports.
"""
from typing import Any, Dict, List, Optional, Tuple
import re

from app.schemas.copilot import CopilotActionCard, CopilotCdssAlert, ClinicalSummary
from app.services.clinical_ddi_engine import evaluate_prescription
from app.services.bhyt_service import BhytAuditService
from app.schemas.bhyt import BhytPrescriptionPayload, BhytPrescriptionItemPayload


def extract_prescription_items_from_vision(vision_res: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Extract structured prescription metadata and drug items from vision OCR result.
    Employs multi-tier extraction: structured JSON field -> fallback regex parsing.
    """
    meta: Dict[str, Any] = {
        "patient_name": "",
        "patient_age": None,
        "insurance_card_number": "",
        "primary_icd10": "",
        "primary_diagnosis": "",
        "hospital_rank": "HANG_1",
    }
    items: List[Dict[str, Any]] = []

    # Tier 1: Check extracted_prescription object
    raw_rx = vision_res.get("extracted_prescription")
    if isinstance(raw_rx, dict):
        meta["patient_name"] = raw_rx.get("patient_name") or ""
        meta["patient_age"] = raw_rx.get("patient_age")
        meta["insurance_card_number"] = raw_rx.get("insurance_card_number") or ""
        meta["primary_icd10"] = raw_rx.get("primary_icd10") or ""
        meta["primary_diagnosis"] = raw_rx.get("primary_diagnosis") or ""
        meta["hospital_rank"] = raw_rx.get("hospital_rank") or "HANG_1"
        raw_items = raw_rx.get("items")
        if isinstance(raw_items, list):
            for it in raw_items:
                if isinstance(it, dict) and it.get("drug_name"):
                    items.append(it)

    # Tier 2: Check direct items array
    if not items and isinstance(vision_res.get("items"), list):
        for it in vision_res["items"]:
            if isinstance(it, dict) and it.get("drug_name"):
                items.append(it)
        if not meta["primary_icd10"] and vision_res.get("primary_icd10"):
            meta["primary_icd10"] = vision_res["primary_icd10"]
        if not meta["primary_diagnosis"] and vision_res.get("primary_diagnosis"):
            meta["primary_diagnosis"] = vision_res["primary_diagnosis"]

    # Tier 3: Fallback regex parsing on extracted_sections or extracted_text
    if not items:
        lines: List[str] = []
        sections = vision_res.get("extracted_sections")
        if isinstance(sections, list):
            for sec in sections:
                if isinstance(sec, dict):
                    sec_items = sec.get("items", [])
                    if isinstance(sec_items, list):
                        lines.extend(str(x) for x in sec_items)
        if not lines:
            raw_t = str(vision_res.get("extracted_text") or vision_res.get("reply_markdown") or "")
            lines = raw_t.split("\n")

        for line in lines:
            clean_line = line.strip()
            if not clean_line:
                continue

            # Case A: Numbered line with drug name & dosage: "1. Amlodipin 5mg x 30 viên"
            m = re.match(
                r'^\s*(?:\d+[\.\/\)]|-|\*)\s*([a-zA-ZÀ-ỹ0-9\s\-]+?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|%|iu|ui))\b(?:\s+[xX*]\s*(\d+))?',
                clean_line,
                re.IGNORECASE
            )
            if m:
                drug_name_raw, dosage, qty = m.groups()
                clean_name = drug_name_raw.strip()
                if len(clean_name) >= 3 and not any(kw in clean_name.lower() for kw in ["bệnh nhân", "chẩn đoán", "bác sĩ", "ngày khám", "lời dặn", "tái khám"]):
                    items.append({
                        "drug_name": f"{clean_name} {dosage}".strip(),
                        "active_ingredient": clean_name,
                        "dosage": dosage or "",
                        "quantity": float(qty) if qty else 10.0,
                        "unit": "Viên",
                        "route": "Uống",
                        "instructions": clean_line,
                    })
                continue

            # Case B: Numbered line without dosage: "1. Paracetamol x 10 viên"
            m2 = re.match(
                r'^\s*(?:\d+[\.\/\)]|-|\*)\s*([a-zA-ZÀ-ỹ0-9\s\-]{3,30})(?:\s+[xX*]\s*(\d+))?',
                clean_line,
                re.IGNORECASE
            )
            if m2:
                drug_name_raw, qty = m2.groups()
                clean_name = drug_name_raw.strip()
                if len(clean_name) >= 3 and not any(kw in clean_name.lower() for kw in ["bệnh nhân", "chẩn đoán", "bác sĩ", "ngày khám", "lời dặn", "tái khám", "kết quả"]):
                    items.append({
                        "drug_name": clean_name,
                        "active_ingredient": clean_name,
                        "dosage": "",
                        "quantity": float(qty) if qty else 10.0,
                        "unit": "Viên",
                        "route": "Uống",
                        "instructions": clean_line,
                    })

    return meta, items


def analyse_vision_prescription(vision_res: Dict[str, Any], user_role: str = "doctor") -> Dict[str, Any]:
    """
    Synthesize multimodal vision OCR data with Clinical DDI & BHYT engines.
    Returns:
        {
            "reply_text": str,
            "clinical_summary": ClinicalSummary,
            "card": CopilotActionCard,
            "cdss_alert": CopilotCdssAlert,
            "evidence": list,
            "citations": list,
            "rag_grounded": bool,
            "suggested_chips": list,
        }
    """
    meta, items = extract_prescription_items_from_vision(vision_res)

    # If no medication items found or marked non-clinical, fallback to basic image report
    if not items or vision_res.get("is_clinical") is False or vision_res.get("category") == "NON_CLINICAL":
        from app.services.chatbot.image_report_formatter import format_image_extraction_report
        return {
            "reply_text": format_image_extraction_report(vision_res),
            "clinical_summary": None,
            "card": None,
            "cdss_alert": None,
            "evidence": [],
            "citations": [],
            "rag_grounded": False,
            "suggested_chips": ["Tra cứu Dược Thư", "Quy chế đơn thuốc BHYT", "Hướng dẫn sử dụng"],
        }

    # Step 1: Execute Clinical DDI Engine
    raw_drug_names = [it["drug_name"] for it in items]
    ddi_report = evaluate_prescription(raw_drug_names)

    # Step 2: Rà soát danh mục thuốc BHYT (Thông tư 20/2022/TT-BYT)
    # Theo yêu cầu: Chỉ rà soát xem thuốc có trong danh sách được BHYT chi trả không,
    # không tự đoán giá nếu đơn không có giá, các yếu tố phân tuyến/ICD-10 xét sau.
    bhyt_service = BhytAuditService()
    bhyt_catalog_results: List[Dict[str, Any]] = []
    covered_count = 0
    uncovered_count = 0

    for it in items:
        drug_name = it["drug_name"]
        active_ing = it.get("active_ingredient", "")
        rule = bhyt_service.find_rule_for_drug(drug_name, active_ing)
        if rule:
            covered_count += 1
            ratio_pct = int((rule["payment_ratio"] or 1.0) * 100)
            bhyt_catalog_results.append({
                "drug_name": drug_name,
                "in_catalog": True,
                "stt_tt20": rule["stt_thong_tu_20"],
                "active_ingredient": rule["active_ingredient"],
                "payment_ratio": ratio_pct,
                "status_badge": f"Trong danh mục BHYT ({ratio_pct}%)",
                "note": f"STT {rule['stt_thong_tu_20']} - {rule['active_ingredient']}"
            })
        else:
            uncovered_count += 1
            bhyt_catalog_results.append({
                "drug_name": drug_name,
                "in_catalog": False,
                "stt_tt20": None,
                "active_ingredient": active_ing,
                "payment_ratio": 0,
                "status_badge": "Ngoài danh mục BHYT",
                "note": "Không thuộc danh mục Thông tư 20/2022/TT-BYT (tự chi trả)"
            })

    # Step 3: Format Clean Markdown Report (Không dùng icon/emoji, không đoán giá)
    lines: List[str] = [
        "## KẾT QUẢ PHÂN TÍCH ĐƠN THUỐC",
        "",
    ]

    # Section 1: Thông tin người bệnh & đơn thuốc
    patient_display = meta.get("patient_name") or "Chưa ghi nhận tên bệnh nhân"
    diag_display = meta.get("primary_diagnosis") or meta.get("primary_icd10") or "Theo dõi lâm sàng"
    lines.append(f"- Người bệnh: {patient_display}" + (f" ({meta['patient_age']} tuổi)" if meta.get("patient_age") else ""))
    lines.append(f"- Chẩn đoán: {diag_display}" + (f" (Mã ICD-10: `{meta['primary_icd10']}`)" if meta.get("primary_icd10") else ""))
    if meta.get("insurance_card_number"):
        lines.append(f"- Mã thẻ BHYT: `{meta['insurance_card_number']}`")
    lines.append("")

    # Section 2: Danh mục thuốc trong đơn
    # Kiểm tra xem đơn thuốc có ghi đơn giá thực tế hay không (không tự đoán giá)
    has_explicit_price = any(isinstance(it.get("unit_price"), (int, float)) and it["unit_price"] > 0 for it in items)

    lines.append(f"### 1. Danh mục thuốc trong đơn ({len(items)} thuốc)")
    if has_explicit_price:
        lines.append("| STT | Tên thuốc / Hoạt chất | Số lượng | Đường dùng & Cách dùng | Đơn giá |")
        lines.append("| :---: | :--- | :---: | :--- | :---: |")
        for idx, it in enumerate(items):
            d_name = it["drug_name"]
            dosage = f" ({it['dosage']})" if it.get("dosage") and it["dosage"] not in d_name else ""
            qty_display = f"{it.get('quantity', 1)} {it.get('unit', 'viên')}"
            instr = it.get("instructions") or it.get("route", "Uống")
            price_display = f"{it['unit_price']:,.0f} đ" if it.get("unit_price") else "-"
            lines.append(f"| {idx + 1} | **{d_name}{dosage}** | {qty_display} | {instr} | {price_display} |")
    else:
        lines.append("| STT | Tên thuốc / Hoạt chất | Số lượng | Đường dùng & Cách dùng |")
        lines.append("| :---: | :--- | :---: | :--- |")
        for idx, it in enumerate(items):
            d_name = it["drug_name"]
            dosage = f" ({it['dosage']})" if it.get("dosage") and it["dosage"] not in d_name else ""
            qty_display = f"{it.get('quantity', 1)} {it.get('unit', 'viên')}"
            instr = it.get("instructions") or it.get("route", "Uống")
            lines.append(f"| {idx + 1} | **{d_name}{dosage}** | {qty_display} | {instr} |")
    lines.append("")

    # Section 3: Cảnh báo tương tác thuốc (Dược thư Quốc gia & QĐ 5948/QĐ-BYT)
    lines.append("### 2. Cảnh báo tương tác thuốc (QĐ 5948/QĐ-BYT & Dược thư Quốc gia)")
    if ddi_report.has_contraindication or ddi_report.major_count > 0 or ddi_report.moderate_count > 0:
        if ddi_report.has_contraindication:
            lines.append(f"> **[CHỐNG CHỈ ĐỊNH PHỐI HỢP - {ddi_report.contraindicated_count} CẶP]**")
            for alert in [a for a in ddi_report.pair_alerts if a.severity.value == "CONTRAINDICATED"]:
                lines.append(f"- **{alert.title}**")
                lines.append(f"  - Cơ chế: {alert.mechanism}")
                lines.append(f"  - Hậu quả lâm sàng: {alert.clinical_consequence}")
                lines.append(f"  - Khuyến cáo xử trí: {alert.action_recommendation}")
                lines.append(f"  - Căn cứ pháp lý: `{alert.legal_evidence}`")
            lines.append("")

        major_alerts = [a for a in ddi_report.pair_alerts if a.severity.value == "MAJOR"]
        if major_alerts:
            lines.append(f"> **[TƯƠNG TÁC NGHIÊM TRỌNG - {len(major_alerts)} CẶP]**")
            for alert in major_alerts:
                lines.append(f"- **{alert.title}**: {alert.clinical_consequence}. Khuyến cáo: {alert.action_recommendation}")
            lines.append("")

        if ddi_report.polypharmacy_alerts:
            lines.append("> **[CẢNH BÁO ĐA THUỐC TÍCH LŨY ĐỘC TÍNH]**")
            for poly in ddi_report.polypharmacy_alerts:
                lines.append(f"- **{poly.title}**: Thuốc liên quan: `{', '.join(poly.involved_drugs)}`. {poly.clinical_risk}")
            lines.append("")
    else:
        lines.append("Không phát hiện tương tác thuốc bất lợi nghiêm trọng giữa các hoạt chất trong đơn (đối chiếu 54.885 danh mục Dược thư Quốc gia).")
        lines.append("")

    # Section 4: Rà soát danh mục thuốc BHYT chi trả (Thông tư 20/2022/TT-BYT)
    lines.append("### 3. Rà soát danh mục thuốc BHYT chi trả (Thông tư 20/2022/TT-BYT)")
    lines.append("*Lưu ý: Hệ thống chỉ rà soát danh mục thuốc thuộc phạm vi thanh toán của Quỹ BHYT; các điều kiện khác (tuyến bệnh viện, chỉ định chẩn đoán, hội chẩn) sẽ được xét sau.*")
    lines.append("")
    lines.append("| STT | Tên thuốc kê đơn | Tình trạng BHYT | Hoạt chất TT 20/2022 / Ghi chú |")
    lines.append("| :---: | :--- | :--- | :--- |")
    for idx, r in enumerate(bhyt_catalog_results):
        lines.append(f"| {idx + 1} | **{r['drug_name']}** | {r['status_badge']} | {r['note']} |")
    lines.append("")

    if uncovered_count == 0:
        lines.append(f"- Kết luận BHYT: Toàn bộ {len(items)} thuốc trong đơn đều thuộc danh mục do Quỹ BHYT thanh toán.")
    else:
        lines.append(f"- Kết luận BHYT: Có {covered_count}/{len(items)} thuốc thuộc danh mục BHYT chi trả; {uncovered_count} thuốc ngoài danh mục (người bệnh tự chi trả).")
    lines.append("")

    # Section 5: Khuyến nghị chuyên môn
    lines.append("### 4. Khuyến nghị chuyên môn:")
    rec_idx = 1
    if ddi_report.has_contraindication:
        lines.append(f"{rec_idx}. Ưu tiên an toàn: Cân nhắc điều chỉnh hoặc thay thế cặp thuốc chống chỉ định trước khi duyệt đơn.")
        rec_idx += 1
    if uncovered_count > 0:
        lines.append(f"{rec_idx}. Tư vấn viện phí: Giải thích cho người bệnh về các khoản thuốc ngoài phạm vi chi trả BHYT.")
        rec_idx += 1
    lines.append(f"{rec_idx}. Đồng bộ hệ thống: Sử dụng nút thao tác bên dưới để đưa danh mục thuốc sang phân hệ Kê đơn CPOE.")

    reply_text = "\n".join(lines)

    # Step 4: Construct Interactive Action Cards & CDSS Alerts
    cdss_alert = None
    if ddi_report.has_contraindication:
        top_alert = next((a for a in ddi_report.pair_alerts if a.severity.value == "CONTRAINDICATED"), None)
        cdss_alert = CopilotCdssAlert(
            level="critical",
            title="Chống chỉ định phối hợp thuốc",
            message=top_alert.title if top_alert else "Có cặp thuốc chống chỉ định nghiêm trọng trong đơn",
            antidoteRecommendation=top_alert.action_recommendation if top_alert else "Thay thế thuốc",
            regulatoryReference="QĐ 5948/QĐ-BYT Dược Thư Quốc Gia Việt Nam",
            substituteDrug=top_alert.drug_b if top_alert else None,
        )
    elif uncovered_count > 0:
        cdss_alert = CopilotCdssAlert(
            level="warning",
            title="Thuốc ngoài danh mục BHYT",
            message=f"Đơn thuốc có {uncovered_count} thuốc không thuộc danh mục Quỹ BHYT chi trả theo Thông tư 20/2022/TT-BYT (người bệnh tự chi trả).",
            regulatoryReference="Thông tư 20/2022/TT-BYT Bộ Y Tế",
        )

    # Primary Action Card: Pre-fill into CPOE Tab
    action_card = CopilotActionCard(
        card_type="prescription_import",
        title="Đồng Bộ Đơn Thuốc Sang Kê Đơn CPOE",
        summary=f"Nhập {len(items)} khoản thuốc bóc tách từ ảnh vào hệ thống kê đơn để bác sĩ kiểm tra và ký duyệt.",
        target_tab="cpoe",
        primary_action_label="Mở Phân Hệ Kê Đơn CPOE",
        primary_action_type="OPEN_CPOE",
        data={
            "patient_name": meta.get("patient_name") or "",
            "primary_icd10": meta.get("primary_icd10") or "",
            "primary_diagnosis": meta.get("primary_diagnosis") or "",
            "items": items,
            "has_ddi_warning": ddi_report.has_contraindication or ddi_report.major_count > 0,
            "bhyt_covered_count": covered_count,
            "bhyt_uncovered_count": uncovered_count,
            "at_risk_cost_vnd": 0,
        }
    )

    evidence = [
        {
            "title": "Dược Thư Quốc Gia Việt Nam",
            "snippet": f"QĐ 5948/QĐ-BYT & QĐ 2033/QĐ-BYT: Đã đối chiếu {len(raw_drug_names)} thuốc.",
            "url": "https://kcb.vn/duoc-thu-quoc-gia",
            "source": "Bộ Y Tế"
        },
        {
            "title": "Thông tư 20/2022/TT-BYT",
            "snippet": "Danh mục thuốc và tỷ lệ thanh toán BHYT.",
            "url": "https://baohiemxahoi.gov.vn",
            "source": "Bảo Hiểm Xã Hội Việt Nam"
        }
    ]
    citations = [
        {
            "source": "Bộ Y Tế",
            "title": "Dược Thư Quốc Gia Việt Nam",
            "section": "Tương tác thuốc & Chống chỉ định",
            "legal_basis": "QĐ 5948/QĐ-BYT & QĐ 2033/QĐ-BYT",
        },
        {
            "source": "Bảo Hiểm Xã Hội Việt Nam",
            "title": "Thông tư 20/2022/TT-BYT Bộ Y Tế",
            "section": "Danh mục thuốc & Tỷ lệ chi trả BHYT",
            "legal_basis": "Thông tư 20/2022/TT-BYT",
        }
    ]

    clinical_summary = ClinicalSummary(
        headline=f"Phân tích đơn thuốc ({len(items)} thuốc): " + (
            "Chống chỉ định phối hợp" if ddi_report.has_contraindication
            else (f"{uncovered_count} thuốc ngoài BHYT" if uncovered_count > 0 else "An toàn & Trong danh mục BHYT")
        ),
        key_takeaway=(
            f"Phát hiện {ddi_report.contraindicated_count} cặp chống chỉ định cần thay thế."
            if ddi_report.has_contraindication
            else (
                f"Đơn thuốc có {covered_count}/{len(items)} thuốc thuộc danh mục BHYT chi trả."
                if uncovered_count > 0
                else "Đơn thuốc được kiểm tra an toàn theo Dược thư Quốc gia và thuộc danh mục BHYT chi trả."
            )
        ),
        urgency="emergency" if ddi_report.has_contraindication else ("warning" if uncovered_count > 0 else "routine"),
    )

    return {
        "reply_text": reply_text,
        "clinical_summary": clinical_summary,
        "card": action_card,
        "cdss_alert": cdss_alert,
        "evidence": evidence,
        "citations": citations,
        "rag_grounded": True,
        "suggested_chips": [
            "Danh mục BHYT TT 20",
            "Đổi thuốc sang CPOE",
            "Tra cứu Dược Thư",
            "Kiểm tra tương tác thuốc"
        ],
    }
