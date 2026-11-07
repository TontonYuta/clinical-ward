"""
Dual-Zone Clinical Response Coordinator (Kỹ thuật 11 & 12).
Phối hợp Vùng 1 (100% CSDL Đối chứng) và Vùng 2 (AI Suy luận Lâm sàng Tham khảo) theo chuẩn Dual-Zone Architecture.
"""
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from app.services.rag.cross_zone_verifier import CrossZoneVerifier, CrossZoneVerificationResult
from app.services.chatbot.persona_disclaimer import wrap_dual_zone_reasoning_disclaimer, get_role_salutation

class DualZonePackage(BaseModel):
    zone_1_title: str = Field(default="🏛️ CĂN CỨ DƯỢC THƯ & CSDL QUỐC GIA (100% ĐỐI CHỨNG)")
    zone_1_content: str = Field(description="Nội dung sự thật trích xuất từ CSDL")
    zone_2_title: str = Field(default="💡 SUY LUẬN LÂM SÀNG THAM KHẢO (AI REFERENCE)")
    zone_2_content: str = Field(description="Nội dung AI suy luận phân tích cơ chế")
    is_cross_verified: bool = Field(default=True)
    full_markdown_text: str = Field(description="Văn bản Markdown gộp hoàn chỉnh hiển thị trên UI")

class DualZoneOrchestrator:
    """Điều phối viên kết nối 2 phân vùng tri thức y khoa lâm sàng."""

    @staticmethod
    def coordinate_response(
        zone_1_fact: str,
        zone_2_reasoning: str = "",
        user_role: Optional[str] = "doctor",
        user_name: Optional[str] = "Bác sĩ"
    ) -> DualZonePackage:
        salutation = get_role_salutation(user_role, user_name)
        clean_z1 = zone_1_fact.strip()
        clean_z2 = zone_2_reasoning.strip()

        # Nếu không có nội dung suy luận Vùng 2 (ví dụ câu hỏi tra cứu đơn thuần)
        if not clean_z2:
            full_text = f"{salutation}\n\n{clean_z1}"
            return DualZonePackage(
                zone_1_content=clean_z1,
                zone_2_content="",
                is_cross_verified=True,
                full_markdown_text=full_text
            )

        # 1. Kiểm tra chéo chống mâu thuẫn qua CrossZoneVerifier
        verification: CrossZoneVerificationResult = CrossZoneVerifier.verify_consistency(
            zone_1_fact=clean_z1,
            zone_2_reasoning=clean_z2
        )

        # 2. Bọc Disclaimer pháp lý FDA CDSS 2022 cho Vùng 2
        safe_z2 = wrap_dual_zone_reasoning_disclaimer(verification.sanitized_zone_2)

        # 3. Tạo khối hiển thị 2 vùng phân định trực quan
        zone_divider = (
            f"\n\n---\n\n"
            f"### 💡 VÙNG 2: SUY LUẬN LÂM SÀNG THAM KHẢO (AI REFERENCE)\n\n"
        )
        full_text = (
            f"{salutation}\n\n"
            f"### 🏛️ VÙNG 1: CĂN CỨ DƯỢC THƯ & CSDL QUỐC GIA (100% ĐỐI CHỨNG)\n\n"
            f"{clean_z1}"
            f"{zone_divider}"
            f"{safe_z2}"
        )

        return DualZonePackage(
            zone_1_content=clean_z1,
            zone_2_content=safe_z2,
            is_cross_verified=verification.is_consistent,
            full_markdown_text=full_text
        )
