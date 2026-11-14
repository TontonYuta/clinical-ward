import re
import unicodedata
from app.schemas.copilot import CopilotResponse
from app.services.copilot_business_overview import CLINICAL_BUSINESS_DIRECTORY

def handle_greeting_and_acknowledgment(lower_query: str, user_name: str, user_role: str) -> CopilotResponse | None:
    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    clean_greeting_ascii = "".join(
        ch for ch in unicodedata.normalize("NFKD", clean_greeting) if not unicodedata.combining(ch)
    ).replace("đ", "d")
    greeting_tokens = set(clean_greeting.split())
    wellbeing = any(
        term in clean_greeting_ascii
        for term in ("hom nay ban thay the nao", "hom nay ban the nao", "how are you", "how do you feel")
    )
    is_pure_greeting = clean_greeting in {
        "hi", "hello", "chao", "chào", "xin chao", "xin chào", "alo", "hey",
        "chao ban", "chào bạn", "chao bot", "chào bot", "chao em", "chào em",
        "xin chao em", "xin chào em", "xin chao ban", "xin chào bạn",
        "chao bac si", "chào bác sĩ", "xin chao bac si", "xin chào bác sĩ",
        "chao dong nghiep", "chào đồng nghiệp", "hi bot", "hello bot", "halo", "yo"
    } or (len(greeting_tokens) <= 3 and any(t in clean_greeting for t in ["xin chào", "xin chao", "chào bạn", "chao ban", "chào em", "chao em"])) or (len(greeting_tokens) <= 2 and any(t in greeting_tokens for t in ["hi", "hello", "alo", "hey"])) or wellbeing

    is_voice_mic_test = any(phrase in clean_greeting_ascii for phrase in (
        "nghe toi noi khong", "co nghe khong", "co nghe thay khong", "nghe ro khong",
        "ban co dang nghe", "co dang nghe", "test mic", "thu mic", "kiem tra mic"
    ))
    if is_voice_mic_test:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else ("Điều dưỡng" if "nurse" in user_role.lower() or "đd" in user_name.lower() else "Nhân viên y tế")
        return CopilotResponse(
            intent="GREETING_WELLBEING",
            reply_text=f"Dạ em nghe rất rõ ạ, {role_label}! Em sẵn sàng hỗ trợ tra cứu Dược thư Quốc gia, liều dùng hoặc kiểm tra tương tác thuốc. {role_label} cần hỗ trợ thông tin gì ạ?",
            suggested_chips=["Tra cứu thông tin thuốc", "Liều dùng Paracetamol", "Kiểm tra tương tác thuốc"],
            confidence=1.0
        )

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

    is_capability_or_help = any(c in clean_greeting_ascii for c in (
        "giup toi duoc khong", "giup em duoc khong", "ban giup toi duoc khong",
        "ban giup em duoc khong", "co the giup toi", "co the giup em",
        "hoi ve thong tin cac loai thuoc", "hoi ve thong tin thuoc",
        "ban co the lam gi", "ban lam duoc gi", "ban co the giup gi",
        "huong dan su dung", "cach su dung"
    ))
    q_tokens = set(clean_greeting_ascii.split())
    is_non_clinical = bool(q_tokens & {"toan", "tho", "vang"}) or any(w in clean_greeting_ascii for w in (
        "hoc toan", "chuyen cuoi", "cau chuyen cuoi", "lam tho", "bai tho",
        "xo so", "so xo", "nguoi yeu", "thoi tiet", "gia vang", "nau an", "bong da", "da banh"
    ))
    if is_capability_or_help and not is_non_clinical:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else ("Điều dưỡng" if "nurse" in user_role.lower() or "đd" in user_name.lower() else "Đồng nghiệp")
        return CopilotResponse(
            intent="GENERAL_CLINICAL_ASSISTANCE",
            reply_text=(
                f"Dạ được chứ ạ! Em là Trợ lý Dược lâm sàng & An toàn Thuốc nội viện, luôn sẵn sàng hỗ trợ {role_label} 24/7.\n\n"
                f"{role_label} có thể tra cứu và thực hiện các nghiệp vụ:\n"
                f"1. **Tra cứu hồ sơ thuốc & Chuyên luận DĐVN V:** Gửi tên biệt dược, hoạt chất hoặc SĐK (ví dụ: *Coversyl, Paracetamol, Zithromax, Augmentin...*).\n"
                f"2. **Kiểm tra tương tác thuốc (DDI):** Rà soát các cặp tương tác chống chỉ định theo QĐ 5948/QĐ-BYT (ví dụ: *Clopidogrel + Omeprazol*, hoặc gõ *'lấy ví dụ 3 cặp tương tác chống chỉ định'*).\n"
                f"3. **Liều dùng & Hiệu chỉnh suy thận:** Liều chuẩn người lớn, liều trẻ em theo cân nặng, hiệu chỉnh liều suy thận theo độ thanh thải Creatinin ($Cl_{{cr}}$).\n"
                f"4. **Quy chế & Nghiệp vụ nội viện:** Quản lý thuốc gây nghiện (TT 20), xử trí phản vệ (TT 51), thẩm định đơn CPOE (TT 26), quản lý tủ trực & kho GSP (TT 36/TT 22).\n\n"
                f"{role_label} muốn tra cứu thuốc hoặc chủ đề chuyên môn nào trước ạ?"
            ),
            legal_basis="Dược thư Quốc gia Việt Nam DĐVN V & Quyết định 5948/QĐ-BYT",
            suggested_chips=["Thông tin thuốc Coversyl", "Liều Paracetamol cho trẻ em", "Ví dụ tương tác chống chỉ định", "Quy chế thuốc gây nghiện TT 20"],
            answer_type="guideline",
            confidence=1.0
        )

    # 1. Phát hiện phản hồi góp ý bổ sung dữ liệu lâm sàng
    is_data_enrichment_feedback = any(c in clean_greeting_ascii for c in (
        "thieu tuong tac", "can bo sung", "bo sung cho day du", "chua du tuong tac",
        "bo sung them", "cap nhat them", "thieu thuoc", "chua du thuoc", "bo sung tuong tac"
    ))
    if is_data_enrichment_feedback:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        return CopilotResponse(
            intent="FEEDBACK_DATA_ENRICHMENT",
            reply_text=(
                f"Đã ghi nhận phản hồi của {role_label} về việc bổ sung và chuẩn hóa dữ liệu chuyên môn.\n\n"
                f"• **Đối soát hiện hành:** Hệ thống đang đối chiếu trực tiếp theo danh mục 633 cặp tương tác chống chỉ định (QĐ 5948/QĐ-BYT) và 771 chuyên luận Dược Thư Quốc Gia (DĐVN V).\n"
                f"• **Điểm cần làm rõ:** {role_label} đang nhận thấy thông tin chưa chuẩn xác hoặc cần bổ sung ở cặp thuốc/phác đồ cụ thể nào để hệ thống đối soát và cập nhật ngay vào cơ sở dữ liệu ạ?"
            ),
            legal_basis="Quyết định 5948/QĐ-BYT & Dược thư Quốc gia Việt Nam",
            suggested_chips=["Simvastatin và Clarithromycin", "Clopidogrel và Omeprazol", "Tra cứu Dược Thư Quốc Gia"],
            answer_type="feedback_acknowledgment",
            confidence=1.0
        )

    # 2. Phát hiện phản hồi góp ý về bố cục giao diện / hiển thị nút bấm
    is_ui_layout_feedback = any(c in clean_greeting_ascii for c in (
        "tai lieu goc", "bam nut", "nut ben duoi", "o duoi cuoi", "duoi cuoi", "o tren cung", "tren cung",
        "dieu chinh lai", "can dieu chinh", "bo cuc", "giao dien", "hien thi chua", "nut bam", "vi tri nut"
    ))
    if is_ui_layout_feedback:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        return CopilotResponse(
            intent="FEEDBACK_UI_ADJUSTMENT",
            reply_text=(
                f"### 📐 TIẾP NHẬN GÓP Ý VỀ BỐ CỤC & HIỂN THỊ THÔNG TIN\n\n"
                f"Dạ em xin chân thành cảm ơn {role_label} đã phản hồi rất chi tiết về cách trình bày ạ!\n\n"
                f"• **Ghi nhận trải nghiệm:** Em xin tiếp thu góp ý về vị trí liên kết tài liệu đối chứng/Dược thư và nút mở chuyên luận gốc để đồng bộ luồng đọc thuận mắt nhất, tránh gây phân tán khi thao tác lâm sàng.\n"
                f"• **Điều chỉnh giao diện:** Nhóm phát triển đang tối ưu để đưa các nút hành động (Action buttons) và liên kết nguồn dữ liệu đối chứng về đúng vị trí trực quan, liền mạch với nội dung trích xuất.\n\n"
                f"{role_label} cần tra cứu thuốc hoặc kiểm tra nghiệp vụ lâm sàng nào tiếp theo để em phục vụ ngay ạ?"
            ),
            legal_basis="Chuẩn thiết kế công thái học lâm sàng & Trải nghiệm người dùng",
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu Dược Thư Quốc Gia"],
            answer_type="feedback_acknowledgment",
            confidence=1.0
        )

    corr_cues = (
        "tra loi sai", "sai thong tin", "lai sai", "sai roi", "nham roi", "khong dung", "sai bet",
        "sai cho nay", "sai cho nay roi", "sai cho nay roi nhe", "sai o day", "sai roi nhe",
        "ao giac", "lai ao giac", "bi ao giac", "tra loi linh tinh", "linh tinh roi", "linh tinh qua",
        "noi linh tinh roi", "vo van", "tao lao", "lai nham", "nham to", "nham lan",
        "kem qua", "kem the", "ban kem", "kem that", "kem coi", "te qua", "te that", "ban te",
        "do qua", "ban do", "do the", "chan qua", "chan the", "that vong", "trai nghiem te",
        "chat luong kem", "vo dung", "khong dung duoc", "kem lam", "kem qua di",
        "lech huong", "lai lech", "lech huong roi", "khong lien quan", "khong dung cau hoi",
        "van con sai", "van sai", "sai muc dich", "sai huong", "nham muc dich", "khong dung muc dich",
        "lac de", "tra loi lung tung", "noi lung tung", "khong lien quan den cau hoi",
        "can cai thien", "can cai thien tiep", "chua chuan", "chua dung", "chua dung roi",
        "chua dung nhe", "chua chinh xac", "chua on", "chua dung lam", "chua chuan lam"
    )
    is_pure_correction = (clean_greeting in {
        "sai roi", "sai rồi", "nham roi", "nhầm rồi", "khong dung", "không đúng",
        "khong phai", "không phải", "bi nham", "bị nhầm", "lại ảo giác rồi", "ảo giác rồi",
        "lai ao giac roi", "ao giac roi", "bị ảo giác à", "bi ao giac a", "nói linh tinh rồi", "linh tinh rồi",
        "bạn kém quá", "ban kem qua", "kém quá", "kem qua", "kém thế", "kem the", "tệ quá", "te qua",
        "dở quá", "do qua", "chán quá", "chan qua", "thất vọng", "that vong", "bạn dở quá", "bạn tệ quá",
        "sai chỗ này rồi nhé", "sai chỗ này rồi", "sai chỗ này", "chưa đúng rồi", "chưa đúng nhé"
    } or (
        any(c in clean_greeting_ascii for c in corr_cues)
        and not any(k in clean_greeting_ascii for k in ("mg", "mcg", "chong chi dinh", "benh nhan", "nguoi benh", "ca benh", "noi chuyen", "chuyen", "tuong tac"))
    )) and not any(term in clean_greeting_ascii for term in ("noi chuyen", "chuyen linh tinh", "tro chuyen", "tam su"))
    if is_pure_correction:
        u_role = (user_role or "").lower()
        u_name = (user_name or "").lower()
        is_doc = any(k in u_role for k in ("doctor", "bac_si", "physician", "bs")) or any(k in u_name for k in ("bác", "bac", "bs", "dr", "doctor", "physician"))
        role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"
        return CopilotResponse(
            intent="CONVERSATIONAL_CORRECTION",
            reply_text=f"Dạ xin lỗi {role_label}! Em rất tiếc vì trải nghiệm chưa tốt và xin tiếp thu phản ánh để liên tục hoàn thiện chất lượng hỗ trợ. {role_label} vui lòng cho biết câu hỏi cụ thể hoặc thông tin cần tra cứu để em phục vụ chính xác nhất ạ.",
            answer_type="conversational_correction",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu Dược Thư Quốc Gia"]
        )

    has_clinical_anchor = bool(re.search(
        r"\b(?:mg|mcg|ml|tuong tac|chong chi dinh|giai doc|ngo doc|doc tinh|thai|uong|tiem|lieu|benh|thuoc|than|gan|sot|dieu tri)\b",
        clean_greeting_ascii
    ))

    is_capability_query = any(c in clean_greeting_ascii for c in (
        "khong xu ly duoc", "khong lam duoc", "khong biet lam", "khong tra loi duoc", "lam duoc gi", "co the lam gi"
    )) and not has_clinical_anchor and not any(term in clean_greeting_ascii for term in ("thuoc", "hoi ve", "tra cuu"))
    if is_capability_query:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        return CopilotResponse(
            intent="BOT_CAPABILITY_CLARIFICATION",
            reply_text=(
                f"Dạ em là Trợ lý Dược lâm sàng & Nghiệp vụ nội viện. Em có thể hỗ trợ {role_label.lower()}:\n\n"
                f"1. **Tra cứu thuốc & Dược thư:** Tra cứu 54.885 thuốc DAV, chỉ định, liều dùng, chống chỉ định, hoạt chất DĐVN V.\n"
                f"2. **Rà soát tương tác thuốc (DDI):** Kiểm tra tương tác chống chỉ định theo QĐ 5948/QĐ-BYT.\n"
                f"3. **Phác đồ cấp cứu & lâm sàng:** Cấp cứu phản vệ (TT 51/2017), quản lý thuốc gây nghiện (TT 20/2017), tiêu chảy mất nước, sốt cao.\n"
                f"4. **Kiểm tra kho dược & FEFO:** Tồn kho thực tế tại kho nội trú, tủ trực và hạn dùng.\n\n"
                f"{role_label} vui lòng gửi tên thuốc hoặc nội dung cần tra cứu cụ thể để em xử lý ạ!"
            ),
            answer_type="capability_overview",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu tồn kho thuốc"]
        )

    is_bot_identity = bool(re.search(
        r"\b(?:ban la ai|ong la ai|anh la ai|em la ai|may la ai|who are you|ban ten gi|ten la gi|ai the|ai day|ai do)\b",
        clean_greeting_ascii
    )) and not has_clinical_anchor
    if is_bot_identity:
        return CopilotResponse(
            intent="BUSINESS_OVERVIEW",
            reply_text=CLINICAL_BUSINESS_DIRECTORY,
            card=None,
            legal_basis="Thông tư 26/2025, TT 52/2017, QĐ 5948 & DĐVN V",
            suggested_chips=["Kiểm tra đơn thuốc", "Tương tác giữa Clopidogrel và Omeprazol", "Mở form gửi email/sms", "Thuốc cận hạn FEFO"]
        )

    is_style_feedback = any(c in clean_greeting_ascii for c in (
        "dung trong tam", "gon gang", "ngan gon", "cung nhac", "may moc", "dai dong",
        "dai qua", "tu nhien hon", "linh hoat hon", "ngan thoi", "gon hon", "ngan hon",
        "chung chung", "ko hai long", "khong hai long", "chua hai long", "chua dung y",
        "khong dung y", "chua thoa dang", "khong thoa dang", "tra loi kem", "tra loi te"
    )) and not any(k in clean_greeting_ascii for k in ("mg", "mcg", "tuong tac", "chong chi dinh"))
    if is_style_feedback:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        if any(c in clean_greeting_ascii for c in ("chung chung", "hai long", "chua dung y", "khong dung y", "chua thoa dang")):
            reply_msg = (
                f"Dạ em xin chân thành tiếp thu phản hồi của {role_label.lower()}! "
                f"Em xin rút kinh nghiệm sẽ đi thẳng vào chi tiết chuyên môn cụ thể và số liệu lâm sàng rõ ràng, không trả lời chung chung. "
                f"{role_label} đang cần làm rõ thông tin chi tiết về thuốc, phác đồ điều trị hay quy trình nào để em hỗ trợ chính xác ngay ạ?"
            )
        else:
            reply_msg = (
                f"Dạ em xin tiếp thu góp ý của {role_label.lower()}! Em sẽ trả lời ngắn gọn, đúng trọng tâm và linh hoạt hơn, "
                f"tập trung trực diện vào thông tin lâm sàng cốt lõi. {role_label} cần tra cứu hay xử lý nghiệp vụ gì tiếp theo ạ?"
            )
        return CopilotResponse(
            intent="CONVERSATIONAL_FEEDBACK",
            reply_text=reply_msg,
            answer_type="conversational_feedback",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu Dược Thư Quốc Gia"]
        )
    return None

