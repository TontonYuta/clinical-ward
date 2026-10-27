"""
Interface cơ bản cho một Kịch bản Lâm sàng (Base Scenario Handler)
Tuân thủ nguyên tắc Single Responsibility (SRP) và Open/Closed Principle (OCP).
"""

from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.context import ClinicalContext

class BaseScenario(ABC):
    scenario_id: str = "base"
    scenario_name: str = "Kịch bản cơ bản"

    @abstractmethod
    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        """Kiểm tra câu hỏi của người dùng có khớp với kịch bản này hay không."""
        pass

    @abstractmethod
    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        """Xử lý nghiệp vụ và trả về CopilotResponse kèm Action Card (nếu có)."""
        pass
