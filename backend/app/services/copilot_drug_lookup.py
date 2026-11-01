"""
Service tra cứu thông tin thuốc từ dữ liệu DAV và kho bệnh viện; độ bao phủ phụ thuộc nguồn/mapping (<=160 LOC)
"""

import re
import difflib
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_formatter import build_drug_profile_response

STOP_PHRASES = [
    "tôi muốn tra cứu thông tin về thuốc", "tôi muốn tra cứu thông tin thuốc", "tôi muốn tra cứu về thuốc", "tôi muốn tra cứu thuốc",
    "tôi muốn tìm thông tin về thuốc", "tôi muốn tìm thuốc", "tôi muốn hỏi thông tin về thuốc", "tôi muốn hỏi về thuốc",
    "làm ơn cho tôi biết thông tin về thuốc", "cho tôi biết thông tin về thuốc", "cho tôi hỏi thông tin về thuốc", "cho tôi hỏi về thuốc",
    "tìm giúp tôi thuốc", "kiểm tra giúp tôi thuốc", "tra cứu giúp tôi thuốc", "tra cứu thông tin về thuốc", "tra cứu thông tin thuốc",
    "thông tin về thuốc", "thông tin thuốc", "hỏi thông tin về thuốc", "hỏi về thuốc", "trong kho còn thuốc", "bệnh viện có thuốc",
    "danh mục thuốc", "danh sách thuốc", "có những loại thuốc nào", "dùng để làm gì", "có tác dụng gì", "dùng thế nào",
    "liều lượng", "liều dùng", "số đăng ký", "thuốc gì", "là thuốc gì", "cách dùng", "chỉ định", "tác dụng", "công dụng", "thành phần",
    "cho tôi", "cho em", "cho anh", "cho mình", "tôi cần", "em cần", "mình cần", "hãy cho", "lấy cho", "cần", "muốn", "lấy", "tìm",
    "thuốc", "về", "sđk", "mã", "html", "code", "website", "trị", "chữa", "uống"
]

def extract_drug_keywords(query: str) -> str:
    cleaned = query.strip()
    sdk_match = re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", cleaned, re.IGNORECASE)
    if sdk_match:
        return sdk_match.group(1).upper()

    q_lower = cleaned.lower()
    # Retain every distinct medication alias, including both members of a DDI pair.
    from app.services.copilot_catalog import MEDICATION_CATALOG
    aliases = sorted((alias for med in MEDICATION_CATALOG for alias in med["keywords"]), key=len, reverse=True)
    found = [alias for alias in aliases if alias in q_lower]
    unique_found = [alias for alias in found if not any(alias != other and alias in other for other in found)]
    if unique_found:
        return " ".join(dict.fromkeys(unique_found))

    for phrase in sorted(STOP_PHRASES, key=len, reverse=True):
        q_lower = q_lower.replace(phrase, " ")
    words = [w.strip(" .,?!:;\"'") for w in q_lower.split() if len(w.strip(" .,?!:;\"'")) >= 2]
    question_terms = {
        "tác", "dụng", "phụ", "không", "mong", "muốn", "tương", "tác", "thành", "phần",
        "của", "thuốc", "này", "đó", "là", "gì", "thế", "nào", "bao", "nhiêu", "hoạt", "chất",
        "thời", "gian", "bán", "thải", "tối", "đa", "huyết", "tương",
        "có", "hay", "hoặc", "bị", "cho", "đang", "được", "những", "các", "loại", "nhóm", "khác", "chi",
        "chống", "chỉ", "định", "cách", "dùng", "liều", "lượng", "và", "với", "cùng", "trong", "khi"
    }
    words = [word for word in words if word not in question_terms]
    return " ".join(words).strip()