def attach_correction_empathy(reply_text: str, query: str) -> str:
    lower = query.casefold()
    cues = ("sai rồi", "sai roi", "nhầm rồi", "nham roi", "không phải", "khong phai", "bị nhầm", "bi nham")
    if any(c in lower for c in cues) and not reply_text.startswith("Dạ xin lỗi"):
        return f"Dạ xin lỗi bác sĩ, hệ thống xin cập nhật lại thông tin:\n\n{reply_text}"
    return reply_text

def handle_out_of_scope_or_pricing(lower_query: str) -> CopilotResponse | None:
    if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc", "đơn này kê", "đơn này đúng", "duyệt đơn này")):
        is_price = any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc"))
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION" if is_price else "CLINICAL_CASE_CLARIFICATION",
            reply_text=(
                "Trợ lý lâm sàng không cung cấp giá thương mại. Vui lòng tra cứu giá tại hệ thống dược/đấu thầu được bệnh viện phê duyệt."
                if is_price
                else "Vui lòng cung cấp mã đơn RX hoặc danh sách thuốc, liều, tần suất và đường dùng để rà soát đơn; hiện chưa có đơn nào được đính kèm."
            ),
            answer_type="safe_abstention" if is_price else "clarification",
            source_status="out_of_scope" if is_price else "missing_prescription_context",
            confidence=1.0,
            abstention_reason="Ngoài phạm vi hoặc thiếu dữ liệu đơn thuốc",
        )

    from app.services.chatbot.semantic_boundary import evaluate_semantic_boundary, generate_safe_abstention_copilot_response
    boundary = evaluate_semantic_boundary(lower_query)
    if boundary.is_out_of_domain:
        return generate_safe_abstention_copilot_response()
    return None
