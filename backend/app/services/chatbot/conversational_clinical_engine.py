"""
Conversational Clinical NLG Synthesizer.
Transforms raw medical monographs and regulatory facts into seamless, empathetic,
high-IQ clinical dialogues (Med-PaLM 2 / Gemini Health benchmark) with 100% verified grounding.
"""
import re
from typing import Optional, List, Dict, Any
from app.schemas.copilot import (
    CopilotResponse,
    ClinicalSummary,
    StructuredClinicalPayload,
    DrugIdentitySchema,
    DosageMatrixSchema,
    DosageDetailSchema,
    DdiFindingSchema,
)
from app.services.copilot_drug_citation_helper import (
    format_clinical_text,
    build_drug_citation,
    extract_inline_citation_token,
    split_clinical_chunks
)
from app.services.chatbot.smart_chip_engine import generate_smart_clinical_chips
from app.services.clinical_ddi_engine.full_catalog import find_all_interactions_for_drug

def _link_medication_profile_evidence(response: CopilotResponse, monograph: Any) -> CopilotResponse:
    """Attach versioned evidence from the exact database monograph used to compose the reply."""
    # Provenance can support a factual answer, but must never promote an
    # already rejected/unverified response back to a grounded one.
    if response.answer_type == "safe_abstention" or not response.rag_grounded or (
        response.confidence is not None and response.confidence <= 0
    ):
        return response
    if not monograph or not getattr(monograph, "source_id", None) or not getattr(monograph, "source_version", None):
        return response
    fields = ("indications", "adult_dosage", "pediatric_dosage", "contraindications",
              "precautions", "renal_adjustment", "hepatic_adjustment", "pregnancy_warning",
              "adverse_effects", "drug_interactions", "overdose_treatment", "antidote")
    content = "\n".join(f"{field}: {value}" for field in fields
                        if (value := str(getattr(monograph, field, None) or "").strip()))
    if not content:
        return response

    chunk_id = f"monograph:{monograph.id}:profile"
    mono_section = monograph.title or monograph.inn or "Chuyên luận Dược thư"

    citation = next((item for item in response.citations or [] if item.get("document_id") == "dtqg-v2-2015"), None)
    if citation is not None:
        citation.update({
            "chunk_id": chunk_id,
            "source_id": monograph.source_id,
            "source_version": monograph.source_version,
            "section": mono_section,
        })
    else:
        new_citation = {
            "chunk_id": chunk_id,
            "source": monograph.source or "Dược thư Quốc gia Việt Nam",
            "legal_basis": monograph.source or "Dược thư Quốc gia Việt Nam",
            "section": mono_section,
            "excerpt": content[:200],
            "document_id": "dtqg-v2-2015",
            "source_id": monograph.source_id,
            "source_version": monograph.source_version,
        }
        if response.citations is None:
            response.citations = []
        response.citations.append(new_citation)

    response.evidence = [{
        "evidence_id": chunk_id,
        "evidence_type": "document_chunk",
        "source_id": monograph.source_id,
        "source_version": monograph.source_version,
        "chunk_id": chunk_id,
        "source_name": monograph.source or "Dược thư Quốc gia Việt Nam",
        "section": mono_section,
        "content": content,
    }]
    response.rag_grounded = True
    return response

def get_clinical_persona_greeting(user_name: str, user_role: str) -> str:
    role_lower = (user_role or "").lower()
    name_lower = (user_name or "").lower()
    if any(k in role_lower for k in ["doctor", "bac_si", "physician", "bs"]) or any(k in name_lower for k in ["bác", "bs", "dr"]):
        return "Kính gửi Bác sĩ,"
    elif any(k in role_lower for k in ["nurse", "dieu_duong", "dd"]) or any(k in name_lower for k in ["điều dưỡng", "dd"]):
        return "Chào Điều dưỡng,"
    elif any(k in role_lower for k in ["pharmacist", "duoc_si", "ds"]) or any(k in name_lower for k in ["dược", "ds"]):
        return "Kính gửi Dược sĩ lâm sàng,"
    return "Chào Quý đồng nghiệp y tế,"


