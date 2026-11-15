"""
Kịch bản 11B: Giám sát Chuỗi Lạnh & Datalogger Thời Gian Thực (Thông tư 36/2018/TT-BYT GSP)
Xử lý các câu hỏi tra cứu thông số nhiệt độ, độ ẩm, datalogger và tình trạng buồng bảo quản vắc xin (Telemetry Query).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.domains.cold_chain.tools import ColdChainTools
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class ColdChainTelemetryScenario(BaseScenario):
    scenario_id = "coldchain_telemetry"
    scenario_name = "Giám sát nhiệt độ chuỗi lạnh thời gian thực"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        # 1. Loại trừ tuyệt đối câu hỏi về sốt / thân nhiệt con người
        if any(w in lower_query for w in ["sốt", "thân nhiệt", "hạ sốt", "người", "em bé", "bệnh nhân", "cơ thể", "uống thuốc"]):
            return False

        # 2. Loại trừ nếu người dùng đang hỏi về sự cố / mất điện / cách ly khẩn cấp (đã có ColdChainQuarantineScenario)
        if any(w in lower_query for w in [
            "mất điện", "sự cố", "quá nhiệt", "vượt ngưỡng", "cách ly", "quarantine",
            "hỏng tủ", "cháy", "báo động", "phác đồ ứng phó", "hỏng lốc", "nhiệt độ tăng vọt"
        ]):
            return False

        # 3. Kích hoạt khi có ngữ cảnh kho lạnh / tủ vắc xin và từ khóa tra cứu thông số / trạng thái
        has_coldchain = any(w in lower_query for w in [
            "chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "buồng lạnh", "vắc xin"
        ])
        has_telemetry_keyword = any(w in lower_query for w in [
            "nhiệt độ", "độ ẩm", "mấy độ", "bao nhiêu độ", "bao nhiêu", "hiện tại",
            "tình trạng", "kiểm tra", "giám sát", "ổn định", "thế nào", "sao rồi",
            "bình thường không", "datalogger", "data logger", "mkt", "thông số"
        ])

        return has_coldchain and has_telemetry_keyword

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        return await ColdChainTools().status_response(db)
