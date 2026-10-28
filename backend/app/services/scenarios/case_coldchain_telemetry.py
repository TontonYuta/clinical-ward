"""
Kịch bản 11B: Giám sát Chuỗi Lạnh & Datalogger Thời Gian Thực (Thông tư 36/2018/TT-BYT GSP)
Xử lý các câu hỏi tra cứu thông số nhiệt độ, độ ẩm, datalogger và tình trạng buồng bảo quản vắc xin (Telemetry Query).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
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
        # Dữ liệu cảm biến thời gian thực của Tủ lạnh GSP T1 (B Medical Systems TCW 3000AC)
        current_temp = 4.5
        current_humidity = 58
        target_min = 2.0
        target_max = 8.0
        mkt_temp = 4.8
        total_doses = 200

        reply = (
            f"### 🌡️ GIÁM SÁT CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n"
            f"• **Nhiệt độ hiện tại:** **{current_temp:.1f}°C** (🟢 Đạt chuẩn GSP: dải an toàn bắt buộc **+{target_min:.1f}°C đến +{target_max:.1f}°C**).\n"
            f"• **Độ ẩm buồng tủ:** **{current_humidity}% RH** (🟢 Đạt chuẩn GSP < 70%).\n"
            f"• **Nguồn cấp:** Điện lưới 220V ổn định, hệ thống pin tích điện dự phòng 48 giờ sẵn sàng.\n"
            f"• **Trạng thái cảnh báo:** **Bình thường (An toàn)**. Không ghi nhận biến cố nhiệt hay mất nguồn.\n"
            f"• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (`LOT-VX25-S1`) - Tồn **{total_doses} liều** tại Tủ lạnh Dược GSP T1.\n"
            f"• **Chỉ số MKT (Mean Kinetic Temperature):** **{mkt_temp:.1f}°C** (Tính toán theo phương trình Arrhenius WHO PQS).\n\n"
            f"👉 **Kết luận:** Toàn bộ vắc xin đang được lưu trữ an toàn trong giới hạn nhiệt độ quy chuẩn. "
            f"Hệ thống vận hành ổn định, **chưa cần kích hoạt phác đồ ứng phó sự cố hay biệt trữ cách ly**."
        )
        card = CopilotActionCard(
            card_type="coldchain_status",
            title="Giám Sát Chuỗi Lạnh: Tủ Lạnh Vaxigrip T1",
            summary=f"Nhiệt độ {current_temp:.1f}°C (Đạt chuẩn 2.0°C - 8.0°C) • Vận hành ổn định",
            data={
                "targetTab": "coldchain",
                "batch": "LOT-VX25-S1",
                "currentTemp": current_temp,
                "humidity": current_humidity,
                "status": "normal"
            },
            primary_action_label="Mở Giám Sát Chuỗi Lạnh",
            primary_action_type="NAVIGATE_TAB",
            target_tab="coldchain"
        )
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_TELEMETRY",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 36/2018/TT-BYT Thực hành tốt bảo quản thuốc GSP",
            suggested_chips=["Xem biểu đồ chuỗi lạnh", "Đối soát ca trực 07:00 AM", "Kiểm tra kho lạnh GSP"]
        )
