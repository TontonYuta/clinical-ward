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
        if len(meds) >= 2:
            is_dispense_action = any(term in query.lower() for term in ("cho 1 lọ", "tiêm 1", "lấy gấp", "xuất 1", "kê 2", "cho bệnh nhân", "buồng cấp cứu", "phòng mổ"))
            is_comparison = any(term in query.lower() for term in ("so sánh", "so sanh", "khác nhau", "khac nhau", "tốt hơn", "tot hon"))
            is_interaction = any(term in query.casefold() for term in ("tương tác", "tương kỵ", "phối hợp", "kết hợp", "uống cùng", "dùng cùng", "uống chung", "uong cung", "dung cung", "tuong tac", "uống được không", "dùng được không", "đang dùng", "đang uống", "có uống được", "có dùng được", "kèm theo", "đi kèm", "+")) or ("được" in query.lower() and "không" in query.lower())
            if is_interaction and not is_dispense_action and not is_comparison:
                from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
                return format_multi_ddi_response(meds, query, session_id=session.session_id)

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
            reply_text="Dạ để hỗ trợ tra cứu chính xác nhất, Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký cần tra cứu giúp em nhé ạ.",
            answer_type="clarification", source_status="missing_medication_context", confidence=1.0,
            session_id=session.session_id, suggested_chips=["Tra cứu thông tin thuốc", "Nhập tên hoạt chất hoặc biệt dược"]
        )

    is_unanchored_info = any(p in query.lower() for p in (
        "chi tiết đầy đủ", "thông tin chi tiết", "thông tin đầy đủ", "đầy đủ nhất",
        "chi tiết nhất", "tóm tắt thông tin", "tóm tắt", "hồ sơ đầy đủ", "toàn bộ thông tin"
    ))
    if is_unanchored_info and not session.active_medication_name and (not meds and not sdk or not kw or len(kw) < 2 or kw.lower() in ("tóm tắt", "tom tat", "chi tiết", "thông tin", "hồ sơ")):
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Dạ để hỗ trợ tra cứu thông tin chi tiết hoặc tóm tắt thuốc, Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký (SĐK) giúp em nhé ạ.",
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
    search_terms = [kw_clean]
    comp_m = re.match(r"^([^(]+)\s*\(([^)]+)\)$", kw_clean)
    if comp_m:
        p1, p2 = comp_m.group(1).strip(), comp_m.group(2).strip()
        if p1 and p1 not in search_terms:
            search_terms.append(p1)
        if p2 and p2 not in search_terms:
            search_terms.append(p2)

    conds = []
    for term in search_terms:
        st = f"%{term.lower()}%"
        conds.extend([
            func.lower(DavNationalDrug.national_code).like(st),
            func.lower(DavNationalDrug.brand_name).like(st),
            func.lower(DavNationalDrug.active_ingredient).like(st)
        ])

    stmt = (
        select(DavNationalDrug)
        .where(or_(*conds))
        .order_by(
            or_(*[(func.lower(DavNationalDrug.brand_name) == term.lower()) for term in search_terms]).desc(),
            or_(*[func.lower(DavNationalDrug.brand_name).like(f"{term.lower()}%") for term in search_terms]).desc(),
            or_(*[func.lower(DavNationalDrug.brand_name).like(f"%{term.lower()}%") for term in search_terms]).desc(),
            or_(*[(func.lower(DavNationalDrug.active_ingredient) == term.lower()) for term in search_terms]).desc(),
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
        for term in search_terms:
            fuzzy_cands = matcher.fuzzy_candidate_search(term, top_k=1)
            if fuzzy_cands:
                cand_res = await db.execute(select(DavNationalDrug).where(func.lower(DavNationalDrug.brand_name) == fuzzy_cands[0].lower()).limit(5))
                drugs = cand_res.scalars().all()
                if drugs:
                    break

    if not drugs:
        mono_conds = []
        for term in search_terms:
            t_low = term.lower()
            mono_conds.extend([
                func.lower(ClinicalDrugMonograph.inn) == t_low,
                func.lower(ClinicalDrugMonograph.inn).like(f"{t_low} %"),
                func.lower(ClinicalDrugMonograph.inn).like(f"% {t_low}%"),
                func.lower(ClinicalDrugMonograph.title) == t_low,
                func.lower(ClinicalDrugMonograph.title).like(f"{t_low} %")
            ])
        mono_res = await db.execute(select(ClinicalDrugMonograph).where(or_(*mono_conds)).limit(1))
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
                from app.services.chatbot.output_validator import validate_grounded_reply
                target_keys = [t.lower() for t in search_terms]
                cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
                    rag_res.answer, [c.to_dict() for c in rag_res.citations], target_keys, query=query
                )
                if not is_grounded:
                    return CopilotResponse(
                        intent="CLINICAL_SAFE_ABSTENTION",
                        reply_text=cleaned_reply,
                        legal_basis="Dược Thư Quốc Gia Việt Nam & Cục Quản lý Dược",
                        answer_type="safe_abstention",
                        source_status="insufficient_retrieval_evidence",
                        confidence=0.5,
                        session_id=session.session_id,
                    )
                return CopilotResponse(
                    intent="CLINICAL_AI_CONSULTATION",
                    reply_text=validate_output_guardrail(cleaned_reply, query),
                    legal_basis=rag_res.legal_basis or None,
                    suggested_chips=["Kiểm tra cặp thuốc khác", "Rà soát toàn bộ danh sách thuốc"],
                    session_id=session.session_id, citations=validated_citations,
                    rag_grounded=rag_res.rag_grounded and is_grounded,
                    answer_type="grounded_reference" if (rag_res.rag_grounded and is_grounded) else "safe_abstention",
                    source_status="retrieved_evidence" if (rag_res.rag_grounded and is_grounded) else "insufficient_retrieval_evidence",
                    confidence=rag_res.confidence_score,
                    abstention_reason=None if (rag_res.rag_grounded and is_grounded) else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
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
