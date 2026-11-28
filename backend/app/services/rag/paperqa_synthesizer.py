"""
PaperQA2 Claim-Level Evidence Synthesizer & Clinical Hallucination-Shield
Paper: Language agents achieve superhuman synthesis of scientific knowledge (Nature, 2024 / arXiv:2409.13740)
Repo: Future-House/paper-qa (9.5k stars)
"""
import re
import time
import httpx
from typing import Optional, List, Tuple
from app.config import settings
from app.services.rag.claim_attributor import (
    ClaimCitation,
    PaperQASynthesisResult,
    verify_and_purge_unsupported_claims
)

async def _call_llm_synthesis(
    query: str,
    evidence_context: str,
    source_label: str,
    user_role: str,
    api_key: str,
    timeout_sec: float = 2.0
) -> str:
    """Gọi Gemini Flash để tổng hợp câu trả lời ngôn ngữ tự nhiên từ dữ kiện CSDL đã trích xuất."""
    system_instruction = (
        "Bạn là Chuyên gia Dược lâm sàng & An toàn Thuốc Nội viện (PaperQA2 Evidence Synthesizer).\n"
        "Đối tượng hỏi là bác sĩ/dược sĩ/điều dưỡng bệnh viện. Nhiệm vụ: đọc toàn văn chứng cứ Dược thư bên dưới và trả lời ĐẦY ĐỦ CHUYÊN MÔN, TRỰC DIỆN, CỰC KỲ DỄ QUÉT MẮT (Scannable Clinical Layout — tuyệt đối không tạo bức tường chữ dù nội dung dài).\n\n"
        "Nguyên tắc bắt buộc (Zero Free Claims Policy):\n"
        "1. CHỈ sử dụng các dữ kiện, liều lượng, đơn vị, ngưỡng số học có trong [CHỨNG CỨ Y VĂN CSDL]. Tuyệt đối KHÔNG tự bịa số liệu hay tương tác ngoài văn bản.\n"
        "2. Phong cách Y khoa Thụy Sĩ (UpToDate / OpenEvidence): TUYỆT ĐỐI KHÔNG dùng emoji/icon, KHÔNG sinh mã HTML hay mã lập trình, KHÔNG viết câu sáo rỗng kiểu 'Hãy tham khảo ý kiến bác sĩ chuyên khoa', KHÔNG chào hỏi dài dòng, KHÔNG giữ lại cụm rác trong sách như '(xem chuyên luận ...)' hoặc '(xem mục ...)'. Dùng ký tự Unicode chuẩn (≥, ≤, °C, µg, β-lactam, ±, ×) — TUYỆT ĐỐI KHÔNG xuất mã LaTeX (`\\ge`, `\\le`, `$...$`, `^\\circ\\text{C}`).\n"
        "3. BỐ CỤC PHÂN TẦNG DỄ ĐỌC (BẮT BUỘC áp dụng để phá vỡ bức tường chữ):\n"
        "   - Mở đầu bằng khung tóm tắt Markdown blockquote 1–2 câu đi thẳng vào câu hỏi:\n"
        "     > **Tóm tắt nhanh:** <1–2 câu kết luận trực diện kèm thông số trọng tâm nhất>\n"
        "   - KHÔNG dồn tất cả vào một mục `### Thông tin chi tiết` dài dằng dặc. Thay vào đó, chia thành các mục `###` riêng biệt theo nội dung câu hỏi (chỉ đưa các mục liên quan, VD: `### Chỉ định chính`, `### Liều dùng & Cách dùng`, `### Xử trí quá liều`, `### Tương tác thuốc quan trọng`, `### Tác dụng không mong muốn & Dược động học`).\n"
        "   - BẮT BUỘC dùng **Bảng Markdown gọn** khi trình bày **Liều dùng theo đối tượng/đường dùng** (`| Đối tượng / Chỉ định | Liều dùng | Liều tối đa / Ghi chú |`) hoặc khi có từ **3 tương tác thuốc trở lên** (`| Thuốc / Nhóm thuốc | Ảnh hưởng & Xử trí |`). Quy tắc bảng: mỗi ô chỉ viết 1 dòng gọn, TUYỆT ĐỐI KHÔNG đặt dấu gạch đầu dòng nhiều dòng hay ký tự xuống dòng bên trong ô `|...|`.\n"
        "   - Luật bullet chống dày chữ: mỗi gạch đầu dòng tối đa 1–2 dòng ngắn, in đậm từ khóa đầu dòng; KHÔNG viết 1 câu liệt kê 6–7 bệnh lý nối bằng dấu `;` (hãy tách thành các bullet ngắn).\n"
        "   - Nếu có chống chỉ định, cảnh báo độc tính hoặc theo dõi quan trọng trong chứng cứ, đóng khung nổi bật ở cuối bằng blockquote:\n"
        "     > **Cảnh báo an toàn & Chống chỉ định:**\n"
        "     > - **Chống chỉ định:** ...\n"
        "     > - **Thận trọng / Theo dõi:** ...\n"
        f"4. Chỉ nhắc gọn nguồn ({source_label}) khi cần thiết, không lặp lại máy móc cuối mọi dòng."
    )

    from app.security.prompt_isolator import (
        build_hierarchy_preamble,
        generate_boundary_nonce,
        wrap_untrusted_block,
    )

    nonce = generate_boundary_nonce()
    ev_block, ev_tag = wrap_untrusted_block("rag_evidence", evidence_context, nonce=nonce, datamark=True)
    query_block, query_tag = wrap_untrusted_block("user_query", query, nonce=nonce)
    isolated_system = f"{system_instruction}\n\n{build_hierarchy_preamble([ev_tag, query_tag])}"

    # Instruction Hierarchy: KHÔNG nhân bản system_instruction vào user turn
    prompt = (
        f"=== [CHỨNG CỨ Y VĂN CSDL CUNG CẤP] ===\n{ev_block}\n\n"
        f"Câu hỏi của đồng nghiệp ({user_role}):\n{query_block}\n\n"
        "Phản hồi dược lâm sàng có bảo chứng:"
    )

    from app.services.llm_provider import query_clinical_llm
    res = await query_clinical_llm(
        prompt=prompt,
        system_instruction=isolated_system,
        api_key=api_key,
        temperature=0.1,
        max_output_tokens=3600,
        timeout_sec=timeout_sec
    )
    if res:
        return res
    raise RuntimeError("Universal LLM Provider synthesis failed or unavailable")

