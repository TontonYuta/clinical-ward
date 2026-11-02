from fastapi import APIRouter, Depends, Request
import re
import unicodedata
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.copilot import CopilotQuery, CopilotResponse, RagQuery, RagResponse
from app.services.copilot_catalog import find_matched_med, find_matched_eq
from app.services.copilot_intents_info import (
    handle_legal_intent,
    handle_shift_handover_intent,
    handle_coldchain_intent,
    handle_audit_intent,
    handle_ocr_intent
)
from app.services.copilot_intents_actions import (
    handle_borrow_intent,
    handle_equipment_intent,
    handle_fefo_intent,
    handle_restock_intent
)
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.copilot_business_overview import handle_business_overview_intent, CLINICAL_BUSINESS_DIRECTORY
from app.services.copilot_gemini import ask_backend_gemini_copilot
from app.services.copilot_intents_prescription import (
    handle_prescription_advice_intent,
    handle_cpoe_intent,
    handle_debt_settle_intent
)
from app.services.copilot_gemini_scenarios import detect_and_handle_gemini_clinical_scenario
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail

router = APIRouter(prefix="/copilot", tags=["Trợ Lý Agent Lâm Sàng Thông Minh"])

def resolve_copilot_identity(payload: CopilotQuery, request: Request) -> tuple[str, str, str]:
    """Resolve trusted identity and ensure caller-chosen session IDs are owner-scoped."""
    authenticated = getattr(request.state, "authenticated_user", None)
    user_name = authenticated.username if authenticated else payload.user_name
    user_role = authenticated.role if authenticated else payload.user_role
    requested_session = (payload.session_id or "default_session").strip()
    # Prefixing is idempotent, which keeps existing tests and legacy clients stable.
    session_id = requested_session if requested_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{requested_session}"
    return user_name, user_role, session_id

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(payload: CopilotQuery, request: Request, db: AsyncSession = Depends(get_db)):
    from app.services.session_context import get_or_create_session
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    session = get_or_create_session(session_id, user_name, user_role)
    history = session.render_recent_history()
    response = await _handle_copilot_chat(payload, request, db, session=session, history=history)
    # Attachments and patient-record details are intentionally not part of this buffer.
    session.append_conversation_turn(payload.query, response.reply_text)
    response.session_id = session.session_id
    return response

