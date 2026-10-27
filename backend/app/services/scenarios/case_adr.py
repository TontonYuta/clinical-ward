"""
Kịch bản 12: Báo cáo Cảnh giác Dược ADR (Thông tư 51/2017 & QĐ 1088/QĐ-BYT)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class AdrReportingScenario(BaseScenario):
    scenario_id = "adr_reporting"
    scenario_name = "Báo cáo Cảnh giác Dược ADR"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["adr", "biến cố", "tác dụng phụ", "cảnh giác dược"])

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            f"### 🚨 XỬ TRÍ PHẢN ỨNG CÓ HẠI CỦA THUỐC (ADR) & DỰ THẢO BÁO CÁO\n\n"
            f"• **Phân loại lâm sàng:** Biến cố bất lợi sau dùng thuốc (Nghi ngờ phản vệ theo Thông tư 51/2017/TT-BYT).\n"
            f"• **Xử trí cấp cứu tức thì:** Ngừng ngay thuốc đang dùng, tiêm bắp Adrenalin 0.5mg (1/2 ống) nếu có tụt huyết áp/khó thở.\n"
            f"• **Báo cáo Cảnh giác Dược:** Đã lập dự thảo Phiếu báo cáo ADR để gửi Trung tâm DI & ADR Quốc gia."
        )
        return CopilotResponse(
            intent="CLINICAL_ADR_REPORTING",
            reply_text=reply,
            legal_basis="Thông tư 51/2017/TT-BYT & QĐ 1088/QĐ-BYT",
            suggested_chips=["Phác đồ Adrenalin phản vệ TT 51", "Lập phiếu báo hỏng", "Đối soát ca trực 07:00 AM"]
        )