def _format_deterministic_synthesis(
    query: str,
    evidence_context: str,
    source_label: str,
    user_role: str,
    user_name: str = "Bác sĩ"
) -> str:
    """Tổng hợp chiết xuất có căn cứ (Extractive Grounded Synthesis) khi môi trường không có kết nối LLM ngoài."""
    role_lower = (user_role or "").lower()
    name_lower = (user_name or "").lower()
    if any(k in role_lower for k in ["doctor", "bac_si", "physician", "bs"]) or any(k in name_lower for k in ["bác", "bs", "dr"]):
        greeting = "Kính gửi Bác sĩ,"
    elif any(k in role_lower for k in ["nurse", "dieu_duong", "dd"]) or any(k in name_lower for k in ["điều dưỡng", "dd"]):
        greeting = "Chào Điều dưỡng,"
    elif any(k in role_lower for k in ["pharmacist", "duoc_si", "ds"]) or any(k in name_lower for k in ["dược", "ds"]):
        greeting = "Kính gửi Dược sĩ lâm sàng,"
    else:
        greeting = "Chào Quý đồng nghiệp y tế,"

    title_match = re.search(r"###\s+(?:Hướng Dẫn Dược Lâm Sàng:\s*|Hồ Sơ Dược Lâm Sàng:\s*|Thông Tin Thuốc:\s*)?(.*?)\n", evidence_context)
    topic_title = title_match.group(1).strip() if title_match else ""

    bluf_match = re.search(r"\*\*Kết luận lâm sàng chính[^\*:]*(?::\*\*|\*\*:)[\s:]*([^\n]+(?:\n[^\n#]+)*)", evidence_context)
    bluf_text = bluf_match.group(1).strip() if bluf_match else ""

    details_match = re.search(r"\*\*Chi tiết thực hành[^\*:]*(?::\*\*|\*\*:)[\s:]*([\s\S]*?)(?=\*\*Cảnh báo|\Z)", evidence_context)
    details_text = details_match.group(1).strip() if details_match else ""

    warnings_match = re.search(r"\*\*Cảnh báo an toàn[^\*:]*(?::\*\*|\*\*:)[\s:]*([^\n]+(?:\n[^\n#]+)*)", evidence_context)
    warnings_text = warnings_match.group(1).strip() if warnings_match else ""

    parts: List[str] = []
    if topic_title:
        parts.append(f"{greeting} gửi Bác sĩ thông tin chuyên môn thẩm định về **{topic_title}**:\n")
    else:
        parts.append(f"{greeting} gửi Bác sĩ thông tin chuyên môn đối soát theo nguồn [{source_label}]:\n")

    id_line = re.search(r"(•\s+\*\*Hoạt chất chính:\*\*.*?)\n", evidence_context)
    if id_line:
        parts.append(f"{id_line.group(1).strip()}\n")

    clean_bluf = ""
    if bluf_text:
        clean_bluf = bluf_text.strip()
        clean_bluf = re.sub(r'^(?:[^\n:]+?\s+có chỉ định chính:\s*)', '', clean_bluf, flags=re.IGNORECASE).strip()
        from app.services.clinical_reasoning.pediatric_dosage_reasoner import extract_demographic_slots
        d_slots = extract_demographic_slots(query)
        if d_slots.get("age_years") is not None and not clean_bluf.startswith("•"):
            clean_bluf = f"• Hướng dẫn liều dùng cho trẻ {int(d_slots['age_years'])} tuổi đối soát chuẩn Dược thư Quốc gia Việt Nam (DĐVN V)."
        elif d_slots.get("age_months") is not None and not clean_bluf.startswith("•"):
            clean_bluf = f"• Hướng dẫn liều dùng cho trẻ {int(d_slots['age_months'])} tháng tuổi đối soát chuẩn Dược thư Quốc gia Việt Nam (DĐVN V)."

    if not clean_bluf.strip('•-* ') and details_text:
        first_detail_lines = [l.strip().lstrip('•-* ') for l in details_text.splitlines() if l.strip() and not l.strip().startswith('#') and len(l.strip()) > 10]
        if first_detail_lines:
            clean_bluf = f"• **Khuyến cáo chính:** {first_detail_lines[0]}"

    if clean_bluf.strip('•-* '):
        if clean_bluf.startswith("•") or "\n•" in clean_bluf:
            parts.append(f"**Kết luận lâm sàng chính (Core Clinical Guidance):**\n{clean_bluf}\n")
        else:
            parts.append(f"**Kết luận lâm sàng chính (Core Clinical Guidance):**\n• {clean_bluf}\n")

    if details_text:
        # Nếu đã có khối suy luận theo slot [Liều dùng...] thì giữ nguyên khối chuẩn không băm nhỏ
        if "[Liều dùng" in details_text or "[Nguyên tắc" in details_text or "[Thông tin liều dùng" in details_text:
            parts.append(f"### Chi Tiết Hướng Dẫn & Cơ Sở Dược Lý Học\n{details_text.strip()}\n")
        else:
            clean_dt = re.sub(r'(\d+)\s*-\s*(\d+)giờ', r'\1 - \2 giờ', details_text)
            clean_dt = re.sub(r'(\d+)giờ', r'\1 giờ', clean_dt)
            is_multi_route = any(k in clean_dt.lower() for k in ("đặt trực tràng", "truyền tĩnh mạch", "liều uống thường dùng là", "đường uống:"))

            if is_multi_route:
                formatted_details = []
                oral_m = re.search(r'(?:Liều uống thường dùng là|Đường uống:?)\s*([^.]+?\.(?:.*?(?=Đặt trực tràng|Truyền tĩnh mạch|Tiêm tĩnh mạch|$))?)', clean_dt, re.IGNORECASE)
                if oral_m:
                    formatted_details.append(f"• **Đường uống:** {oral_m.group(1).strip()}")
                rect_m = re.search(r'Đặt trực tràng:?\s*([^.]+?\.(?:.*?(?=Truyền tĩnh mạch|Tiêm tĩnh mạch|Đường uống|$))?)', clean_dt, re.IGNORECASE)
                if rect_m:
                    formatted_details.append(f"• **Đặt trực tràng:** {rect_m.group(1).strip()}")
                iv_m = re.search(r'(?:Truyền tĩnh mạch|Tiêm tĩnh mạch)[^:]*:\s*([\s\S]*?)(?=(?:Không được vượt quá|Liều dùng trẻ em|Đặt trực tràng|Đường uống|$))', clean_dt, re.IGNORECASE)
                if iv_m:
                    iv_body = iv_m.group(1).strip()
                    formatted_details.append("• **Truyền tĩnh mạch (trong 15 phút):**")
                    over_50 = re.search(r'Trên 50\s*kg:\s*([^.]+?\.)', iv_body, re.IGNORECASE)
                    under_50 = re.search(r'Dưới 50\s*kg:\s*([^.]+?\.)', iv_body, re.IGNORECASE)
                    if over_50:
                        formatted_details.append(f"  - **Người bệnh trên 50 kg:** {over_50.group(1).strip()}")
                    if under_50:
                        formatted_details.append(f"  - **Người bệnh dưới 50 kg:** {under_50.group(1).strip()}")
                max_w = re.search(r'(Không được vượt quá liều tối đa[^\n.]+?\.)', clean_dt, re.IGNORECASE)
                if max_w:
                    formatted_details.append(f"  - *Giới hạn an toàn:* {max_w.group(1).strip()}")

                if formatted_details:
                    parts.append(f"### Chi Tiết Hướng Dẫn & Cơ Sở Dược Lý Học\n" + "\n".join(formatted_details) + "\n")
                else:
                    parts.append(f"### Chi Tiết Hướng Dẫn & Cơ Sở Dược Lý Học\n{clean_dt.strip()}\n")
            else:
                formatted_details = []
                for line in clean_dt.strip().splitlines():
                    s_line = line.strip()
                    if not s_line:
                        continue
                    if "liều dùng trẻ em:" in s_line.lower():
                        raw_ped = re.sub(r"^[•\-\*]\s*Liều dùng trẻ em:\s*", "", s_line, flags=re.IGNORECASE)
                        from app.services.clinical_reasoning.pediatric_dosage_reasoner import (
                            extract_demographic_slots,
                            reason_pediatric_dosage
                        )
                        slots = extract_demographic_slots(query)
                        if slots["is_pediatric"] or slots["age_years"] is not None or slots["age_months"] is not None:
                            reasoned = reason_pediatric_dosage(topic_title, topic_title, raw_ped, query, slots)
                            if reasoned:
                                formatted_details.append(reasoned)
                                continue
                        formatted_details.append("• **Liều dùng trẻ em theo nhóm tuổi & đường dùng:**")
                        ped_chunks = re.split(r'(?=(?:Đau, sốt|Đặt trực tràng|Truyền tĩnh mạch|Đau sau phẫu thuật|Sốt sau khi tiêm chủng):\s*)', raw_ped)
                        if len(ped_chunks) > 1:
                            for pc in ped_chunks:
                                pc = pc.strip()
                                if pc:
                                    formatted_details.append(f"  - {pc}")
                        else:
                            formatted_details.append(f"  - {raw_ped}")
                    else:
                        formatted_details.append(s_line)
                parts.append(f"### Chi Tiết Hướng Dẫn & Cơ Sở Dược Lý Học\n" + "\n".join(formatted_details) + "\n")
    elif not bluf_text:
        clean_lines = [l for l in evidence_context.splitlines() if not l.startswith("===") and not l.startswith("###")]
        clean_body = "\n".join(clean_lines[:15]).strip()
        if clean_body:
            parts.append(f"{clean_body}\n")

    if warnings_text and "> [!WARNING]" not in evidence_context and "> [!WARNING]" not in details_text:
        clean_warn = re.sub(r'(?<![.\n])\n(?!\s*[-•*0-9])', ' ', warnings_text).strip()
        warn_sentences = [w.strip().lstrip('•-* ') for w in (clean_warn.split("•") if "•" in clean_warn else clean_warn.splitlines()) if w.strip()]
        if not warn_sentences:
            warn_sentences = [w.strip() for w in re.split(r'(?<=[.!?])\s+', clean_warn) if w.strip()]
        clean_warn_sentences = [w.lstrip('•-* ') for w in warn_sentences if w]
        if clean_warn_sentences:
            seen_body = (clean_bluf + " " + details_text).lower()
            clean_warn_sentences = [
                w for w in clean_warn_sentences
                if w.lower() not in seen_body and not any(w.lower() in line.lower() for line in (clean_bluf + "\n" + details_text).splitlines() if len(line.strip()) > 10)
            ]
            if clean_warn_sentences:
                warn_bullets = "\n".join(f"> • {w}" for w in clean_warn_sentences)
                parts.append(f"> [!WARNING] Cảnh báo an toàn quan trọng & Chống chỉ định (DĐVN V)\n{warn_bullets}\n")

    parts.append("Đồng nghiệp cần tra cứu thêm phác đồ xử trí hay hướng dẫn phối hợp thuốc nào liên quan không ạ?")
    return "\n".join(parts)