async def _handle_copilot_chat(
    payload: CopilotQuery, request: Request, db: AsyncSession, *, session, history: str
):
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)

    # === LỚP BẢO MẬT INPUT GUARDRAIL: CHỐNG PROMPT INJECTION & SQL INJECTION ===
    guard_res = validate_input_guardrail(payload.query, user_role=user_role)
    if not guard_res.is_safe:
        return CopilotResponse(
            intent="SECURITY_GUARDRAIL_BLOCKED",
            reply_text=guard_res.safe_response,
            legal_basis="OWASP LLM01:2025, TT 20/2017 & An toàn An ninh Y tế",
            suggested_chips=["Tra cứu Dược Thư 2015", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"]
        )

    query = guard_res.sanitized_query
    lower_query = query.lower()
    is_renal_adjustment_request = any(term in lower_query for term in (
        "suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "chỉnh liều"
    ))
    renal_patient_subject = any(term in lower_query for term in (
        "bệnh nhân", "người bệnh", "hồ sơ", "bệnh án", "bn-", "bn "
    ))
    renal_patient_name_pattern = re.search(
        r"(?<!\w)(?:[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+\s+){1,4}[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+(?!\w)", query
    )
    if is_renal_adjustment_request and renal_patient_subject and not renal_patient_name_pattern and not any(
        token in lower_query for token in ("bn-", "bn ")
    ):
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Vui lòng cung cấp họ tên hoặc mã người bệnh và tên thuốc cần rà soát để đánh giá chức năng thận.",
            answer_type="clarification", source_status="missing_patient_identifier",
            confidence=1.0, abstention_reason="Câu hỏi có nhắc người bệnh nhưng thiếu định danh cụ thể",
        )
    if is_renal_adjustment_request and renal_patient_subject and renal_patient_name_pattern:
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        has_current_drug = find_matched_med(lower_query) is not None or any(
            len(alias) >= 4 and alias.casefold() in lower_query
            for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
        )
        if not has_current_drug:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Đã nhận diện người bệnh được nêu. Vui lòng cho biết tên thuốc cần rà soát; hệ thống chưa tra hồ sơ hay đưa ra khuyến cáo liều khi chưa có thuốc cụ thể.",
                answer_type="clarification", source_status="missing_drug_context",
                confidence=1.0, abstention_reason="Thiếu tên thuốc trong lượt hiện tại",
            )
    if is_renal_adjustment_request and renal_patient_subject and any(
        phrase in lower_query for phrase in ("có dùng được không", "dùng được không")
    ):
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        has_current_drug = find_matched_med(lower_query) is not None or any(
            len(alias) >= 4 and alias.casefold() in lower_query
            for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
        )
        if not has_current_drug:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để đánh giá suy thận, vui lòng cung cấp tên hoặc mã người bệnh và tên thuốc cần rà soát. Không sử dụng hồ sơ bệnh nhân đang chọn nếu chưa được nêu rõ trong câu hỏi.",
                answer_type="clarification", source_status="missing_patient_or_drug_context",
                confidence=1.0, abstention_reason="Thiếu định danh ca bệnh hoặc tên thuốc trong lượt hiện tại",
            )
    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))
    if session.active_medication_name and not is_renal_adjustment_request and not is_deep_complex and any(term in lower_query for term in (
        "liều tối đa", "còn liều", "liều dùng", "liều lượng", "tác dụng phụ",
        "tác dụng không mong muốn", "chống chỉ định", "thành phần", "hoạt chất",
        "chỉ định", "công dụng", "gây nghiện", "độc tính", "sáng hay tối",
        "uống sáng", "uống tối", "lúc đói", "lúc no", "trước ăn", "sau ăn",
        "tiêm nhắc lại", "bao lâu thì tiêm", "tần suất", "mỗi bao lâu",
    )):
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        resolved_new_drugs = resolve_registered_medications(lower_query)
        current_has_explicit_drug = find_matched_med(lower_query) is not None or bool(resolved_new_drugs)
        if current_has_explicit_drug and resolved_new_drugs:
            new_key = resolved_new_drugs[0]
            new_display = DRUG_REGISTRY[new_key].get("display", new_key.title())
            session.set_active_medication(name=new_display, ingredient=new_key)
            return await lookup_drug_authoritative(
                query, db, session_id=session_id, user_name=user_name, user_role=user_role
            )
        if not current_has_explicit_drug:
            session_query = lower_query
            timing_question = any(term in session_query for term in (
                "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no",
                "trước ăn", "sau ăn", "tiêm nhắc lại", "bao lâu thì tiêm",
                "tần suất", "mỗi bao lâu",
            ))
            if timing_question:
                return CopilotResponse(
                    intent="MEDICATION_LOOKUP_CLARIFICATION",
                    reply_text=(f"Câu hỏi về thời điểm dùng {session.active_medication_name} cần được đối chiếu theo đúng dạng bào chế, hàm lượng và chỉ định. "
                                "Vui lòng cung cấp chế phẩm cụ thể hoặc chỉ định để tra cứu hướng dẫn đã được xác thực."),
                    answer_type="clarification", source_status="insufficient_formulation_context",
                    session_id=session_id, confidence=1.0,
                )
            query = f"{query} của thuốc {session.active_medication_name}"
            lower_query = query.lower()
            return await lookup_drug_authoritative(
                query, db, session_id=session_id, user_name=user_name, user_role=user_role
            )
    # Resolve a field-only follow-up against the active medicine only when the
    # current turn contains no explicit catalog/registry medication entity.
    from app.services.copilot_drug_lookup import extract_drug_keywords
    cand_drug = extract_drug_keywords(lower_query)
    symptom_blacklist = {"sốt", "hạ sốt", "đau đầu", "đau bụng", "ung thư", "khó thở", "đột quỵ", "cấp cứu", "thuốc", "bệnh nhân", "người bệnh", "hàng ngày", "hàng tuần"}
    has_candidate_drug = False
    if cand_drug and len(cand_drug) >= 3 and not any(b in cand_drug for b in symptom_blacklist):
        from app.models.registry import DavNationalDrug
        cand_res = await db.execute(
            select(DavNationalDrug.id).where(or_(
                func.lower(DavNationalDrug.brand_name) == cand_drug,
                func.lower(DavNationalDrug.brand_name).like(f"{cand_drug} %"),
                func.lower(DavNationalDrug.brand_name).like(f"% {cand_drug}")
            )).limit(1)
        )
        has_candidate_drug = cand_res.scalar_one_or_none() is not None

    if session.active_medication_name:
        # First resolve any explicit entity from the current turn, including
        # names present only in the drug registry. It always supersedes state.
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        explicit_registered_drug = any(
            alias.casefold() in lower_query
            for entry in DRUG_REGISTRY.values()
            for alias in entry.get("aliases", [])
            if len(alias) >= 4
        )
        if find_matched_med(lower_query) is None and not explicit_registered_drug and not has_candidate_drug:
            field_only_terms = (
                "chống chỉ định", "tác dụng phụ", "tác dụng không mong muốn",
                "liều dùng", "liều tối đa", "thành phần", "hoạt chất",
                "chỉ định", "công dụng", "thông tin thuốc",
                "liều tối đa", "còn liều", "sáng hay tối", "uống sáng",
                "uống tối", "lúc đói", "lúc no", "trước ăn", "sau ăn",
                "bao lâu thì tiêm", "tiêm nhắc lại", "tần suất", "mỗi bao lâu",
                "đường dùng", "cách pha", "gây nghiện", "lệ thuộc",
                "suy thận", "suy gan", "độc tính", "thuốc đó", "thuốc này",
                "nó có", "của thuốc này", "của thuốc đó",
            )
            if any(term in lower_query for term in field_only_terms) or lower_query.endswith("của thuốc"):
                query = f"{query} của thuốc {session.active_medication_name}"
                lower_query = query.lower()
                active_name_in_query = session.active_medication_name.casefold() in lower_query
            else:
                active_name_in_query = False
        else:
            active_name_in_query = False
    else:
        active_name_in_query = False

    explicit_medication_named = find_matched_med(lower_query) is not None or any(
        alias.casefold() in lower_query
        for entry in __import__("app.services.clinical_ddi_engine.drug_registry", fromlist=["DRUG_REGISTRY"]).DRUG_REGISTRY.values()
        for alias in entry.get("aliases", []) if len(alias) >= 4
    ) or has_candidate_drug
    if session.active_medication_name and not is_renal_adjustment_request and not explicit_medication_named and any(term in lower_query for term in (
        "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no",
        "trước ăn", "sau ăn", "bao lâu thì tiêm", "tiêm nhắc lại",
        "tần suất", "mỗi bao lâu", "đường dùng", "cách pha",
    )):
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text=(
                f"Câu hỏi về thời điểm hoặc cách dùng của {session.active_medication_name} cần được đối chiếu theo đúng dạng bào chế, hàm lượng và chỉ định. "
                "Vui lòng cung cấp chế phẩm cụ thể hoặc chỉ định để tra cứu hướng dẫn đã được xác thực."
            ),
            answer_type="clarification", source_status="insufficient_formulation_context",
            session_id=session_id, confidence=1.0,
        )
    if session.active_medication_name and not is_renal_adjustment_request and not explicit_medication_named and any(term in lower_query for term in (
        "liều tối đa", "còn liều", "liều dùng", "liều lượng", "tác dụng phụ",
        "tác dụng không mong muốn", "chống chỉ định", "thành phần", "hoạt chất",
        "chỉ định", "công dụng", "gây nghiện", "độc tính",
    )):
        return await lookup_drug_authoritative(
            query, db, session_id=session_id, user_name=user_name, user_role=user_role
        )
    if not is_renal_adjustment_request and not explicit_medication_named and not active_name_in_query and any(term in lower_query for term in ("liều dùng", "liều tối đa", "thông tin thuốc", "thuốc là gì")):
        from app.services.copilot_drug_lookup import extract_drug_keywords
        candidate = extract_drug_keywords(lower_query)
        if candidate and len(candidate) >= 4:
            return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
    # An explicit new medication overrides stale session state for field-only
    # questions and must never be rewritten as a follow-up about the old drug.
    if explicit_medication_named:
        active_name_in_query = False

    # Resolve short medication follow-ups before broad scenarios or RAG.
    contextual_formulation_terms = (
        "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no",
        "trước ăn", "sau ăn", "bao lâu thì tiêm", "tiêm nhắc lại",
        "tần suất", "mỗi bao lâu", "đường dùng", "cách pha",
    )
    if active_name_in_query and any(term in lower_query for term in contextual_formulation_terms):
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text=(
                f"Câu hỏi về thời điểm hoặc cách dùng của {session.active_medication_name} cần được đối chiếu theo đúng dạng bào chế, hàm lượng và chỉ định. "
                "Vui lòng cung cấp chế phẩm cụ thể hoặc chỉ định để tra cứu hướng dẫn đã được xác thực."
            ),
            answer_type="clarification", source_status="insufficient_formulation_context",
            session_id=session_id, confidence=1.0,
        )

    # Field-only medication questions must not enter generic RAG without an
    # explicit medicine or an active medicine in this session.
    if not session.active_medication_name:
        context_required_terms = (
            "liều tối đa", "liều dùng", "liều lượng", "chống chỉ định",
            "tác dụng phụ", "tác dụng không mong muốn", "uống lúc đói",
            "lúc no", "suy thận", "suy gan", "phụ nữ có thai",
            "cho con bú", "thuốc đó", "thuốc này", "thuốc này kỵ",
            "có vỏ ống", "cách bảo quản", "bao lâu thì dừng",
            "tiêm bắp được", "pha chung", "thuốc giải độc",
            "hàng ngày hay hàng tuần", "sáng hay tối", "trước ăn bao lâu",
            "tác dụng kéo dài bao lâu", "dấu hiệu ngộ độc", "gây nghiện không",
            "liều bolus", "tiêm nhắc lại", "tốc độ truyền",
        )
        is_contextless_clinical_question = any(term in lower_query for term in context_required_terms)
        is_contextless_stock_question = any(term in lower_query for term in ("có trong tủ trực không", "còn trong tủ trực", "còn thuốc không"))
        if not is_renal_adjustment_request and (is_contextless_clinical_question or is_contextless_stock_question) and not explicit_medication_named:
            missing_subject_intent = "CLINICAL_SAFE_ABSTENTION" if lower_query.strip().rstrip("?.! ") in {"còn chống chỉ định", "chống chỉ định gì nữa không"} else "MEDICATION_LOOKUP_CLARIFICATION"
            return CopilotResponse(
                intent=missing_subject_intent,
                reply_text="Mình chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc hoặc hoạt chất (và hàm lượng/dạng dùng nếu liên quan) để trả lời chính xác.",
                answer_type="safe_abstention" if missing_subject_intent == "CLINICAL_SAFE_ABSTENTION" else "clarification", source_status="missing_medication_context",
                confidence=1.0, abstention_reason="Thiếu tên thuốc hoặc ngữ cảnh thuốc trong phiên",
            )

    # 0. Chào hỏi & hội thoại cơ bản (Greetings & Onboarding)
    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    clean_greeting_ascii = "".join(ch for ch in unicodedata.normalize("NFKD", clean_greeting) if not unicodedata.combining(ch)).replace("đ", "d")
    greeting_tokens = set(clean_greeting.split())
    wellbeing = any(term in clean_greeting_ascii for term in ("hom nay ban thay the nao", "hom nay ban the nao", "how are you", "how do you feel"))
    is_pure_greeting = clean_greeting in {
        "hi", "hello", "chao", "chào", "xin chao", "xin chào", "alo", "hey",
        "chao ban", "chào bạn", "chao bot", "chào bot", "chao em", "chào em",
        "chao bac si", "chào bác sĩ", "hi bot", "hello bot", "halo", "yo"
    } or (len(greeting_tokens) <= 2 and any(t in greeting_tokens for t in ["hi", "hello", "alo", "hey"])) or wellbeing
    if is_pure_greeting:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        if wellbeing:
            return CopilotResponse(
                intent="GREETING_WELLBEING",
                reply_text=f"Tôi luôn sẵn sàng hỗ trợ, {role_label.lower()}. Bác sĩ cần tra cứu hoặc xử lý nghiệp vụ nào?",
            )
        return CopilotResponse(
            intent="GREETING_WELCOME",
            reply_text=f"Chào {role_label}. Tôi hỗ trợ tra cứu thuốc, rà soát ca bệnh và chuẩn bị nghiệp vụ trong biểu mẫu."
        )

    is_thanks = clean_greeting in {
        "cam on", "cảm ơn", "cảm ơn bạn", "cảm ơn bot", "cam on ban", "cam on bot",
        "thank you", "thanks", "ok", "oke", "ok bot", "da", "dạ", "tam biet", "tạm biệt"
    }
    if is_thanks:
        return CopilotResponse(
            intent="ACKNOWLEDGMENT",
            reply_text="Rất vui được hỗ trợ bác sĩ.",
        )

    # 0a. Dặn dò bác sĩ & Lịch uống thuốc qua Google Apps Script / Email
    is_advice = any(w in lower_query for w in ["dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống", "gửi mail", "gửi email", "gửi gmail", "uống thuốc hàng ngày"]) or (
        any(w in lower_query for w in ["thông báo", "gửi", "nhắc", "dặn"]) and any(w in lower_query for w in ["uống thuốc", "uống", "đơn thuốc", "lịch thuốc"])
    ) or lower_query.strip() in ["gửi gmail", "gửi mail", "gmail", "email", "xem email", "in phiếu dặn dò"]
    if is_advice:
        return await handle_prescription_advice_intent(query, lower_query, user_name)

    # 0b. Kê đơn thuốc điện tử CPOE
    is_cpoe = any(w in lower_query for w in ["kê đơn", "tạo đơn thuốc", "lập đơn thuốc", "kê toa", "kê đơn cpoe", "cpoe đơn thuốc", "đơn thuốc điện tử"]) and not is_advice
    if is_cpoe:
        return await handle_cpoe_intent(query, lower_query, user_name)

    # 0c. Hoàn trả vỏ thuốc độc gây nghiện & Xóa nợ
    is_debt_settle = any(w in lower_query for w in ["trả vỏ", "hoàn trả vỏ", "thu hồi vỏ", "thanh toán nợ", "thanh toán sổ nợ", "trả nợ thuốc", "xóa nợ thuốc", "đối soát vỏ morphin", "xác nhận trả vỏ"]) and not any(w in lower_query for w in ["quy định", "thông tư", "nghị định"])
    if is_debt_settle:
        return await handle_debt_settle_intent(query, lower_query, db)

    from app.services.copilot_drug_lookup import extract_drug_keywords
    extracted_kw = extract_drug_keywords(query)
    resolved_meds_in_query = resolve_registered_medications(lower_query)
    is_two_drug = (len(extracted_kw.split()) > 1 and any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp "))) or len(resolved_meds_in_query) > 1

    is_single_drug_interaction = (
        not is_two_drug
        and (len(resolved_meds_in_query) == 1 or (bool(extracted_kw) and len(extracted_kw) >= 3))
        and any(term in lower_query for term in ("của", "thuốc này", "thuốc đó", "với thuốc khác", "về tương tác", "thông tin tương tác", "tương tác của", "tương tác thuốc của"))
        and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp "))
    )
    is_interaction_question = any(term in lower_query for term in ("tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung"))
    if is_interaction_question and not is_single_drug_interaction and not any(term in lower_query for term in ("tương tác thuốc của thuốc", "tương tác thuốc paracetamol", "tác dụng phụ", "tác dụng không mong muốn", "chống chỉ định", "liều dùng", "liều tối đa", "thành phần", "hoạt chất", "chỉ định", "công dụng")):
        from app.services.rag.knowledge_graph import expand_clinical_graph
        from app.services.session_context import get_or_create_session
        ddi_context = expand_clinical_graph(query).get("kg_entities", [])
        named_drugs = {entity for entity in ddi_context if entity.startswith("INN:")}
        known_interaction_pair = any(entity.startswith("DDI:") for entity in ddi_context)
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        named_drugs.update(
            f"INN:{ingredient}"
            for ingredient, entry in DRUG_REGISTRY.items()
            if any(alias.casefold() in lower_query for alias in entry.get("aliases", []) if len(alias) >= 4)
        )
        if len(named_drugs) < 2 and not known_interaction_pair:
            from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
            normalized_query = lower_query
            named_drugs.update(
                f"INN:{ingredient}"
                for ingredient, entry in DRUG_REGISTRY.items()
                if any(alias.casefold() in normalized_query for alias in entry.get("aliases", []) if len(alias) >= 4)
            )
        if len(named_drugs) < 2 and not known_interaction_pair:
            session = get_or_create_session(session_id, user_name, user_role)
            return CopilotResponse(
                intent="MEDICATION_INTERACTION_CLARIFICATION",
                reply_text="Vui lòng cung cấp tên hai thuốc (hoạt chất hoặc biệt dược) cần kiểm tra tương tác. Nếu muốn kiểm tra toàn bộ đơn, hãy gửi danh sách thuốc đang dùng.",
                answer_type="clarification", source_status="missing_interaction_medications",
                confidence=1.0, abstention_reason="Chưa xác định được ít nhất hai thuốc cần kiểm tra",
                session_id=session.session_id,
                suggested_chips=["Kiểm tra tương tác giữa hai thuốc", "Rà soát danh sách thuốc của người bệnh"],
            )

    # Explicit medication field questions should not be swallowed by broad scenarios/RAG.
    raw_field_specs = [
        ("interaction", ["tương tác thuốc", "thuốc tương tác", "tương tác", "tương kỵ", "kỵ thuốc"]),
        ("adverse_effects", ["tác dụng không mong muốn", "tác dụng phụ"]),
        ("contraindications", ["chống chỉ định", "cấm dùng"]),
        ("dosage", ["liều tối đa", "liều lượng", "liều dùng", "cách dùng", "còn liều", "liều"]),
        ("indications", ["chỉ định", "công dụng"]),
        ("ingredients", ["thành phần", "hoạt chất"]),
        ("registry", ["số đăng ký", "sđk"]),
    ]
    matched_field_keys = {
        key for key, phrases in raw_field_specs
        if (
            (key == "indications" and (any(p in lower_query for p in phrases if p != "chỉ định") or bool(re.search(r"(?<!chống\s)(?<!chống)chỉ định", lower_query))))
            or (key != "indications" and any(p in lower_query for p in phrases))
        )
    }
    # General medication information and requests for multiple fields must be
    # resolved against the drug catalog before broad clinical scenarios run.
    drug_info_cues = ("thông tin thuốc", "thông tin", "tra cứu thuốc", "thuốc ", "liều dùng", "liều lượng", "liều tối đa", "còn liều", "liều", "chỉ định", "công dụng", "tác dụng phụ", "tác dụng không mong muốn", "chống chỉ định", "thành phần", "hoạt chất", "tương tác")
    asks_multiple_fields = len(matched_field_keys) > 1
    has_drug_entity = find_matched_med(lower_query) is not None or active_name_in_query or any(alias in lower_query for entry in __import__("app.services.clinical_ddi_engine.drug_registry", fromlist=["DRUG_REGISTRY"]).DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4) or has_candidate_drug
    asks_drug_info = any(cue in lower_query for cue in drug_info_cues)
    from app.services.copilot_drug_lookup import extract_drug_keywords
    extracted_kw = extract_drug_keywords(query)
    is_two_drug = (len(extracted_kw.split()) > 1 and any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp "))) or len(resolved_meds_in_query) > 1
    is_two_drug_interaction = is_interaction_question and is_two_drug
    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))
    has_multiple_medication_fields = len(matched_field_keys) > 1 or is_two_drug or is_deep_complex or any(c in lower_query for c in (" và ", " cùng ", ","))
    has_explicit_medication_field = len(matched_field_keys) == 1 and not has_multiple_medication_fields
    if not is_renal_adjustment_request and asks_multiple_fields and asks_drug_info and not is_deep_complex and not is_two_drug_interaction:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
    if not is_renal_adjustment_request and has_explicit_medication_field and (has_drug_entity or active_name_in_query) and not is_deep_complex and not is_two_drug_interaction:
        # The authoritative lookup supplies the catalog-backed field answer and citation.
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
    if not is_renal_adjustment_request and active_name_in_query and asks_drug_info and not is_deep_complex and not is_two_drug_interaction:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    if not is_renal_adjustment_request and not explicit_medication_named and any(term in lower_query for term in (
        "suy thận", "suy gan", "thai kỳ", "phụ nữ có thai", "cho con bú",
        "thuốc giảm đau", "thuốc chống đông", "thuốc tim mạch", "thuốc dạ dày",
        "thuốc tiểu đường", "pha chung", "tương kỵ", "tương tác thuốc",
    )) and not session.active_medication_name:
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Vui lòng nêu tên thuốc/hoạt chất và thông tin người bệnh liên quan (nếu cần đánh giá ca cụ thể) để tra cứu đúng nguồn. Với tương tác hoặc pha truyền, hãy cung cấp đầy đủ các thuốc/dịch cần rà soát.",
            answer_type="clarification", source_status="missing_clinical_subject",
            confidence=1.0, abstention_reason="Thiếu thuốc hoặc đối tượng cần đánh giá",
        )

    is_general_reference_inquiry = any(term in lower_query for term in (
        "thông tin về", "thông tin", "tài liệu", "tra cứu", "hướng dẫn", "phác đồ",
        "thuốc hạ sốt", "thuốc giảm đau", "nhóm thuốc", "danh mục", "chuyên luận"
    ))
    is_self_symptom_prompt = not is_general_reference_inquiry and bool(re.search(r"\b(tôi|em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|em|mình)\b", lower_query))
    has_explicit_case = any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn "))
    if is_self_symptom_prompt and not has_explicit_case:
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Trợ lý này phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng nêu thông tin nhận diện ca/người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu chủ đề hoặc thuốc cần tra cứu.",
            answer_type="clarification", source_status="missing_case_context", confidence=1.0,
            abstention_reason="Câu hỏi triệu chứng chưa xác định người bệnh hoặc ca bệnh"
        )

    is_deictic_drug_question = any(term in lower_query for term in ("thuốc này", "thuốc đó", "thuốc vừa nói", "nó có", "của thuốc này"))
    if is_deictic_drug_question:
        from app.services.session_context import get_or_create_session
        session = get_or_create_session(session_id, user_name, user_role)
        if not session.active_medication_name:
            return CopilotResponse(
                intent="MEDICATION_LOOKUP_CLARIFICATION",
                reply_text="Mình chưa xác định được thuốc đang được nhắc tới trong cuộc hội thoại này. Vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký để tra cứu.",
                answer_type="clarification", source_status="missing_medication_context", confidence=1.0,
                abstention_reason="Không có thuốc đang hoạt động trong ngữ cảnh hội thoại",
                session_id=session.session_id, suggested_chips=["Tra cứu thông tin thuốc", "Nhập tên hoạt chất hoặc biệt dược"],
            )

    if not is_two_drug_interaction and not is_deep_complex and any(term in lower_query for term in ("dùng cho bệnh gì", "dùng để làm gì", "công dụng", "chỉ định")) and any(alias in lower_query for entry in __import__("app.services.clinical_ddi_engine.drug_registry", fromlist=["DRUG_REGISTRY"]).DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4):
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    if any(term in lower_query for term in ("sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể")):
        scenario_res = await detect_and_handle_gemini_clinical_scenario(
            query, lower_query, user_name, db, user_role=user_role, session_id=session_id
        )
        if scenario_res:
            scenario_res.reply_text = validate_output_guardrail(scenario_res.reply_text, query)
            return scenario_res

    # 0d. 12 Kịch Bản Lâm Sàng Chuyên Sâu Tách File & AMIE Multi-turn Context
    if not is_renal_adjustment_request and has_drug_entity and any(cue in lower_query for cue in drug_info_cues) and not is_two_drug_interaction and not is_deep_complex:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
    scenario_res = await detect_and_handle_gemini_clinical_scenario(
        query, lower_query, user_name, db, user_role=user_role, session_id=session_id
    )
    if scenario_res:
        scenario_res.reply_text = validate_output_guardrail(scenario_res.reply_text, query)
        return scenario_res

    from app.services.rag import rag_pipeline
    has_contextual_clinical_followups = any(term in lower_query for term in ("dùng gì", "uống gì", "gợi ý", "nên dùng", "nên uống", "đau đầu", "đau bụng"))
    if (is_interaction_question or has_contextual_clinical_followups) and (explicit_medication_named or session.active_medication_name):
        rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history)
        if rag_res:
            from app.services.session_context import get_or_create_session
            session = get_or_create_session(session_id, user_name, user_role)
            contextual_suggestions = [
                "Rà soát danh sách thuốc đang dùng của người bệnh",
                "Đánh giá dấu hiệu cảnh báo ở người bệnh sốt",
                "Kiểm tra tương tác trong danh sách thuốc đang dùng",
            ] if has_contextual_clinical_followups and not is_interaction_question else [
                "Rà soát danh sách thuốc đang dùng của người bệnh",
                "Cơ chế và mức độ nghiêm trọng của tương tác này là gì?",
                "Nội dung cần trao đổi với dược sĩ lâm sàng về phối hợp này",
            ]
            return CopilotResponse(
                intent="CLINICAL_AI_CONSULTATION",
                reply_text=validate_output_guardrail(rag_res.answer, query),
                legal_basis=rag_res.legal_basis or None,
                suggested_chips=contextual_suggestions,
                session_id=session.session_id,
                citations=[c.to_dict() for c in rag_res.citations],
                rag_grounded=rag_res.rag_grounded,
                answer_type="grounded_reference" if rag_res.rag_grounded else "safe_abstention",
                source_status="retrieved_evidence" if rag_res.rag_grounded else "insufficient_retrieval_evidence",
                confidence=rag_res.confidence_score,
                abstention_reason=None if rag_res.rag_grounded else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
            )

    # 1. Tra cứu Bản đồ 10 Đại Nghiệp vụ Bệnh viện & Năng lực Hệ thống
    is_capabilities = any(w in lower_query for w in [
        "nghiệp vụ", "các nghiệp vụ", "quy trình lâm sàng", "tính năng", "bạn làm được gì",
        "bạn có thể làm", "bạn giúp được", "hệ thống làm được", "làm được gì", "giúp được gì",
        "hướng dẫn hệ thống", "hướng dẫn sử dụng", "chức năng", "menu", "bạn là ai"
    ])
    if is_capabilities:
        return await handle_business_overview_intent()

    # 2. Căn cứ pháp lý & phác đồ Thông tư Bộ Y tế
    is_legal = any(w in lower_query for w in ["phác đồ", "quy định", "thông tư", "nghị định", "tiêu chuẩn", "hướng dẫn", "tiêu hủy", "vỡ", "làm mất"])
    has_action = any(w in lower_query for w in ["mượn", "lấy", "xuất", "hỏng", "báo hỏng", "kê", "cần"])
    if is_legal and not has_action:
        return await handle_legal_intent(lower_query)

    # 3-9. Chuyển tiếp nghiệp vụ bệnh viện
    if any(w in lower_query for w in ["đối soát", "giao ban", "ca trực", "ca đêm", "báo cáo ca", "chốt ca", "bàn giao ca", "07:00", "lệch sổ", "tổng hợp nợ"]):
        return await handle_shift_handover_intent(db)
    if find_matched_eq(lower_query) is not None or any(w in lower_query for w in ["báo hỏng", "sự cố máy", "lỗi thiết bị", "xì khí", "không lên nguồn", "kẹt pít-tông", "chai pin"]):
        return await handle_equipment_intent(query, lower_query, user_name, db)
    if any(w in lower_query for w in ["fefo", "cận hạn", "hạn dùng", "date", "hết hạn", "sắp hết hạn", "ngày hết hạn", "ưu tiên xuất"]):
        return await handle_fefo_intent(db)
    if any(w in lower_query for w in ["dự trù", "mẫu 01", "cạn kho", "sắp hết", "hết thuốc", "bù tồn kho", "chạm ngưỡng", "cơ số"]):
        return await handle_restock_intent(db)
    if any(w in lower_query for w in ["chuỗi lạnh", "cold chain", "nhiệt độ tủ lạnh", "datalogger", "vắc xin", "mkt", "mất điện tủ", "arrhenius"]):
        return await handle_coldchain_intent(db)
    if any(w in lower_query for w in ["kiểm toán", "toàn vẹn", "chuỗi băm", "sha256", "sha-256", "hmac", "nhật ký bảo mật", "sổ bất biến"]):
        return await handle_audit_intent(db)
    if any(w in lower_query for w in ["hóa đơn", "ocr", "quét hóa đơn", "bóc tách", "phiếu nhập", "cpc1", "vat"]):
        return await handle_ocr_intent()

    # 10. Mượn thuốc khẩn cấp ca đêm & Y lệnh thuốc
    matched_med = find_matched_med(lower_query)
    has_dispense_verb = any(w in lower_query for w in ["mượn", "lấy", "rút", "xuất", "cần", "xin", "tiêm", "truyền", "cấp phát"]) or (
        "cho" in lower_query and any(w in lower_query for w in ["lọ", "ống", "chai", "viên", "liều", "morphin", "adre"])
    )
    is_med_info = any(w in lower_query for w in ["thời gian bán thải", "chỉ định", "chống chỉ định", "tác dụng phụ", "tác dụng", "công dụng", "tương tác", "dùng để làm gì", "liều tối đa", "liều dùng", "là gì", "dị ứng", "huyết tương", "dược động học", "cơ chế", "thành phần", "uống lúc nào", "thế nào", "như thế nào", "bao nhiêu", "hỏi về", "thông tin"])
    if matched_med is not None and not is_med_info and not is_advice and (has_dispense_verb or any(c.isdigit() for c in query)):
        return await handle_borrow_intent(query, lower_query, user_name)

    # 11. Tra cứu Dược Quốc Gia 54.885 SĐK chính xác 100/100
    has_sdk = bool(re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", lower_query))
    is_deep_pharmacology = any(w in lower_query for w in [
        "thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng",
        "tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng", "kết hợp",
        "uống chung", "dùng chung", "chống chỉ định", "dị ứng chéo",
        "kháng sinh", "chống viêm", "hạ huyết áp", "uống gì", "dùng gì", "gợi ý"
    ]) or any(c in lower_query for c in [" và ", " với ", " cùng ", " kèm "])
    has_registered_drug = bool(resolve_registered_medications(lower_query))
    has_drug_ask = (
        lower_query.startswith("thuốc ")
        or " thuốc " in lower_query
        or any(w in lower_query for w in [
            "thông tin", "tra cứu thuốc", "sđk", "số đăng ký", "là thuốc gì", "dược thư", "về thuốc",
            "hỏi về thuốc", "biệt dược", "hoạt chất", "liều dùng", "liều lượng", "còn liều", "liều", "uống thế nào", "dùng thế nào",
            "dùng để làm gì", "chỉ định", "chống chỉ định", "tác dụng phụ", "uống được không", "dùng được không"
        ])
        or has_registered_drug
        or (matched_med is not None and is_med_info and not is_deep_pharmacology)
    )
    if (has_sdk or has_drug_ask) and not is_deep_pharmacology and not is_interaction_question and not is_renal_adjustment_request and not is_deep_complex:
        return await lookup_drug_authoritative(query, db, session_id=session_id)

    # 12. Tư vấn lâm sàng sâu bằng Pure RAG
    is_noise_or_too_short = len(lower_query.strip()) < 4 or clean_greeting in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}
    if not is_noise_or_too_short:
        if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc", "đơn này kê", "đơn này đúng", "duyệt đơn này")):
            return CopilotResponse(
                intent="CLINICAL_SAFE_ABSTENTION" if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc")) else "CLINICAL_CASE_CLARIFICATION",
                reply_text=("Trợ lý lâm sàng không cung cấp giá thương mại. Vui lòng tra cứu giá tại hệ thống dược/đấu thầu được bệnh viện phê duyệt." if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc")) else "Vui lòng cung cấp mã đơn RX hoặc danh sách thuốc, liều, tần suất và đường dùng để rà soát đơn; hiện chưa có đơn nào được đính kèm."),
                answer_type="safe_abstention" if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc")) else "clarification",
                source_status="out_of_scope" if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc")) else "missing_prescription_context",
                confidence=1.0, abstention_reason="Ngoài phạm vi hoặc thiếu dữ liệu đơn thuốc",
            )
        if any(term in lower_query for term in ("thời tiết", "dự báo thời tiết", "giá vàng", "tỷ giá", "kết quả bóng đá", "tin tức giải trí")):
            return CopilotResponse(
                intent="CLINICAL_SAFE_ABSTENTION",
                reply_text="Câu hỏi này nằm ngoài phạm vi trợ lý lâm sàng và nghiệp vụ bệnh viện. Tôi có thể hỗ trợ tra cứu thuốc, tương tác thuốc, hướng dẫn chuyên môn hoặc quy trình trong hệ thống.",
                answer_type="safe_abstention", source_status="out_of_scope",
                confidence=1.0, abstention_reason="Câu hỏi ngoài phạm vi trợ lý lâm sàng",
            )
        from app.services.rag.hybrid_retriever import HybridRetriever
        top_results = HybridRetriever().retrieve(query, top_k=1)
        if not top_results:
            return CopilotResponse(
                intent="CLINICAL_SAFE_ABSTENTION",
                reply_text="Hiện chưa tìm thấy thông tin chuyên môn phù hợp trong nguồn tri thức của hệ thống. Hãy nêu rõ chủ đề, thuốc hoặc văn bản cần tra cứu.",
                answer_type="safe_abstention", source_status="no_retrieval_results",
                confidence=0.0, abstention_reason="Không có tài liệu truy xuất phù hợp",
            )
        rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history)
        if rag_res and (rag_res.citations or not rag_res.rag_grounded or is_deep_pharmacology):
            cleaned_reply = validate_output_guardrail(rag_res.answer, query)
            from app.services.session_context import get_or_create_session
            session = get_or_create_session(session_id, user_name, user_role)
            target_drugs = resolve_registered_medications(lower_query) or ([session.active_medication_ingredient] if session.active_medication_ingredient else [])
            from app.services.chatbot.output_validator import validate_grounded_reply
            cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
                cleaned_reply, [c.to_dict() for c in rag_res.citations], target_drugs
            )
            from app.services.chatbot.chip_generator import generate_suggested_chips
            active_key = target_drugs[0] if target_drugs else None
            chips = generate_suggested_chips(active_key, "general")
            return CopilotResponse(
                intent="CLINICAL_AI_CONSULTATION", reply_text=cleaned_reply,
                legal_basis=rag_res.legal_basis or None,
                suggested_chips=chips,
                session_id=session.session_id, citations=validated_citations, rag_grounded=rag_res.rag_grounded and is_grounded,
                answer_type="grounded_reference" if (rag_res.rag_grounded and is_grounded) else "safe_abstention",
                source_status="retrieved_evidence" if (rag_res.rag_grounded and is_grounded) else "insufficient_retrieval_evidence",
                confidence=rag_res.confidence_score if is_grounded else 0.5,
                abstention_reason=None if (rag_res.rag_grounded and is_grounded) else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời"
            )

    # 13. Phản hồi chào mừng và bảng điều hướng lâm sàng
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE", reply_text=CLINICAL_BUSINESS_DIRECTORY,
        legal_basis="Thông tư 22/2011, TT 20/2017, TT 51/2017 & Nghị định 98/2021",
        suggested_chips=["Đối soát ca trực 07:00 AM", "Tra cứu SĐK VD-24757-16", "Thuốc cận hạn FEFO", "Báo hỏng máy thở PB840"]
    )

@router.post("/rag", response_model=RagResponse)
async def query_pure_clinical_rag(payload: RagQuery):
    guard_res = validate_input_guardrail(payload.query, user_role=payload.user_role)
    if not guard_res.is_safe:
        return RagResponse(
            query=payload.query,
            answer=guard_res.safe_response or "Yêu cầu bị chặn bởi rào chắn an toàn.",
            citations=[], kg_entities=[], confidence_score=0.0,
            legal_basis="Rào chắn an toàn đầu vào", rag_grounded=False
        )
    from app.services.rag import rag_pipeline
    res = await rag_pipeline.execute_clinical_rag(
        query=guard_res.sanitized_query,
        patient_info=payload.patient_info,
        user_role=payload.user_role
    )
    response = RagResponse(**res.to_response_dict())
    response.answer = validate_output_guardrail(response.answer, guard_res.sanitized_query)
    return response