def format_hierarchical_dosage(
    raw_adult: str,
    raw_pediatric: str,
    is_detailed: bool = False,
    target_audience: Optional[str] = None
) -> list[str]:
    """Định dạng Liều dùng & Cách dùng phân cấp chuẩn Y khoa, chống lặp prefix đối tượng và rách dòng."""
    clean_ad = (raw_adult or "").strip()
    clean_pd = (raw_pediatric or "").strip()

    # 1. Khử lặp: Nếu adult_dosage chứa cả phần nhi khoa do cấu trúc CSDL cũ
    if "Trẻ em:" in clean_ad:
        ad_part, _, ped_part = clean_ad.partition("Trẻ em:")
        clean_ad = ad_part.strip()
        if not clean_pd or len(clean_pd) < 50:
            clean_pd = ped_part.strip()

    if target_audience == "adult":
        clean_pd = ""
    elif target_audience == "pediatric":
        clean_ad = ""

    def clean_bullet(text: str) -> str:
        text = re.sub(r'^(?:Người lớn|Trẻ em|Cách dùng|Liều lượng):\s*', '', text, flags=re.IGNORECASE)
        text = text.strip(' \t\n;,-')
        if text and not text.endswith(('.', '!', '?', ':')):
            text += '.'
        return text

    lines = []

    # 2. Xử lý liều Người lớn
    if clean_ad and clean_ad != "Tuân thủ chỉ định điều trị":
        parts = re.split(r'(?:Liều lượng:|Người lớn:)', clean_ad, maxsplit=1)
        general_admin = parts[0].replace('Cách dùng:', '').strip() if len(parts) > 1 and 'Cách dùng:' in parts[0] else ''
        dose_body = parts[1].strip() if len(parts) > 1 else clean_ad

        if is_detailed and general_admin and len(general_admin) > 20:
            gen_chunks = [clean_bullet(c) for c in split_clinical_chunks(general_admin) if len(clean_bullet(c)) > 15]
            if gen_chunks:
                lines.append("- **Cách dùng chung:**")
                for gc in gen_chunks[:3]:
                    lines.append(f"  - {gc}")

        adult_chunks = [clean_bullet(c) for c in split_clinical_chunks(dose_body) if len(clean_bullet(c)) > 5]

        oral_items, rectal_items, iv_items, other_items = [], [], [], []
        for c in adult_chunks:
            c_low = c.lower()
            clean_c = re.sub(r'^(?:Liều uống thường dùng là|Liều uống:|Đường uống:|Uống:)\s*', '', c, flags=re.IGNORECASE).strip()
            if 'liều uống' in c_low or 'đường uống' in c_low or c_low.startswith('uống'):
                oral_items.append(clean_c)
            elif 'trực tràng' in c_low or 'đặt' in c_low:
                clean_rectal = re.sub(r'^(?:Đặt trực tràng:\s*)', '', c, flags=re.IGNORECASE).strip()
                rectal_items.append(clean_rectal)
            elif 'tĩnh mạch' in c_low or 'tiêm' in c_low or 'truyền' in c_low:
                clean_iv = re.sub(r'^(?:Truyền tĩnh mạch trong \d+ phút:\s*|Truyền tĩnh mạch:\s*|Tiêm tĩnh mạch:\s*)', '', c, flags=re.IGNORECASE).strip()
                iv_items.append(clean_iv)
            elif 'người lớn' not in c_low and 'liều lượng' not in c_low and 'cách dùng' not in c_low:
                other_items.append(c)

        if oral_items or rectal_items or iv_items:
            lines.append("- **Người lớn:**")
            if oral_items:
                lines.append(f"  - **Đường uống:** {' '.join(oral_items)}")
            if rectal_items:
                lines.append(f"  - **Đặt trực tràng:** {' '.join(rectal_items)}")
            if iv_items:
                lines.append(f"  - **Truyền tĩnh mạch (15 phút):** {' '.join(iv_items)}")
            for ot in other_items:
                if "không được vượt quá" in ot.lower() or "tối đa" in ot.lower():
                    lines.append(f"  - *Lưu ý an toàn liều tối đa:* {ot}")
                else:
                    lines.append(f"  - {ot}")
        elif adult_chunks:
            lines.append("- **Người lớn:**")
            bullets = adult_chunks if is_detailed else adult_chunks[:2]
            for b in bullets:
                lines.append(f"  - {b}")

    # 3. Xử lý liều Nhi khoa
    if clean_pd and clean_pd != "Tính liều theo cân nặng (mg/kg) hoặc diện tích da":
        lines.append("- **Trẻ em:**")
        ped_chunks = [clean_bullet(c) for c in split_clinical_chunks(clean_pd) if len(clean_bullet(c)) > 5]

        ped_oral, ped_rectal, ped_iv, ped_other = [], [], [], []
        current_route = "oral"
        for c in ped_chunks:
            c_low = c.lower()
            if 'đặt trực tràng' in c_low or 'đường trực tràng' in c_low:
                current_route = "rectal"
            elif 'truyền tĩnh mạch' in c_low or 'tiêm tĩnh mạch' in c_low:
                current_route = "iv"
            elif 'uống' in c_low or 'đau, sốt' in c_low or 'đau sau phẫu thuật' in c_low:
                current_route = "oral"

            clean_c = re.sub(r'^(?:Đau,\s*sốt:\s*|Uống:\s*|Đặt trực tràng:\s*|Đường trực tràng:\s*|Truyền tĩnh mạch trong \d+ phút:\s*|Truyền tĩnh mạch:\s*|Đau sau phẫu thuật:\s*|Sốt sau khi tiêm chủng ở trẻ nhỏ:\s*)', '', c, flags=re.IGNORECASE).strip()
            clean_c = re.sub(r';\s*Trẻ\s*(?:em)?\s*', '; ', clean_c, flags=re.IGNORECASE)
            clean_c = re.sub(r'^Trẻ\s*(?:em)?\s*', '', clean_c, flags=re.IGNORECASE).strip()
            if not clean_c or len(clean_c) < 5 or clean_c.lower() in ("liều được tính theo cân nặng.", "liều được tính theo cân nặng:"):
                continue

            if current_route == "oral":
                ped_oral.append(clean_c)
            elif current_route == "rectal":
                ped_rectal.append(clean_c)
            elif current_route == "iv":
                ped_iv.append(clean_c)
            else:
                ped_other.append(clean_c)

        if ped_oral or ped_rectal or ped_iv:
            if ped_oral:
                items = ped_oral if is_detailed else ped_oral[:2]
                lines.append("  - **Đau & Sốt (Đường uống):**")
                for it in items:
                    lines.append(f"    - {it}")
            if ped_rectal and is_detailed:
                lines.append("  - **Đặt trực tràng:**")
                for it in ped_rectal:
                    lines.append(f"    - {it}")
            if ped_iv and is_detailed:
                lines.append("  - **Truyền tĩnh mạch (15 phút - tính theo cân nặng):**")
                for it in ped_iv:
                    lines.append(f"    - {it}")
            for ot in ped_other:
                lines.append(f"  - {ot}")
        else:
            bullets = ped_chunks if is_detailed else ped_chunks[:2]
            for b in bullets:
                lines.append(f"  - {b}")

    return lines


