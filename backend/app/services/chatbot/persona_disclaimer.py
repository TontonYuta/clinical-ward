"""
Role Persona & FDA CDSS Disclaimer Engine (Kỹ thuật 10).
Tuân thủ Hướng dẫn Quyết định Lâm sàng FDA CDSS 2022 & Chuẩn mực Y đức Bộ Y Tế.
Định hình văn phong theo vai trò (Bác sĩ, Điều dưỡng, Dược sĩ) và đính kèm Disclaimer cho Vùng 2 (Suy luận AI).
"""
from typing import Optional

FDA_CDSS_DISCLAIMER_VI = (
    "> [!NOTE] **KHUYẾN CÁO AN TOÀN LÂM SÀNG (FDA CDSS 2022 / BỘ Y TẾ):**\n"
    "> Toàn bộ phân tích cơ chế dược lý, khuyến nghị chuyển đổi phác đồ và suy luận đa bệnh lý "
    "được tổng hợp tự động từ AI nhằm mục đích hỗ trợ tra cứu học thuật. Bác sĩ điều trị và cán bộ y tế "
    "chịu trách nhiệm độc lập và toàn diện về mọi quyết định y lệnh trên người bệnh thực tế."
)

def get_role_salutation(user_role: Optional[str] = None, user_name: Optional[str] = None) -> str:
    """Tạo lời xưng hô chuẩn mực y khoa bệnh viện theo vai trò và danh xưng."""
    r_low = (user_role or "").lower().strip()
    n_low = (user_name or "").lower().strip()

    if any(k in r_low for k in ["doctor", "bac_si", "physician", "bs"]) or any(k in n_low for k in ["bác", "bs", "dr"]):
        return "Kính gửi Bác sĩ,"
    elif any(k in r_low for k in ["nurse", "dieu_duong", "dd"]) or any(k in n_low for k in ["điều dưỡng", "dd"]):
        return "Chào Điều dưỡng,"
    elif any(k in r_low for k in ["pharmacist", "duoc_si", "ds"]) or any(k in n_low for k in ["dược", "ds"]):
        return "Kính gửi Dược sĩ lâm sàng,"
    return "Chào Quý đồng nghiệp y tế,"

def get_fda_cdss_disclaimer() -> str:
    """Trả về chuỗi khuyến cáo pháp lý y khoa chuẩn mực."""
    return FDA_CDSS_DISCLAIMER_VI

def wrap_dual_zone_reasoning_disclaimer(reasoning_content: str) -> str:
    """Đóng gói vùng suy luận AI (Vùng 2) với nhãn cảnh báo tham khảo y khoa."""
    clean_body = reasoning_content.strip()
    if not clean_body:
        return ""
    if "FDA CDSS 2022" in clean_body or "KHUYẾN CÁO AN TOÀN LÂM SÀNG" in clean_body:
        return clean_body
    return f"{clean_body}\n\n---\n{FDA_CDSS_DISCLAIMER_VI}"
