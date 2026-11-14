"""
Conversational Steering & Empathy Engine.
Xử lý các câu hỏi mở đầu thiện chí (CAPABILITY_OPENING) và điều hướng nhã nhặn (GENTLE_CLINICAL_STEERING)
theo nguyên tắc MedAbstain & OWASP LLM01: Answer Briefly + Gentle Clinical Steering.
"""
import re
from typing import Optional
from app.schemas.copilot import CopilotResponse


def _get_role_label(user_name: str, user_role: str) -> str:
    r_low = (user_role or "").lower()
    n_low = (user_name or "").lower()
    if any(k in r_low for k in ("doctor", "bac_si", "physician", "bs")) or any(k in n_low for k in ("bác", "bac", "bs", "dr")):
        return "Bác sĩ"
    if any(k in r_low for k in ("nurse", "dieu_duong", "dd")) or any(k in n_low for k in ("điều dưỡng", "dieu duong", "đd", "yt", "y tá")):
        return "Điều dưỡng"
    if any(k in r_low for k in ("pharmacist", "duoc_si", "ds")) or any(k in n_low for k in ("dược", "duoc", "ds")):
        return "Dược sĩ"
    return "Đồng nghiệp y tế"


def handle_capability_opening(
    user_role: str = "doctor",
    user_name: str = "Bác sĩ",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """Phản hồi nồng nhiệt, tự tin, sẵn sàng hỗ trợ khi người dùng hỏi khả năng tra cứu thuốc."""
    role_label = _get_role_label(user_name, user_role)
    reply_text = (
        f"Dạ được chứ ạ! Em là Trợ lý Dược Lâm Sàng, luôn sẵn sàng hỗ trợ {role_label} tra cứu 24/7.\n\n"
        f"{role_label} có thể gửi cho em:\n"
        f"1. **Tên thuốc hoặc hoạt chất:** Tra cứu chỉ định, liều dùng, chống chỉ định chuẩn Dược thư Quốc gia (DĐVN V) và 54.885 thuốc Cục QLD (DAV).\n"
        f"2. **Kiểm tra tương tác thuốc (DDI):** Rà soát các cặp thuốc chống chỉ định phối hợp theo Quyết định 5948/QĐ-BYT.\n"
        f"3. **Ca bệnh cá thể hóa:** Tính toán liều suy thận theo ClCr (Cockcroft-Gault) hoặc liều nhi khoa theo cân nặng.\n"
        f"4. **Phác đồ & Quy chế bệnh viện:** Xử trí sốc phản vệ (TT 51/2017), quản lý thuốc gây nghiện (TT 20/2017), chuỗi lạnh GSP (TT 36/2018).\n\n"
        f"{role_label} cần tra cứu thuốc hoặc ca bệnh nào xin cứ gửi cho em nhé ạ!"
    )
    return CopilotResponse(
        intent="CAPABILITY_OPENING",
        reply_text=reply_text,
        legal_basis="Dược Thư Quốc Gia Việt Nam & Cục Quản lý Dược",
        suggested_chips=[
            "Tra cứu Paracetamol",
            "Tra cứu Coversyl",
            "Kiểm tra tương tác thuốc",
            "Phác đồ cấp cứu phản vệ TT 51"
        ],
        session_id=session_id,
        answer_type="conversational_guidance",
        source_status="capability_acknowledged",
        confidence=1.0
    )


def handle_gentle_chitchat_steering(
    query: str,
    out_of_scope_type: Optional[str] = None,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """Trả lời nhanh gọn câu hỏi toán học/chitchat rồi khéo léo chuyển hướng về Dược lâm sàng."""
    role_label = _get_role_label(user_name, user_role)
    low_q = query.lower().strip()

    # Phân tích toán học đơn giản (chỉ áp dụng nếu không phải SĐK thuốc)
    is_sdk_pattern = bool(re.search(r'[A-Za-z]{2,3}-\d+-\d+', query) or "sđk" in low_q or "sdk" in low_q)
    math_match = None
    if not is_sdk_pattern:
        math_match = re.search(r'(?<![A-Za-z\-])\b(\d+)\s*([\+\*\/])\s*(\d+)\b', low_q)
        if not math_match:
            # Chỉ khớp phép trừ '-' khi có khoảng trắng hoặc có từ khóa toán học/phép tính
            if any(w in low_q for w in ("=", "bằng", "tính", "toán", "đúng không", "kết quả")) or re.search(r'\b\d+\s+-\s+\d+\b', low_q):
                math_match = re.search(r'(?<![A-Za-z\-])\b(\d+)\s*-\s*(\d+)\b', low_q)
                if math_match:
                    math_match = (math_match.group(1), '-', math_match.group(2))
    if math_match:
        if isinstance(math_match, tuple):
            n1, op, n2 = int(math_match[0]), math_match[1], int(math_match[2])
        else:
            n1, op, n2 = int(math_match.group(1)), math_match.group(2), int(math_match.group(3))
        res_calc = None
        if op == '+':
            res_calc = n1 + n2
        elif op == '-':
            res_calc = n1 - n2
        elif op == '*':
            res_calc = n1 * n2
        elif op == '/' and n2 != 0:
            res_calc = round(n1 / n2, 2)

        if res_calc is not None:
            # Kiểm tra nếu người dùng hỏi dạng "1+1 = 2 đúng không"
            is_confirm = "đúng không" in low_q or "phải không" in low_q or "=" in low_q
            if is_confirm and f"{res_calc}" in low_q:
                prefix = f"Dạ đúng rồi ạ, {n1} {op} {n2} = {res_calc}."
            else:
                prefix = f"Dạ kết quả {n1} {op} {n2} = {res_calc} ạ."

            reply_text = (
                f"{prefix} Tuy nhiên, em là **Trợ lý Dược Lâm Sàng** chuyên trách hỗ trợ bệnh viện về tra cứu thuốc, tương tác và phác đồ điều trị.\n\n"
                f"{role_label} có câu hỏi chuyên môn y tế hoặc thuốc nào cần em hỗ trợ ngay không ạ?"
            )
            return CopilotResponse(
                intent="OUT_OF_SCOPE",
                reply_text=reply_text,
                legal_basis="Phạm vi chuyên môn Dược Lâm Sàng & Quy chế Bộ Y tế",
                suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Hướng dẫn sử dụng hệ thống"],
                session_id=session_id,
                answer_type="safe_abstention",
                source_status="steered_non_clinical",
                confidence=1.0
            )

    # Câu hỏi danh tính hoặc giới thiệu bản thân
    is_identity = (
        any(w in low_q for w in (
            "bạn là ai", "ban la ai", "bạn tên gì", "ban ten gi", "bạn là chatbot",
            "phải chatbot", "bạn là bot", "giới thiệu bản thân", "ai tạo ra bạn", "trợ lý gì"
        ))
        or bool(re.search(r'\b(?:bạn|em|mày)\s+(?:là|ten\s+la)\s+(?:ai|gì|chatbot|bot|trợ lý|tro ly)\b', low_q))
    )
    if is_identity:
        reply_text = (
            f"Dạ em là **Trợ lý Dược Lâm Sàng & Nghiệp vụ Bệnh viện**!\n\n"
            f"Em luôn sẵn sàng đồng hành cùng {role_label} trong công tác chuyên môn: tra cứu chuyên luận Dược thư Quốc gia Việt Nam (DĐVN V), "
            f"tính liều theo chức năng thận/nhi khoa, cảnh báo tương tác thuốc theo Quyết định 5948/QĐ-BYT và rà soát danh mục BHYT.\n\n"
            f"{role_label} cần tra cứu thuốc hoặc hỗ trợ ca bệnh nào ạ?"
        )
        return CopilotResponse(
            intent="OUT_OF_SCOPE",
            reply_text=reply_text,
            legal_basis="Phạm vi chuyên môn Dược Lâm Sàng & Quy chế Bộ Y tế",
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Phác đồ phản vệ TT 51"],
            session_id=session_id,
            answer_type="safe_abstention",
            source_status="steered_non_clinical",
            confidence=1.0
        )

    # Chitchat ngoài lề hoặc yêu cầu dạy học ngoài ngành
    if out_of_scope_type in ("MATH_LOGIC", "GENERAL_CHITCHAT") or any(w in low_q for w in ("dạy tôi", "học toán", "kể chuyện", "làm thơ", "hát")):
        reply_text = (
            f"Dạ em là **Trợ lý Dược Lâm Sàng & Nghiệp vụ Bệnh viện**, được lập trình chuyên sâu phục vụ y tế nên em không thể hỗ trợ dạy học hoặc các chủ đề ngoài ngành được ạ.\n\n"
            f"Em luôn sẵn sàng hỗ trợ {role_label} tra cứu chuyên luận Dược thư DĐVN V, tính liều theo chức năng thận/nhi khoa, rà soát tương tác thuốc QĐ 5948 hoặc quy chế kho Dược. "
            f"{role_label} cần hỗ trợ nội dung chuyên môn nào xin cứ gửi cho em nhé!"
        )
        return CopilotResponse(
            intent="OUT_OF_SCOPE",
            reply_text=reply_text,
            legal_basis="Phạm vi chuyên môn Dược Lâm Sàng & Quy chế Bộ Y tế",
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Phác đồ phản vệ TT 51"],
            session_id=session_id,
            answer_type="safe_abstention",
            source_status="steered_non_clinical",
            confidence=1.0
        )

    # Từ chối mặc định nhã nhặn cho các câu hỏi thương mại/thời tiết/khác
    reply_text = (
        f"Dạ câu hỏi của {role_label} hiện nằm ngoài phạm vi nghiệp vụ Dược lâm sàng và Y tế của hệ thống.\n\n"
        f"Em chuyên hỗ trợ tra cứu thuốc Cục Quản lý Dược (DAV), Dược thư Quốc gia (DĐVN V), tương tác thuốc QĐ 5948 và phác đồ Bộ Y tế. "
        f"{role_label} vui lòng gửi tên thuốc hoặc nội dung chuyên môn y tế cần hỗ trợ ạ!"
    )
    return CopilotResponse(
        intent="OUT_OF_SCOPE",
        reply_text=reply_text,
        legal_basis="Phạm vi chuyên môn Dược Lâm Sàng",
        suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc"],
        session_id=session_id,
        answer_type="safe_abstention",
        source_status="steered_non_clinical",
        confidence=1.0
    )
