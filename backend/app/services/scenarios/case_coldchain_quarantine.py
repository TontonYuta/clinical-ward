"""
Kịch bản 11: Xử trí Sự Cố Chuỗi Lạnh Vắc xin GSP (Thông tư 36/2018/TT-BYT)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class ColdChainQuarantineScenario(BaseScenario):
    scenario_id = "coldchain_quarantine"
    scenario_name = "Xử trí sự cố chuỗi lạnh vắc xin"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        # Loại trừ tuyệt đối câu hỏi về sốt / thân nhiệt con người
        if any(w in lower_query for w in ["sốt", "thân nhiệt", "hạ sốt", "người", "em bé", "bệnh nhân", "cơ thể", "uống thuốc"]):
            return False

        has_coldchain_context = any(w in lower_query for w in [
            "chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "buồng lạnh", "vắc xin"
        ])

        has_incident_intent = any(w in lower_query for w in [
            "mất điện", "sự cố", "quá nhiệt", "vượt ngưỡng", "cách ly", "quarantine",
            "hỏng tủ", "cháy", "báo động", "phác đồ ứng phó", "hỏng lốc", "nhiệt độ tăng",
            "không lạnh", "chết máy", "cháy lốc"
        ])

        explicit_emergency_phrases = any(w in lower_query for w in [
            "mất điện tủ", "cách ly vắc xin", "quarantine vắc xin", "phác đồ chuỗi lạnh", "sự cố nhiệt độ"
        ])

        return (has_coldchain_context and has_incident_intent) or explicit_emergency_phrases

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            f"### ❄️ XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n"
            f"• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (`LOT-VX25-S1`) - Tồn **200 liều** tại Tủ lạnh Dược GSP T1.\n"
            f"• **Quy chuẩn dải nhiệt:** Tiêu chuẩn bảo quản bắt buộc từ **+2.0°C đến +8.0°C**.\n"
            f"• **Phác đồ ứng phó sự cố (Nhiệt độ vượt ngưỡng / Mất điện):**\n"
            f"  1. Kích hoạt bình tích lạnh dự phòng trong buồng tủ, tuyệt đối **không mở cửa tủ lạnh**.\n"
            f"  2. Chuyển nguồn cấp sang máy phát điện ưu tiên của bệnh viện trong vòng 5 phút.\n"
            f"  3. **Tạm thời cách ly lô vắc xin (Quarantine):** Dán tem cảnh báo, ngừng cấp phát cho các khoa phòng.\n"
            f"  4. Xuất dữ liệu Data Logger và tính toán nhiệt độ động học trung bình (MKT) để Hội đồng Dược thẩm định chất lượng."
        )
        card = CopilotActionCard(
            card_type="coldchain_monitor",
            title="Giám Sát Chuỗi Lạnh: Tủ Lạnh Vaxigrip T1",
            summary="Dải an toàn 2.0°C - 8.0°C • Phác đồ cách ly bảo toàn vắc xin",
            data={"targetTab": "coldchain", "batch": "LOT-VX25-S1"},
            primary_action_label="Mở Giám Sát Chuỗi Lạnh",
            primary_action_type="NAVIGATE_TAB",
            target_tab="coldchain"
        )
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_ALERT",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 36/2018/TT-BYT Thực hành tốt bảo quản thuốc GSP",
            suggested_chips=["Xem biểu đồ chuỗi lạnh", "Đối soát ca trực 07:00 AM", "Kiểm tra kho lạnh GSP"]
        )
