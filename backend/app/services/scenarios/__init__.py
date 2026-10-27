"""
Package Kịch Bản Lâm Sàng Chuyên Sâu Bệnh Viện (Clinical Scenarios)
"""

from app.services.scenarios.context import ClinicalContext
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.registry import SCENARIOS, dispatch_clinical_scenario

__all__ = ["ClinicalContext", "BaseScenario", "SCENARIOS", "dispatch_clinical_scenario"]