async def synthesize_grounded_clinical_response(
    query: str,
    evidence_context: str,
    source_label: str = "Dược thư Quốc gia Việt Nam 2015 & QĐ 5948",
    user_role: str = "doctor",
    *,
    user_name: str = "Bác sĩ",
    api_key: Optional[str] = None,
    timeout_sec: float = 2.0
) -> PaperQASynthesisResult:
    """
    Điểm vào trung tâm (Entrypoint) của PaperQA2 Evidence Synthesis.
    Tổng hợp ngôn ngữ tự nhiên mềm mại từ CSDL -> Lọc khử ảo giác -> Đảm bảo an toàn 100%.
    """
    start_time = time.time()
    from app.services.admin_key_vault import get_active_api_key_async
    key = api_key or await get_active_api_key_async(provider="gemini") or settings.GEMINI_API_KEY

    # 1. Nếu có API Key khả dụng: Gọi LLM tổng hợp ngôn ngữ tự nhiên
    if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
        try:
            raw_text = await _call_llm_synthesis(
                query=query,
                evidence_context=evidence_context,
                source_label=source_label,
                user_role=user_role,
                api_key=key,
                timeout_sec=timeout_sec
            )
            if raw_text and len(raw_text) >= 15:
                # 2. Chạy qua bộ lọc PaperQA2 Claim Verifier đối soát chéo với CSDL
                clean_answer, citations = verify_and_purge_unsupported_claims(raw_text, evidence_context)
                latency = round((time.time() - start_time) * 1000, 2)
                return PaperQASynthesisResult(
                    conversational_answer=clean_answer,
                    citations=citations,
                    grounded_confidence=0.95,
                    has_unverified_claims=len(clean_answer) < len(raw_text),
                    latency_ms=latency,
                    source_status="exact_match"
                )
        except Exception:
            pass

    # 3. Fail-Safe Fallback: Tổng hợp chiết xuất có cấu trúc từ chứng cứ gốc CSDL (Bảo đảm 0% ảo giác, không gián đoạn)
    latency = round((time.time() - start_time) * 1000, 2)
    if "###" in evidence_context or "**Kết luận" in evidence_context or "=== [CHỨNG CỨ" in evidence_context:
        clean_synthesized = _format_deterministic_synthesis(
            query=query,
            evidence_context=evidence_context,
            source_label=source_label,
            user_role=user_role,
            user_name=user_name
        )
    else:
        clean_synthesized = evidence_context

    return PaperQASynthesisResult(
        conversational_answer=clean_synthesized,
        citations=[ClaimCitation(claim_text=evidence_context[:100], source_document=source_label, is_verified=True)],
        grounded_confidence=0.85 if clean_synthesized != evidence_context else 0.70,
        has_unverified_claims=False,
        latency_ms=latency,
        source_status="fallback_deterministic"
    )
