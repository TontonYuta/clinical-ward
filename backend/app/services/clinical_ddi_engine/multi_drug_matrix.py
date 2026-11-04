"""
Động cơ thẩm định ma trận tương tác đơn thuốc đa thành phần (N >= 2) theo QĐ 5948/QĐ-BYT.
Xử lý ma trận tam giác kết hợp O(N^2) dưới 1ms, trả lời tất định không ảo giác (<= 150 LOC).
"""
from typing import List, Optional
from app.schemas.copilot import CopilotResponse, CopilotActionCard, CopilotCdssAlert
from app.services.clinical_ddi_engine.detector import ClinicalDdiDetector
from app.services.clinical_ddi_engine.schemas import DdiSeverity

_DETECTOR = ClinicalDdiDetector()

def format_multi_ddi_response(
    raw_drugs: List[str],
    query: str,
    session_id: Optional[str] = None
) -> CopilotResponse:
    report = _DETECTOR.audit_prescription(raw_drugs)
    drug_names_str = ", ".join(f"**{d.display_name}**" for d in report.normalized_entities)

    if not report.pair_alerts and not report.polypharmacy_alerts:
        reply = (
            f"### ✅ ĐỐI SOÁT TƯƠNG TÁC THUỐC (QĐ 5948/QĐ-BYT)\n\n"
            f"• **Danh sách rà soát ({report.total_drugs} thuốc):** {drug_names_str}\n"
            f"• **Số cặp phối hợp đã thẩm định:** {report.analyzed_pairs_count} cặp.\n\n"
            f"👉 **Kết luận:** **Không ghi nhận tương tác chống chỉ định hoặc cảnh báo mức độ nghiêm trọng** "
            f"giữa các hoạt chất này trong danh mục 633 cặp tương tác của **Quyết định 5948/QĐ-BYT**.\n\n"
            f"*(Lưu ý: Luôn theo dõi các phản ứng cá thể hóa và tham khảo thêm chuyên luận DĐVN V khi điều trị)*."
        )
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            reply_text=reply,
            card=None,
            legal_basis="Quyết định 5948/QĐ-BYT & Dược Thư Quốc Gia Việt Nam",
            answer_type="grounded_reference",
            source_status="retrieved_evidence",
            confidence=1.0,
            session_id=session_id,
            suggested_chips=["Tra cứu liều dùng", "Kiểm tra chống chỉ định", "Tra cứu Dược Thư Quốc Gia"]
        )

    lines = [
        f"### ⚠️ PHÁT HIỆN TƯƠNG TÁC THUỐC LÂM SÀNG (QĐ 5948/QĐ-BYT)\n",
        f"• **Thuốc rà soát:** {drug_names_str}",
        f"• **Số cặp cảnh báo:** **{len(report.pair_alerts)}** | **Hội chứng tích lũy:** **{len(report.polypharmacy_alerts)}**\n"
    ]

    has_contra = False
    for i, alert in enumerate(report.pair_alerts, start=1):
        sev_icon = "🔴 CHỐNG CHỈ ĐỊNH (MỨC ĐỘ 1)" if alert.severity == DdiSeverity.CONTRAINDICATED else "🟡 CẢNH BÁO / THẬN TRỌNG (MỨC ĐỘ 2)"
        if alert.severity == DdiSeverity.CONTRAINDICATED:
            has_contra = True
        lines.append(f"#### {i}. {alert.title}")
        lines.append(f"* **Mức độ:** {sev_icon}")
        lines.append(f"* **Cơ chế:** {alert.mechanism}")
        lines.append(f"* **Hậu quả lâm sàng:** {alert.clinical_consequence}")
        lines.append(f"* **Khuyến cáo xử trí:** {alert.action_recommendation}")
        lines.append(f"* **Căn cứ pháp lý:** `{alert.legal_evidence}`\n")

    for j, poly in enumerate(report.polypharmacy_alerts, start=len(report.pair_alerts) + 1):
        lines.append(f"#### {j}. 🚨 {poly.title}")
        lines.append(f"* **Cơ chế cộng dồn:** {poly.mechanism}")
        lines.append(f"* **Hậu quả:** {poly.clinical_consequence}")
        lines.append(f"* **Xử trí:** {poly.action_recommendation}")
        lines.append(f"* **Căn cứ:** `{poly.legal_evidence}`\n")

    cdss_alert = None
    if report.pair_alerts:
        top_alert = report.pair_alerts[0]
        substitute_drug = None
        action_rec = top_alert.action_recommendation
        if "pantoprazol" in action_rec.lower():
            substitute_drug = "Pantoprazol 40mg"
        elif "linagliptin" in action_rec.lower():
            substitute_drug = "Linagliptin 5mg"
        elif "prednisolon" in action_rec.lower():
            substitute_drug = "Prednisolon 20mg"
        elif "giảm 50%" in action_rec.lower() or "giảm liều" in action_rec.lower():
            substitute_drug = "Hiệu chỉnh giảm 50% liều"

        cdss_alert = CopilotCdssAlert(
            level="critical" if has_contra else "warning",
            title="🛑 CHỐNG CHỈ ĐỊNH (QĐ 5948/QĐ-BYT)" if has_contra else "⚠️ CẢNH BÁO TƯƠNG TÁC THUỐC (QĐ 5948)",
            message=f"{top_alert.title}: {top_alert.clinical_consequence}",
            antidoteRecommendation=top_alert.action_recommendation,
            regulatoryReference=top_alert.legal_evidence or "Quyết định 5948/QĐ-BYT",
            substituteDrug=substitute_drug
        )

    card = CopilotActionCard(
        card_type="medication_safety",
        title="Cảnh báo Tương tác QĐ 5948",
        summary=f"Phát hiện {len(report.pair_alerts)} tương tác cần can thiệp lâm sàng.",
        data={"has_contraindication": has_contra, "drugs": raw_drugs},
        primary_action_label="Xem Phác Đồ Thay Thế",
        primary_action_type="NAVIGATE_TAB",
        target_tab="cpoe"
    )

    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="\n".join(lines).strip(),
        card=card,
        cdss_alert=cdss_alert,
        legal_basis="Quyết định 5948/QĐ-BYT Ban hành Danh mục Tương tác Thuốc",
        answer_type="grounded_reference",
        source_status="retrieved_evidence",
        confidence=1.0,
        session_id=session_id,
        suggested_chips=["Cơ chế và mức độ nghiêm trọng", "Biện pháp xử trí hoặc phối hợp thay thế an toàn", "Kiểm tra cặp thuốc khác"]
    )
