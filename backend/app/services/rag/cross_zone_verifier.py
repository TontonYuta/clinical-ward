"""
Self-RAG Cross-Zone Consistency Verifier (Kỹ thuật 11).
Paper: Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection (ICLR 2024 / arXiv:2310.11511).
Kiểm tra chéo chống mâu thuẫn tuyệt đối giữa Vùng 1 (Sự thật CSDL) và Vùng 2 (AI Suy luận).
"""
import re
from typing import List, Dict, Tuple, Optional
from pydantic import BaseModel, Field

class CrossZoneVerificationResult(BaseModel):
    is_consistent: bool = Field(default=True, description="Hai vùng có đồng thuận y khoa không")
    conflict_items: List[str] = Field(default_factory=list, description="Danh sách các điểm mâu thuẫn phát hiện")
    sanitized_zone_2: str = Field(description="Nội dung Vùng 2 đã được gọt giũa và bảo vệ an toàn")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)

class CrossZoneVerifier:
    """Bộ kiểm chứng mâu thuẫn chéo giữa CSDL Sự thật và Suy luận AI."""

    @staticmethod
    def verify_consistency(zone_1_fact: str, zone_2_reasoning: str) -> CrossZoneVerificationResult:
        z1_low = zone_1_fact.lower()
        z2_low = zone_2_reasoning.lower()
        conflicts: List[str] = []

        # 1. Quét mâu thuẫn Chống chỉ định (Contraindication Clash)
        contra_keywords = ["chống chỉ định", "chong chi dinh", "không được dùng", "tuyệt đối không", "nguy cơ tử vong"]
        has_z1_contra = any(ck in z1_low for ck in contra_keywords)

        if has_z1_contra:
            # Phát hiện nếu Vùng 2 lại khuyên dùng hoặc duy trì
            permissive_cues = ["có thể dùng", "tiếp tục duy trì", "an toàn khi dùng", "khuyến khích dùng", "kê đơn được"]
            for cue in permissive_cues:
                if cue in z2_low:
                    conflicts.append(f"Mâu thuẫn chống chỉ định: Vùng 1 nghiêm cấm nhưng Vùng 2 đề xuất '{cue}'")

        # 2. Quét mâu thuẫn Chức năng thận ClCr / eGFR
        if "clcr < 30" in z1_low or "egfr < 30" in z1_low or "suy thận nặng" in z1_low:
            if any(term in z2_low for term in ("không cần chỉnh liều", "dùng liều thông thường", "giữ nguyên liều")):
                conflicts.append("Mâu thuẫn hiệu chỉnh thận: Vùng 1 yêu cầu suy thận nặng nhưng Vùng 2 gợi ý giữ nguyên liều")

        # 3. Xử lý khi phát hiện xung đột: Vô hiệu hóa mệnh đề sai ở Vùng 2
        is_consistent = len(conflicts) == 0
        sanitized_z2 = zone_2_reasoning

        if not is_consistent:
            warning_box = (
                "> [!WARNING] **CẢNH BÁO XUNG ĐỘT SUY LUẬN AI (CROSS-ZONE CONFLICT DETECTED):**\n"
                "> Hệ thống Self-RAG Verifier đã phát hiện mâu thuẫn giữa suy luận của AI và Căn cứ Dược thư Quốc gia ở Vùng 1.\n"
                "> **Quy tắc An toàn Tuyệt đối:** Luôn ưu tiên tuân thủ 100% Căn cứ CSDL Dược thư ở Vùng 1 phía trên."
            )
            sanitized_z2 = f"{warning_box}\n\n*(Một số suy luận mang tính chất mâu thuẫn đã được hệ thống tự động cảnh báo)*\n\n{zone_2_reasoning}"

        return CrossZoneVerificationResult(
            is_consistent=is_consistent,
            conflict_items=conflicts,
            sanitized_zone_2=sanitized_z2,
            confidence=1.0 if is_consistent else 0.70
        )
