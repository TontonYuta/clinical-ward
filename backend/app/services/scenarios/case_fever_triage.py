"""
Kịch bản: Hướng Dẫn Xử Trí Sốt & Triage Lâm Sàng Thân Nhiệt (Fever Triage & Paracetamol Protocol)
Dữ liệu CSDL: Lô b-1 - PARACETAMOL 500mg (LOT-PC24-11A, Tồn 80 Viên, Kho Dược Nội Trú - Kệ A1 Tầng 1)
Căn cứ: Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Hướng dẫn Điều trị Bộ Y Tế (<=120 LOC)
"""

import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class FeverTriageScenario(BaseScenario):
    scenario_id = "fever_triage"
    scenario_name = "Xử trí sốt cao & Hướng dẫn hạ sốt Paracetamol"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_antipyretic = any(w in lower_query for w in [
            "thuốc hạ sốt", "các loại thuốc hạ sốt", "thuốc hạ nhiệt", "thuốc giảm sốt", "thuốc trị sốt",
            "uống thuốc hạ sốt", "nhóm thuốc hạ sốt", "hạ sốt bằng thuốc", "hạ sốt thế nào", "hạ sốt làm sao",
            "cách hạ sốt", "hướng dẫn hạ sốt", "phác đồ hạ sốt", "cho tôi 1 loại thuốc hạ sốt", "loại thuốc hạ sốt",
            "cho tôi thuốc hạ sốt", "1 loại thuốc hạ sốt", "loại hạ sốt"
        ])
        has_fever_word = any(w in lower_query for w in ["sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể", "cặp nhiệt độ"])
        has_action_or_temp = any(w in lower_query for w in [
            "38", "39", "40", "độ", "làm gì", "làm sao", "làm thế nào", "xử trí",
            "uống gì", "thuốc gì", "dùng gì", "loại nào", "nên uống", "cách hạ", "hạ thân nhiệt", "nguy hiểm không", "các loại thuốc", "thông tin", "1 loại"
        ])
        is_vaccine_coldchain = any(w in lower_query for w in ["chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "datalogger", "mkt"])
        return (has_antipyretic or (has_fever_word and has_action_or_temp)) and not is_vaccine_coldchain

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        has_case = bool(ctx.patient or any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ")))
        if not has_case:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để tra cứu xử trí sốt theo ca, vui lòng chọn hồ sơ hoặc cung cấp thông tin người bệnh. Nếu cần tài liệu tham khảo chung, hãy nêu rõ nội dung cần tra cứu.",
                answer_type="clarification", source_status="missing_case_context", confidence=1.0,
                abstention_reason="Chưa xác định người bệnh hoặc yêu cầu tra cứu chung"
            )
        temp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:độ|°c)", lower_query)
        temp_str = f"{temp_match.group(1)}°C" if temp_match else "chưa cung cấp"
        context = (
            f"Ca bệnh đã nêu nhiệt độ {temp_str}; các thông tin tuổi, cân nặng, thời gian sốt, bệnh nền/dị ứng và thuốc đang dùng "
            "cần được đối chiếu trước khi đánh giá liều hoặc lựa chọn điều trị."
        )
        reply = (
            "### Tham khảo lâm sàng: đánh giá người bệnh sốt\n\n"
            f"{context}\n\n"
            "Rà soát tuổi/cân nặng, toàn trạng, thời gian diễn tiến, bệnh nền, dị ứng và thuốc đang dùng trước khi áp dụng hướng dẫn hạ sốt. Ở trẻ em cần căn cứ cân nặng và chuyên luận tương ứng. Nếu chưa loại trừ sốt xuất huyết, đánh giá nguy cơ chảy máu trước khi cân nhắc NSAID hoặc Aspirin.\n\n"
            "Dấu hiệu cần đánh giá khẩn gồm khó thở, rối loạn tri giác, co giật, cứng gáy, tím tái, mất nước nặng hoặc xuất huyết.\n\n"
            "Để rà soát cụ thể, bổ sung tuổi/cân nặng, nhiệt độ và sinh hiệu, thời gian sốt, dấu hiệu kèm theo, bệnh nền/dị ứng và thuốc đã sử dụng."
        )
        return CopilotResponse(
            intent="CLINICAL_FEVER_TRIAGE_PROTOCOL",
            reply_text=reply, card=None,
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 & Hướng dẫn Bộ Y tế (đối chiếu nguồn hiện hành)",
            suggested_chips=["Rà soát ca người bệnh sốt 39°C", "Kiểm tra liều trẻ em theo cân nặng và nguồn", "Dấu hiệu cảnh báo sốt xuất huyết ở người bệnh"],
            session_id=ctx.session.session_id if ctx.session else None,
        )
