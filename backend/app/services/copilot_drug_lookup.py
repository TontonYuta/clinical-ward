"""
Service tra cứu thông tin thuốc từ dữ liệu DAV và kho bệnh viện (<=185 LOC).
Tích hợp Lexical Trie Matcher và Fuzzy Candidate Search đảm bảo độ chính xác và hiệu năng cao.
"""
from typing import List, Optional
import re
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.copilot import CopilotResponse
from app.services.copilot_drug_formatter import build_drug_profile_response
from app.services.copilot_drug_keyword_extractor import extract_drug_keywords
from app.services.copilot_inventory_suggester import suggest_inventory_typo
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

async def lookup_drug_authoritative(
    query: str, db: AsyncSession, session_id: str | None = None,
    user_name: str = "Nhân viên y tế", user_role: str = "nurse",
) -> CopilotResponse:
    from app.services.session_context import get_or_create_session
    session = get_or_create_session(session_id, user_name, user_role)
    matcher = get_drug_lexical_matcher()

    sdk = matcher.extract_sdk(query)
    meds = matcher.extract_medications(query)
    kw = sdk
    if not kw:
        if len(meds) >= 2 and not any(term in query.casefold() for term in ("tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng", "uống chung", "uong cung", "dung cung", "tuong tac")):
            combined_brand = f"{meds[0]} {meds[1]}"
            cand_res = await db.execute(select(DavNationalDrug.brand_name).where(func.lower(DavNationalDrug.brand_name).like(f"{combined_brand.lower()}%")).limit(1))
            if cand_res.scalar_one_or_none():
                kw = combined_brand
        if not kw:
            kw = meds[0] if meds else extract_drug_keywords(query)
    if kw:
        kw = re.sub(r"[\s\xa0]+", " ", kw).strip()

    deictic_phrases = ["thuốc đó", "thuốc này", "nó", "thuốc vừa nói", "thuốc vừa gợi ý", "thuốc trên", "thuốc đang hỏi", "thuốc vừa khuyên"]
    is_deictic = any(w in query.lower() for w in deictic_phrases) or kw.lower() in ["đó", "này", "kia", "nó", "vừa nói", "vừa gợi ý", "thuốc đó", "thuốc này"]

    if is_deictic and not session.active_medication_name:
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Dạ xin lỗi bác sĩ, hiện chưa xác định được thuốc đang được nhắc tới trong phiên hội thoại này. Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký để tra cứu thông tin chi tiết / tóm tắt ạ.",
            answer_type="clarification", source_status="missing_medication_context", confidence=1.0,
            session_id=session.session_id, suggested_chips=["Tra cứu thông tin thuốc", "Nhập tên hoạt chất hoặc biệt dược"]
        )

    is_unanchored_info = any(p in query.lower() for p in (
        "chi tiết đầy đủ", "thông tin chi tiết", "thông tin đầy đủ", "đầy đủ nhất",
        "chi tiết nhất", "tóm tắt thông tin", "tóm tắt", "hồ sơ đầy đủ", "toàn bộ thông tin"
    ))
    if is_unanchored_info and not session.active_medication_name and (not kw or len(kw) < 2):
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Dạ xin lỗi bác sĩ, hiện chưa xác định được thuốc cần tra cứu trong phiên hội thoại này. Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký để hệ thống hiển thị tóm tắt / thông tin chi tiết ạ.",
            answer_type="clarification", source_status="missing_medication_context", confidence=1.0,
            session_id=session.session_id, suggested_chips=["Tra cứu thuốc Teglutik", "Tra cứu thuốc Paracetamol", "Tra cứu SĐK VD-24757-16"]
        )

    if (not kw or len(kw) < 2 or is_deictic or (is_unanchored_info and not meds and not sdk)) and session.active_medication_name:
        kw = session.active_medication_sdk or session.active_medication_ingredient or session.active_medication_name

    query_field_only = (not kw or len(kw) < 2 or is_deictic) and any(term in query.lower() for term in [
        "thành phần", "hoạt chất", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "liều dùng", "liều lượng", "chỉ định", "tương tác thuốc", "tương tác", "tương kỵ"
    ])
    if query_field_only and session.active_medication_name:
        kw = session.active_medication_sdk or session.active_medication_name

    if not kw or len(kw) < 2:
        catalog_count_res = await db.execute(select(func.count(DavNationalDrug.id)))
        catalog_count = int(catalog_count_res.scalar_one() or 0)
        guide_text = (
            f"### 🏥 CỔNG TRA CỨU DƯỢC QUỐC GIA & DƯỢC THƯ LÂM SÀNG ({catalog_count:,} BẢN GHI ĐANG LẬP CHỈ MỤC)\n\n"
            "Hệ thống tích hợp dữ liệu chính thống **Cục Quản lý Dược Việt Nam (DAV)**, "
            "**Dược thư Quốc gia DĐVN V** và **Kho dược bệnh viện**:\n\n"
            "1. **Tra cứu theo Tên Biệt Dược hoặc Hoạt Chất (INN):** `\"Paracetamol\"`, `\"Ibuprofen\"`...\n"
            "2. **Tra cứu theo Số Đăng Ký Lưu Hành (SĐK) Cục QLD:** `\"SĐK VD-24757-16\"`...\n"
            "3. **Tra cứu Chỉ Định & Liều Dùng Chuẩn DĐVN V:** `\"Liều dùng Paracetamol\"`...\n"
            "4. **Đối Soát Tồn Kho & Hạn Dùng FEFO Bệnh Viện.**"
        )
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_GUIDE", reply_text=guide_text, card=None,
            legal_basis="Cục Quản lý Dược Việt Nam & Dược Thư Quốc Gia",
            answer_type="lookup_guide", source_status="catalog_available", confidence=1.0,
            suggested_chips=["Tra cứu thuốc Rocephin", "Tra cứu SĐK VD-24757-16", "Thông tin Paracetamol", "Kiểm tra tương tác thuốc"]
        )

    kw_clean = re.sub(r"[\s\xa0]+", " ", kw).strip()
    search_term = f"%{kw_clean.lower()}%"
    stmt = (
        select(DavNationalDrug)
        .where(or_(
            func.lower(DavNationalDrug.national_code).like(search_term),
            func.lower(DavNationalDrug.brand_name).like(search_term),
            func.lower(DavNationalDrug.active_ingredient).like(search_term)
        ))
        .order_by(
            (func.lower(DavNationalDrug.brand_name) == kw_clean.lower()).desc(),
            func.lower(DavNationalDrug.brand_name).like(f"{kw_clean.lower()}%").desc(),
            func.lower(DavNationalDrug.brand_name).like(f"%{kw_clean.lower()}%").desc(),
            (func.lower(DavNationalDrug.active_ingredient) == kw_clean.lower()).desc(),
            DavNationalDrug.national_code.asc()
        )
        .limit(5)
    )
    res = await db.execute(stmt)
    drugs = res.scalars().all()

    if not drugs and len(kw.split()) == 1:
        token = kw.casefold()
        candidate_res = await db.execute(
            select(DavNationalDrug).where(or_(
                func.lower(DavNationalDrug.brand_name).like(f"%{token}%"),
                func.lower(DavNationalDrug.active_ingredient).like(f"%{token}%")
            )).limit(20)
        )
        candidates = candidate_res.scalars().all()
        drugs = [drug for drug in candidates if
                 token in drug.brand_name.casefold().split() or
                 token in drug.active_ingredient.casefold().replace(";", " ").replace("+", " ").split()]

    if not drugs:
        fuzzy_cands = matcher.fuzzy_candidate_search(kw, top_k=1)
        if fuzzy_cands:
            cand_res = await db.execute(select(DavNationalDrug).where(func.lower(DavNationalDrug.brand_name) == fuzzy_cands[0].lower()).limit(5))
            drugs = cand_res.scalars().all()

    if not drugs:
        mono_res = await db.execute(
            select(ClinicalDrugMonograph).where(or_(
                func.lower(ClinicalDrugMonograph.inn) == kw.lower(),
                func.lower(ClinicalDrugMonograph.inn).like(f"{kw.lower()} %"),
                func.lower(ClinicalDrugMonograph.inn).like(f"% {kw.lower()}%"),
                func.lower(ClinicalDrugMonograph.title) == kw.lower(),
                func.lower(ClinicalDrugMonograph.title).like(f"{kw.lower()} %")
            )).limit(1)
        )
        monograph = mono_res.scalar_one_or_none()
        if monograph:
            drugs = [DavNationalDrug(
                id=f"MONO-{monograph.id}", national_code=monograph.atc_code or "DĐVN V",
                brand_name=monograph.title or monograph.inn.title(), active_ingredient=monograph.inn,
                atc_code=monograph.atc_code, drug_class=monograph.drug_class,
                indications=monograph.indications, contraindications=monograph.contraindications,
                adverse_effects=monograph.adverse_effects, drug_interactions=monograph.drug_interactions,
                adult_dosage=monograph.adult_dosage, clinical_source="Dược Thư Quốc Gia Việt Nam",
                clinical_monograph_id=monograph.id
            )]

    if not drugs:
        if len(kw.split()) > 1 and any(term in query.casefold() for term in ("tương tác", "tương kỵ", "phối hợp", "dùng cùng", "uống cùng", "kết hợp")):
            from app.services.rag import execute_clinical_rag
            rag_res = await execute_clinical_rag(query)
            if rag_res:
                from app.security.guardrails import validate_output_guardrail
                return CopilotResponse(
                    intent="CLINICAL_AI_CONSULTATION",
                    reply_text=validate_output_guardrail(rag_res.answer, query),
                    legal_basis=rag_res.legal_basis or None,
                    suggested_chips=["Kiểm tra cặp thuốc khác", "Rà soát toàn bộ danh sách thuốc"],
                    session_id=session.session_id, citations=[c.to_dict() for c in rag_res.citations],
                    rag_grounded=rag_res.rag_grounded,
                    answer_type="grounded_reference" if rag_res.rag_grounded else "safe_abstention",
                    source_status="retrieved_evidence" if rag_res.rag_grounded else "insufficient_retrieval_evidence",
                    confidence=rag_res.confidence_score,
                    abstention_reason=None if rag_res.rag_grounded else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
                )

    if not drugs:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response
        from app.services.chatbot.copilot_orchestrator import normalize_conversational_query
        norm_q = normalize_conversational_query(query)
        spec_item = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_q)
        if spec_item:
            return await synthesize_specialty_response(query, spec_item, user_name=user_name, user_role=user_role, session_id=session.session_id)

    from app.services.chatbot.corrective_rag import evaluate_crag_tripartite
    crag_res = await evaluate_crag_tripartite(
        query=query, raw_kw=kw, direct_drugs=drugs, db=db,
        session_id=session.session_id, user_name=user_name, user_role=user_role
    )
    if crag_res:
        return crag_res

    return await build_drug_profile_response(drugs, db, session, query=query)