async def lookup_drug_authoritative(query: str, db: AsyncSession, session_id: str | None = None) -> CopilotResponse:
    from app.services.session_context import get_or_create_session
    session = get_or_create_session(session_id)
    kw = extract_drug_keywords(query)

    deictic_phrases = ["thuốc đó", "thuốc này", "nó", "thuốc vừa nói", "thuốc vừa gợi ý", "thuốc trên", "thuốc đang hỏi", "thuốc vừa khuyên"]
    is_deictic = any(w in query.lower() for w in deictic_phrases) or kw.lower() in ["đó", "này", "kia", "nó", "vừa nói", "vừa gợi ý", "thuốc đó", "thuốc này"]

    if (not kw or len(kw) < 2 or is_deictic) and session.active_medication_name:
        kw = session.active_medication_ingredient or session.active_medication_name

    # Resolve question-only field prompts against the active medication in-session.
    query_field_only = any(term in query.lower() for term in [
        "thành phần", "hoạt chất", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "liều dùng", "liều lượng", "chỉ định", "tương tác thuốc", "tương tác", "tương kỵ"
    ]) and any(term in query.lower() for term in ["thuốc này", "thuốc đó", "nó", "của thuốc", "của paracetamol"])
    if query_field_only and session.active_medication_name:
        kw = session.active_medication_name

    if not kw or len(kw) < 2:
        catalog_count_result = await db.execute(select(func.count(DavNationalDrug.id)))
        catalog_count = int(catalog_count_result.scalar_one() or 0)
        guide_text = (
            f"### 🏥 CỔNG TRA CỨU DƯỢC QUỐC GIA & DƯỢC THƯ LÂM SÀNG ({catalog_count:,} BẢN GHI ĐANG LẬP CHỈ MỤC)\n\n"
            "Hệ thống tích hợp dữ liệu chính thống **Cục Quản lý Dược Việt Nam (DAV)**, "
            "**Dược thư Quốc gia DĐVN V** và **Kho dược bệnh viện**:\n\n"
            "1. **Tra cứu theo Tên Biệt Dược hoặc Hoạt Chất (INN):**\n"
            "   • *Ví dụ:* `\"Thông tin thuốc Rocephin\"`, `\"Augmentin 1g\"`, `\"Paracetamol\"`...\n"
            "2. **Tra cứu theo Số Đăng Ký Lưu Hành (SĐK) Cục QLD:**\n"
            "   • *Ví dụ:* `\"SĐK VD-24757-16 là thuốc gì\"`, `\"Tra cứu SĐK VN-17037-13\"`...\n"
            "3. **Tra cứu Chỉ Định, Tác Dụng & Liều Dùng Chuẩn DĐVN V:**\n"
            "   • *Ví dụ:* `\"Paracetamol liều dùng thế nào\"`, `\"Morphin dùng để làm gì\"`...\n"
            "4. **Đối Soát Tồn Kho & Hạn Dùng FEFO Bệnh Viện:**\n"
            "   • Tự động đối soát cơ số tủ trực cấp cứu, số lô và ngày hết hạn.\n\n"
            "👉 *Bạn có thể bấm vào các gợi ý nhanh bên dưới hoặc nhập trực tiếp tên thuốc / số đăng ký cần tra cứu!*"
        )
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_GUIDE",
            reply_text=guide_text,
            card=None,
            legal_basis="Cục Quản lý Dược Việt Nam & Dược Thư Quốc Gia",
            answer_type="lookup_guide", source_status="catalog_available", confidence=1.0,
            suggested_chips=["Tra cứu thuốc Rocephin", "Tra cứu SĐK VD-24757-16", "Thông tin thuốc Augmentin", "Paracetamol liều dùng thế nào", "Quy tắc 5 đúng Morphin"]
        )

    # 1. Tra cứu CSDL 54.885 thuốc Cục QLD
    search_term = f"%{kw.lower()}%"
    stmt = (
        select(DavNationalDrug)
        .where(
            or_(
                func.lower(DavNationalDrug.national_code).like(search_term),
                func.lower(DavNationalDrug.brand_name).like(search_term),
                func.lower(DavNationalDrug.active_ingredient).like(search_term)
            )
        )
        .order_by(
            (DavNationalDrug.national_code == (session.active_medication_sdk or "")).desc(),
            (func.lower(DavNationalDrug.brand_name) == kw.lower()).desc(),
            func.lower(DavNationalDrug.brand_name).like(f"%{kw.lower()}%").desc(),
            DavNationalDrug.national_code.asc()
        )
        .limit(5)
    )
    res = await db.execute(stmt)
    drugs = res.scalars().all()

    if not drugs:
        # Nếu từ khóa là triệu chứng hoặc chỉ định lâm sàng -> Chuyển sang Pure RAG
        is_symptom = any(w in kw.lower() or w in query.lower() for w in [
            "hạ sốt", "giảm sốt", "giảm đau", "kháng sinh", "chống viêm", "sốt", "đau đầu",
            "loại hạ sốt", "loại giảm đau", "loại kháng sinh", "loại nào", "thuốc gì", "uống gì"
        ])
        if is_symptom:
            from app.services.rag import execute_clinical_rag
            rag_res = await execute_clinical_rag(query)
            if rag_res and rag_res.citations:
                from app.security.guardrails import validate_output_guardrail
                return CopilotResponse(
                    intent="CLINICAL_AI_CONSULTATION",
                    reply_text=validate_output_guardrail(rag_res.answer, query),
                    legal_basis=rag_res.legal_basis or "Dược Thư Quốc Gia Việt Nam",
                    suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Thông tư 51/2017/TT-BYT", "Kiểm tra tương tác thuốc"],
                    session_id=session.session_id,
                    citations=[c.to_dict() for c in rag_res.citations],
                    rag_grounded=True
                )

        batch_res = await db.execute(select(InventoryBatch))
        all_batches = batch_res.scalars().all()
        best_batch, best_ratio = None, 0.0
        kw_clean = kw.lower().strip()

        for b in all_batches:
            name_ratio = difflib.SequenceMatcher(None, kw_clean, b.item_name.lower()).ratio()
            ing_ratio = difflib.SequenceMatcher(None, kw_clean, (b.active_ingredient or "").lower()).ratio()
            max_r = max(name_ratio, ing_ratio)
            if kw_clean in b.item_name.lower() or kw_clean in (b.active_ingredient or "").lower():
                max_r = max(max_r, 0.75)
            if max_r > best_ratio:
                best_ratio = max_r
                best_batch = b

        if best_batch and best_ratio >= 0.55:
            sdk_code = best_batch.registration_number or best_batch.national_code or "Đang cập nhật"
            active_name = best_batch.active_ingredient or best_batch.item_name
            reply = (
                f"### 🔍 KHÔNG TÌM THẤY TÊN CHÍNH XÁC - GỢI Ý ĐỐI SOÁT CHÍNH TẢ\n\n"
                f"• Hệ thống không tìm thấy mặt hàng mang tên `{kw}` trong CSDL 54.885 số đăng ký Cục Quản lý Dược.\n"
                f"👉 **Có phải bạn đang tìm mặt hàng sau trong tủ trực bệnh viện:**\n"
                f"• **{best_batch.item_name}** (Hoạt chất: **{active_name}** | SĐK: `{sdk_code}` | Tồn kho: **{best_batch.current_stock} {best_batch.unit}** tại {best_batch.warehouse_location})\n\n"
                f"*(Bấm vào nút hành động bên dưới để đối soát chi tiết thông tin thuốc & tồn kho)*"
            )
            card = CopilotActionCard(
                card_type="medication_safety",
                title=f"Gợi ý: {best_batch.item_name}",
                summary=f"SĐK: {sdk_code} • Tồn: {best_batch.current_stock} {best_batch.unit} ({best_batch.warehouse_location})",
                data={"national_code": sdk_code, "brand_name": best_batch.item_name, "active_ingredient": active_name, "targetTab": "fefo"},
                primary_action_label=f"Xem {best_batch.item_name}", primary_action_type="NAVIGATE_TAB", target_tab="fefo"
            )
            return CopilotResponse(
                intent="CLINICAL_TYPO_SUGGESTION", reply_text=reply, card=card,
                legal_basis="Thông tư 22/2011/TT-BYT & CSDL Cục Quản lý Dược",
            suggested_chips=[f"Thông tin {best_batch.item_name}", "Đối soát ca trực 07:00 AM", "Kiểm tra hạn dùng FEFO"],
            answer_type="medication_suggestion", source_status="inventory_suggestion", confidence=best_ratio
            )

        clean_target = kw.strip().title() if len(kw) < 25 else kw.strip()
        reply_abstain = (
            f"### 🛡️ TỪ CHỐI ĐƯA CHỈ ĐỊNH (Thực Thể Dược Phẩm Chưa Định Danh)\n\n"
            f"• **Kết quả đối soát:** Hệ thống không ghi nhận `{clean_target}` trong danh mục DAV hiện đang lập chỉ mục và kho dữ liệu nội bộ. Điều này không khẳng định tên thuốc không tồn tại ngoài các nguồn đã nạp.\n"
            f"• **Rào chắn an toàn lâm sàng (Safe Abstention - TT 22/2011/TT-BYT & TT 20/2017/TT-BYT):** Trợ lý AI **tuyệt đối không suy đoán hoặc cung cấp liều dùng, chỉ định** cho các tên thuốc chưa được định danh trong CSDL chính thống nhằm ngăn ngừa biến cố gây hại tính mạng người bệnh.\n"
            f"• **Khuyến nghị xử trí:**\n"
            f"  1. Kiểm tra lại vỏ bao bì hộp thuốc, đơn thuốc CPOE hoặc hồ sơ bệnh án để đối chiếu chính xác tên thương mại / hoạt chất quốc tế (INN).\n"
            f"  2. Tra cứu trực tiếp trên [Cổng dịch vụ công Cục Quản lý Dược](https://dichvucong.dav.gov.vn).\n"
            f"  3. Liên hệ Dược sĩ lâm sàng / Khoa Dược bệnh viện để được thẩm định chuyên môn."
        )
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION", reply_text=reply_abstain, card=None,
            legal_basis="Thông tư 22/2011/TT-BYT & Dược Thư Quốc Gia Việt Nam",
            suggested_chips=["Tra cứu SĐK VD-24757-16", "Kho Dược Quốc Gia 55k", "Đối soát ca trực 07:00 AM"],
            answer_type="safe_abstention", source_status="not_found", confidence=1.0,
            abstention_reason="Không tìm thấy thực thể thuốc đã định danh trong danh mục tra cứu"
        )

    return await build_drug_profile_response(drugs, db, session, query=query)