def format_hierarchical_special_populations(renal: str, hepatic: str, preg: str, is_detailed: bool = False) -> list[str]:
    """Định dạng phân cấp Thận trọng & Đối tượng đặc biệt, gom cụm theo cơ quan."""
    lines = []
    clean_renal = (renal or "").strip()
    if clean_renal and "chưa có khuyến cáo" not in clean_renal.lower():
        renal_chunks = split_clinical_chunks(clean_renal)
        if len(renal_chunks) == 1:
            lines.append(f"  - **Hiệu chỉnh suy thận:** {renal_chunks[0]}")
        elif len(renal_chunks) > 1:
            lines.append("  - **Hiệu chỉnh suy thận:**")
            bullets = renal_chunks if is_detailed else renal_chunks[:2]
            for b in bullets:
                lines.append(f"    + {b}")

    clean_hepatic = (hepatic or "").strip()
    if clean_hepatic and clean_hepatic != "None" and "chưa có khuyến cáo" not in clean_hepatic.lower():
        hep_chunks = split_clinical_chunks(clean_hepatic)
        if len(hep_chunks) == 1:
            lines.append(f"  - **Hiệu chỉnh suy gan:** {hep_chunks[0]}")
        elif len(hep_chunks) > 1:
            lines.append("  - **Hiệu chỉnh suy gan:**")
            bullets = hep_chunks if is_detailed else hep_chunks[:2]
            for b in bullets:
                lines.append(f"    + {b}")

    clean_preg = (preg or "").strip()
    if clean_preg and "chỉ dùng khi lợi ích" not in clean_preg.lower():
        preg_chunks = split_clinical_chunks(clean_preg)
        if len(preg_chunks) == 1:
            lines.append(f"  - **Phụ nữ mang thai & cho con bú:** {preg_chunks[0]}")
        elif len(preg_chunks) > 1:
            lines.append("  - **Phụ nữ mang thai & cho con bú:**")
            bullets = preg_chunks if is_detailed else preg_chunks[:2]
            for b in bullets:
                lines.append(f"    + {b}")

    return lines


async def build_fluent_drug_profile_response(
    matched_drug: Any,
    monograph: Any,
    stock: int,
    location: str,
    query: str,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """Xây dựng phản hồi tra cứu thuốc liền mạch, súc tích chuẩn PaperQA2 Evidence Synthesis."""
    greeting = get_clinical_persona_greeting(user_name, user_role)
    clean_name = matched_drug.brand_name.split("(")[0].strip()
    active_ing = matched_drug.active_ingredient or ""
    q_lower = query.lower()

    # Bóc tách dữ liệu chuẩn DĐVN V
    ind = (monograph.indications if monograph and monograph.indications else None) or matched_drug.indications or ""
    adult_d = (monograph.adult_dosage if monograph and monograph.adult_dosage else None) or matched_drug.adult_dosage or ""
    ped_d = (monograph.pediatric_dosage if monograph and monograph.pediatric_dosage else None) or matched_drug.pediatric_dosage or ""
    contra = (monograph.contraindications if monograph and monograph.contraindications else None) or matched_drug.contraindications or ""
    renal = (monograph.renal_adjustment if monograph and monograph.renal_adjustment else None) or matched_drug.renal_adjustment or ""
    preg = (monograph.pregnancy_warning if monograph and monograph.pregnancy_warning else None) or matched_drug.pregnancy_warning or ""
    adr = (monograph.adverse_effects if monograph and monograph.adverse_effects else None) or matched_drug.adverse_effects or ""
    # Source identity must come from the exact record used for the answer. A
    # second name-based lookup cannot prove that its fields match this record.
    artifact_monograph = None
    has_monograph_provenance = bool(
        monograph
        and getattr(monograph, "source_id", None)
        and getattr(monograph, "source_version", None)
    )

    has_real_clinical_data = bool(monograph and (ind or adult_d or contra)) or bool(ind or adult_d or contra)
    if not has_real_clinical_data:
        # Monograph Quality Gate: Chuyển tiếp ngay xuống Hybrid RAG khi không có chuyên luận CSDL
        from app.services.rag import execute_clinical_rag
        rag_res = await execute_clinical_rag(f"Thông tin thuốc {clean_name} {active_ing} chỉ định liều dùng", user_role=user_role)
        if rag_res and rag_res.answer and rag_res.confidence_score > 0.4:
            from app.security.guardrails import validate_output_guardrail
            return CopilotResponse(
                intent="MEDICATION_SAFETY_PROFILE",
                reply_text=validate_output_guardrail(rag_res.answer, query),
                card=None,
                legal_basis=rag_res.legal_basis or "Dược Thư Quốc Gia Việt Nam",
                suggested_chips=[f"Chỉ định {clean_name}", f"Liều dùng {clean_name}", f"Tác dụng phụ {clean_name}", "Kiểm tra tương tác thuốc"],
                session_id=session_id or "",
                active_medication_name=clean_name,
                answer_type="grounded_reference",
                source_status="retrieved_evidence",
                confidence=rag_res.confidence_score,
                rag_grounded=True,
                citations=[c.to_dict() for c in rag_res.citations],
                evidence=list(getattr(rag_res, "evidence", []) or [])
            )

    # Tra cứu tương tác QĐ 5948
    ddis = find_all_interactions_for_drug(clean_name)
    top_ddi_list = []
    seen = set()
    for d in ddis:
        p = d.get("partner")
        if p and p not in seen:
            seen.add(p)
            top_ddi_list.append(f"**{p}** ({d.get('severity')}: {d.get('consequence')})")

    ddi_summary = "; ".join(top_ddi_list[:3])

    source_str = (monograph.source if monograph and monograph.source else matched_drug.clinical_source) or ""

    # RAG Retrieval: Lấy chunks thực tế từ CSDL RAG FTS
    from app.services.rag.hybrid_retriever import HybridRetriever
    from app.services.rag.citation_grounder import build_claim_citations
    from app.services.rag.paperqa_synthesizer import synthesize_grounded_clinical_response

    retriever = HybridRetriever()
    search_q = f"{clean_name} {active_ing}"
    retrieved_chunks = await retriever.retrieve_async(search_q, top_k=3)

    relevant_chunks = [
        r for r in retrieved_chunks
        if clean_name.lower() in r.chunk.title.lower() or active_ing.lower() in r.chunk.title.lower()
        or clean_name.lower() in r.chunk.content.lower() or active_ing.lower() in r.chunk.content.lower()
    ]
    direct_chunks = [
        r for r in relevant_chunks
        if r.chunk.title.casefold().strip().startswith(active_ing.casefold())
        or r.chunk.page_or_section.casefold().strip().startswith(active_ing.casefold())
    ]
    if direct_chunks:
        relevant_chunks = direct_chunks
    # FTS can rank incidental mentions (for example methionine as paracetamol's antidote)
    # above the drug's own monograph. Ensure the matching source chunk is considered.
    query_facets = []
    if any(term in q_lower for term in ("liều", "dosage", "dose")):
        query_facets.append("dosage")
    if any(term in q_lower for term in ("chống chỉ định", "chong chi dinh")):
        query_facets.append("safety")
    if any(term in q_lower for term in ("tương tác", "tac dung phu", "quá liều", "ngo doc")):
        query_facets.append("inter")
    for chunk in retriever.all_chunks:
        title = chunk.title.casefold()
        has_direct_drug = clean_name.casefold() in title or active_ing.casefold() in title
        if has_direct_drug and any(facet in chunk.chunk_id.casefold() for facet in query_facets):
            if chunk.source_version and all(item.chunk.chunk_id != chunk.chunk_id for item in relevant_chunks):
                from app.services.rag.types import RetrievedChunk
                relevant_chunks.append(RetrievedChunk(chunk=chunk, score=0.0, match_reasons=["direct monograph subject and requested facet"]))

    citations = []
    if relevant_chunks:
        citations = [c.to_dict() for c in build_claim_citations(relevant_chunks)]
        # Do not claim indexed clinical fields are DB-grounded unless the DB row
        # itself has an independently recorded source artifact/version.
    if not has_monograph_provenance:
        relevant_chunks = []
        citations = []

    if not citations and has_monograph_provenance:
        citations = [build_drug_citation(matched_drug, monograph, source_str)]
    else:
        citations = [c for c in citations if c.get("chunk_id") in {r.chunk.chunk_id for r in relevant_chunks if r.chunk.source_version}]

    linked_evidence = []
    cited_chunk_ids = {c.get("chunk_id") for c in citations if isinstance(c, dict) and c.get("chunk_id")}
    for retrieved in relevant_chunks:
        chunk = retrieved.chunk
        if chunk.chunk_id not in cited_chunk_ids:
            continue
        linked_evidence.append({
            "evidence_id": f"document:{chunk.chunk_id}",
            "evidence_type": "document_chunk",
            "source_id": chunk.source_id or chunk.source_doc,
            "source_version": chunk.source_version,
            "chunk_id": chunk.chunk_id,
            "source_name": chunk.source_doc,
            "section": chunk.page_or_section,
            "content": chunk.content,
        })

    is_detailed = any(w in q_lower for w in [
        "chi tiết", "chi tiet", "toàn văn", "toan van", "đầy đủ", "day du",
        "toàn bộ", "toan bo", "đầy đủ nhất", "chuyên luận"
    ])

    prec = (monograph.precautions if monograph and monograph.precautions else None) or getattr(matched_drug, "precautions", None) or ""
    overdose = (monograph.overdose_treatment if monograph and monograph.overdose_treatment else None) or getattr(monograph, "antidote", None) or ""
    hepatic = (monograph.hepatic_adjustment if monograph and monograph.hepatic_adjustment else None) or ""

    drug_header = clean_name if (active_ing.lower() in clean_name.lower() or clean_name.lower() in active_ing.lower()) else f"{clean_name} ({active_ing})"
    token = extract_inline_citation_token(source_str) if source_str else ""

    # 1. Định danh thuốc
    header_block = f"{greeting} gửi thông tin chuyên môn về **{drug_header}**:\n\n"
    if matched_drug.active_ingredient:
        header_block += f"• **Hoạt chất chính:** **{matched_drug.active_ingredient}**"
        if matched_drug.dosage_form:
            header_block += f" ({matched_drug.dosage_form})"

    sections = [header_block]

    # 2. Chỉ định
    clean_ind = str(ind).strip()
    if clean_ind and clean_ind != "Theo đơn chỉ định chuyên khoa":
        ind_chunks = split_clinical_chunks(clean_ind)
        ind_bullets = ind_chunks if is_detailed else ind_chunks[:2]
        if ind_bullets:
            sub = "\n".join(f"  - {b}" for b in ind_bullets)
            sections.append(f"• **Chỉ định chính:**\n{sub}")

    # 3. Liều dùng & Cách dùng
    dose_lines = format_hierarchical_dosage(adult_d, ped_d, is_detailed=is_detailed)
    if dose_lines:
        sections.append("• **Liều dùng & Cách dùng:**\n" + "\n".join(dose_lines))

    # 4. Chống chỉ định
    clean_contra = str(contra or "").strip()
    if clean_contra:
        contra_chunks = split_clinical_chunks(clean_contra)
        contra_bullets = contra_chunks if is_detailed else contra_chunks[:2]
        if contra_bullets:
            sub = "\n".join(f"  - {b}" for b in contra_bullets)
            sections.append(f"• **Chống chỉ định:**\n{sub}")

    # 5. Thận trọng & Đối tượng đặc biệt
    special_lines = format_hierarchical_special_populations(renal, hepatic, preg, is_detailed=is_detailed)
    if special_lines:
        sections.append("• **Thận trọng & Đối tượng đặc biệt:**\n" + "\n".join(special_lines))

    # 5b. Thận trọng cảnh báo bổ sung (nếu tra cứu chi tiết)
    clean_prec = str(prec).strip()
    prec_bullets = []
    if is_detailed and clean_prec and clean_prec != "None":
        prec_bullets = split_clinical_chunks(clean_prec)
        if prec_bullets:
            sections.append("• **Cảnh báo & Thận trọng khi sử dụng:**\n" + "\n".join(f"  - {b}" for b in prec_bullets))

    # 5c. Tác dụng không mong muốn ADR (nếu tra cứu chi tiết)
    clean_adr = str(adr).strip()
    if is_detailed and clean_adr and clean_adr != "None" and "Theo dõi các phản ứng" not in clean_adr:
        adr_raw_bullets = split_clinical_chunks(clean_adr)
        adr_bullets = []
        for c in adr_raw_bullets:
            c_low = c.lower()
            # Khử trùng lặp: Cảnh báo narrative SJS/TEN nếu đã có trong Cảnh báo & Thận trọng
            if "stevens-johnson" in c_low and ("tử vong" in c_low or "ngừng dùng thuốc" in c_low) and ("ít gặp" not in c_low and "hiếm gặp" not in c_low):
                if prec_bullets and any("stevens-johnson" in p.lower() for p in prec_bullets):
                    continue
            adr_bullets.append(c)

        if adr_bullets:
            sections.append("• **Tác dụng không mong muốn (ADR):**\n" + "\n".join(f"  - {b}" for b in adr_bullets))

    # 6. Tương tác đáng chú ý
    if top_ddi_list:
        ddi_items = top_ddi_list if is_detailed else top_ddi_list[:3]
        sections.append("• **Tương tác đáng chú ý (QĐ 5948):**\n" + "\n".join(f"  - {d}" for d in ddi_items))

    # 6b. Quá liều & Xử trí (nếu tra cứu chi tiết)
    clean_od = str(overdose).strip()
    if is_detailed and clean_od and clean_od != "None":
        od_bullets = split_clinical_chunks(clean_od)
        if od_bullets:
            sections.append("• **Quá liều & Hướng dẫn xử trí cấp cứu:**\n" + "\n".join(f"  - {b}" for b in od_bullets))

    # 7. Tồn kho bệnh viện nếu được hỏi
    if any(w in q_lower for w in ["tồn kho", "còn thuốc", "số lượng", "trong kho", "ở đâu", "còn bao nhiêu"]):
        sections.append(f"• **Tồn kho nội viện:** Hiện còn {stock} {matched_drug.standard_unit} (Vị trí kho: `{location}`).")

    # 8. Kết luận với duy nhất 1 tag nguồn ở cuối phản hồi
    reply_text = "\n\n".join(sections) + (f"\n\nNguồn: {token}" if token else "")
    has_factual_clinical_content = any((ind, adult_d, ped_d, contra, renal, preg, adr, overdose, hepatic)) or bool(top_ddi_list)
    source_chunk_ids = {r.chunk.chunk_id for r in retrieved_chunks if r.chunk.source_version}
    has_source_linked_chunk = bool(source_chunk_ids.intersection(cited_chunk_ids))
    has_source_linked_monograph = bool(
        has_monograph_provenance
        and citations
        and any(
            citation.get("source_id") == monograph.source_id
            and citation.get("source_version") == monograph.source_version
            for citation in citations
        )
    )
    sourced = bool(has_source_linked_monograph or has_source_linked_chunk) or not has_factual_clinical_content
    chips = generate_smart_clinical_chips(query, drug_name=clean_name, active_ingredient=active_ing)

    # Xây dựng Structured Output Contract
    summary_obj = None
    payload_obj = None
    if sourced:
        headline = f"Thông tin Dược thư: {drug_header}"
        takeaway = f"Hoạt chất {active_ing}." if active_ing else headline
        if clean_ind and clean_ind != "Theo đơn chỉ định chuyên khoa":
            takeaway += f" Chỉ định: {clean_ind[:120]}"
        summary_obj = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency="routine")

        adult_schema = DosageDetailSchema(standard_dose=str(adult_d).strip()) if adult_d else None
        ped_schema = DosageDetailSchema(standard_dose=str(ped_d).strip()) if ped_d else None
        dosage_matrix = DosageMatrixSchema(adult=adult_schema, pediatric=ped_schema) if (adult_schema or ped_schema) else None

        ind_list = split_clinical_chunks(clean_ind) if (clean_ind and clean_ind != "Theo đơn chỉ định chuyên khoa") else []
        contra_list = split_clinical_chunks(clean_contra) if clean_contra else []
        adr_list = split_clinical_chunks(clean_adr) if (clean_adr and clean_adr != "None") else []
        prec_list = split_clinical_chunks(clean_prec) if (clean_prec and clean_prec != "None") else []

        payload_obj = StructuredClinicalPayload(
            drug_identity=DrugIdentitySchema(
                brand_name=clean_name,
                inn=active_ing or None,
                national_code=matched_drug.national_code or None,
                sdk=matched_drug.national_code or None,
                drug_class=matched_drug.group or None,
                dosage_form=matched_drug.dosage_form or None,
            ),
            dosage_matrix=dosage_matrix,
            indications=ind_list,
            contraindications=contra_list,
            adverse_effects=adr_list,
            special_warnings=prec_list,
        )

    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=reply_text if sourced else "Không thể xác minh nguồn hiện hành cho nội dung chuyên khoa này; vui lòng đối chiếu tài liệu đã được phê duyệt.",
        clinical_summary=summary_obj,
        clinical_data=payload_obj,
        legal_basis=source_str,
        suggested_chips=chips,
        session_id=session_id,
        answer_type="medication_profile" if sourced else "safe_abstention",
        source_status="exact_match" if sourced else "evidence_provenance_missing",
        confidence=1.0 if sourced else 0.0,
        rag_grounded=sourced,
        abstention_reason=None if sourced else "Không xác minh được evidence có provenance cho nội dung thuốc",
        citations=citations,
        evidence=linked_evidence + ([{
            "evidence_id": f"monograph:{monograph.id}",
            "evidence_type": "document_chunk",
            "source_id": monograph.source_id,
            "source_version": monograph.source_version,
            "chunk_id": citations[0].get("chunk_id"),
            "source_name": source_str,
            "section": monograph.title,
            "content": "\n".join(
                str(getattr(monograph, field, None) or "")
                for field in ("indications", "adult_dosage", "pediatric_dosage", "contraindications", "precautions", "renal_adjustment", "hepatic_adjustment", "pregnancy_warning", "adverse_effects", "drug_interactions", "overdose_treatment", "antidote")
                if getattr(monograph, field, None)
            ),
        }] if sourced and has_source_linked_monograph else [])
    )
    return _link_medication_profile_evidence(response, monograph)

# ==============================================================================
# HỆ TRI THỨC LÂM SÀNG CHUYÊN SÂU (DYNAMIC SPECIALTY KNOWLEDGE REGISTRY)
# ==============================================================================
from app.services.chatbot.specialty_knowledge_registry import SpecialtyKnowledgeRegistry


def find_clinical_specialty_consultation(query: str) -> Optional[Dict[str, Any]]:
    """Tra cứu tri thức chuyên khoa lâm sàng động từ SpecialtyKnowledgeRegistry & Hybrid RAG."""
    return SpecialtyKnowledgeRegistry.get_instance().find_consultation(query)


def __getattr__(name: str) -> Any:
    """Đảm bảo tương thích ngược 100% cho các module legacy cần truy cập danh mục."""
    if name == "SPECIALTY_CLINICAL_KNOWLEDGE":
        return SpecialtyKnowledgeRegistry.get_instance().get_knowledge_items()
    if name == "TOPIC_ANCHORS":
        return SpecialtyKnowledgeRegistry.get_instance().get_topic_anchors()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

async def synthesize_specialty_response(
    query: str,
    knowledge: Dict[str, Any],
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    from app.services.rag.paperqa_synthesizer import synthesize_grounded_clinical_response

    topic = knowledge.get("topic", "Hướng dẫn Lâm sàng")
    bluf = knowledge.get("bluf", "")
    details_lines = "\n".join(knowledge.get("details", []))
    warnings = knowledge.get("warnings", "")
    legal = knowledge.get("legal", "Dược thư Quốc gia Việt Nam DĐVN V & Hướng dẫn Bộ Y tế")

    evidence_context = (
        f"### Hướng Dẫn Dược Lâm Sàng: {topic}\n\n"
        f"**Kết luận lâm sàng chính (Core Clinical Guidance):**\n{bluf}\n\n"
        f"**Chi tiết thực hành & Cơ sở dược lý học:**\n{details_lines}\n\n"
        f"**Cảnh báo an toàn quan trọng:** {warnings}"
    )

    synth_res = await synthesize_grounded_clinical_response(
        query=query,
        evidence_context=evidence_context,
        source_label=legal,
        user_role=user_role,
        user_name=user_name
    )

    chips = generate_smart_clinical_chips(query)
    specialty_source = SpecialtyKnowledgeRegistry.get_instance().get_source_metadata()
    specialty_content = "\n".join([str(bluf or ""), *[str(line) for line in knowledge.get("details", [])], str(warnings or "")]).strip()
    citation_chunk_id = f"specialty:{specialty_source.get('source_id') or 'unavailable'}:{topic}"
    sourced = bool(specialty_source.get("source_id") and specialty_source.get("source_version") and specialty_content)
    is_legal_topic = any(k in topic.lower() for k in ["thông tư", "quy chế", "quy định", "nghị định", "luật dược"])
    is_onco_topic = any(k in topic.lower() for k in ["ung thư", "u bướu", "oncology"])
    is_consultation = any(k in query.lower() for k in ["biểu hiện", "triệu chứng", "của gì", "là gì", "thế nào", "như thế nào", "kiêng gì", "dùng thuốc nào", "nên dùng", "sinh hoạt"])
    reply_text = synth_res.conversational_answer
    if is_onco_topic:
        chosen_intent = "ONCOLOGY_SPECIALTY_GUIDANCE"
        if "TƯ VẤN CHUYÊN KHOA UNG BƯỚU" not in reply_text:
            reply_text = f"### 🎗️ TƯ VẤN CHUYÊN KHOA UNG BƯỚU (Hội đồng Ung bướu & Giảm đau WHO)\n\n" + reply_text
    elif is_legal_topic:
        chosen_intent = "LEGAL_GUIDANCE"
    elif is_consultation:
        chosen_intent = "CLINICAL_AI_CONSULTATION"
    else:
        chosen_intent = "MEDICATION_SAFETY_PROFILE"

    spec_summary = ClinicalSummary(
        headline=f"Hướng dẫn chuyên khoa: {topic}",
        key_takeaway=reply_text[:160].replace("\n", " "),
        urgency="routine"
    ) if sourced else None
    spec_payload = StructuredClinicalPayload(
        special_warnings=[topic]
    ) if sourced else None

    return CopilotResponse(
        intent=chosen_intent,
        reply_text=reply_text,
        clinical_summary=spec_summary,
        clinical_data=spec_payload,
        legal_basis=legal,
        suggested_chips=chips,
        session_id=session_id,
        answer_type="grounded_reference" if sourced else "safe_abstention",
        source_status=synth_res.source_status,
        confidence=synth_res.grounded_confidence if sourced else 0.0,
        rag_grounded=sourced,
        citations=[{
            "source": legal,
            "title": topic,
            "section": "Chuyên luận Hướng dẫn Lâm sàng",
            "legal_basis": legal,
            "chunk_id": citation_chunk_id,
        }] if sourced else [],
        evidence=[{
            "evidence_id": citation_chunk_id,
            "evidence_type": "document_chunk",
            **specialty_source,
            "chunk_id": citation_chunk_id,
            "source_name": legal,
            "section": topic,
            "content": specialty_content,
        }] if sourced else []
    )
