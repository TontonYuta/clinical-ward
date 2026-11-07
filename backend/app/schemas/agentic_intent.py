"""
Chuẩn Khai Báo Schema & Berkeley Function Calling cho Agentic Clinical Router.
Tuân thủ chuẩn Berkeley Function Calling Benchmark (BFCL) & Pydantic v2.
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class ClinicalIntent(str, Enum):
    DISPENSE_MEDICATION = "DISPENSE_MEDICATION"              # Mượn/xuất/kê thuốc khẩn cấp
    REPORT_EQUIPMENT_INCIDENT = "REPORT_EQUIPMENT_INCIDENT"  # Báo hỏng thiết bị y tế
    FEFO_INVENTORY_CHECK = "FEFO_INVENTORY_CHECK"            # Tra cứu thuốc cận hạn (FEFO)
    RESTOCK_PROPOSAL = "RESTOCK_PROPOSAL"                    # Lập dự trù bù kho, thuốc cạn ngưỡng min
    SHIFT_HANDOVER_AUDIT = "SHIFT_HANDOVER_AUDIT"            # Đối soát ca trực, giao ban, nợ morphin
    COLDCHAIN_CHECK = "COLDCHAIN_CHECK"                      # Nhiệt độ tủ bảo quản vắc xin, dây chuyền lạnh
    CHECK_DRUG_INTERACTION = "CHECK_DRUG_INTERACTION"        # Kiểm tra tương tác thuốc (DDI)
    CLINICAL_CONSULTATION = "CLINICAL_CONSULTATION"          # Tư vấn chuyên môn, phác đồ, Dược thư, liều suy thận
    CONVERSATIONAL_GREETING = "CONVERSATIONAL_GREETING"      # Chào hỏi, cảm ơn, giao tiếp tự nhiên
    CLINICAL_SAFE_ABSTENTION = "CLINICAL_SAFE_ABSTENTION"    # Ngoài phạm vi hoặc câu hỏi thiếu dữ kiện

class IntentExtractionResult(BaseModel):
    intent: ClinicalIntent
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    drug_name: Optional[str] = None
    drug_b: Optional[str] = None
    quantity: int = 1
    unit: Optional[str] = None
    patient_name: Optional[str] = None
    patient_room: Optional[str] = None
    device_name: Optional[str] = None
    device_location: Optional[str] = None
    issue_description: Optional[str] = None
    urgency: str = "routine"
    clinical_reason: Optional[str] = None
    threshold_days: int = 60

BERKELEY_FUNCTION_SPECS: List[Dict[str, Any]] = [
    {
        "name": "dispense_medication",
        "description": "Xuất kho hoặc mượn thuốc, vật tư y tế khẩn cấp tại tủ trực khoa phòng cho bệnh nhân",
        "parameters": {
            "type": "object",
            "properties": {
                "drug_name": {"type": "string", "description": "Tên biệt dược hoặc hoạt chất cần xuất"},
                "quantity": {"type": "integer", "description": "Số lượng cần xuất", "default": 1},
                "unit": {"type": "string", "description": "Đơn vị tính (ống, lọ, viên, bộ...)"},
                "patient_name": {"type": "string", "description": "Tên hoặc mã bệnh nhân nhận thuốc"},
                "patient_room": {"type": "string", "description": "Buồng bệnh hoặc phòng mổ"},
                "urgency": {"type": "string", "enum": ["urgent", "routine"]}
            },
            "required": ["drug_name"]
        }
    },
    {
        "name": "report_equipment_incident",
        "description": "Báo cáo sự cố, hỏng hóc hoặc mất an toàn thiết bị y tế (máy thở, monitor, bơm tiêm điện)",
        "parameters": {
            "type": "object",
            "properties": {
                "device_name": {"type": "string", "description": "Tên thiết bị y tế gặp sự cố"},
                "device_location": {"type": "string", "description": "Vị trí đặt máy"},
                "issue_description": {"type": "string", "description": "Mô tả lỗi hoặc sự cố"},
                "urgency": {"type": "string", "enum": ["urgent", "routine"]}
            },
            "required": ["device_name", "issue_description"]
        }
    },
    {
        "name": "fefo_inventory_check",
        "description": "Kiểm tra danh mục thuốc cận hạn theo hạn dùng FEFO trong kho hoặc tủ trực",
        "parameters": {
            "type": "object",
            "properties": {
                "threshold_days": {"type": "integer", "description": "Số ngày cận hạn tối đa", "default": 60}
            }
        }
    },
    {
        "name": "restock_proposal",
        "description": "Lập dự trù bù kho (mẫu 01) cho các mặt hàng sắp hết hoặc chạm ngưỡng tồn kho tối thiểu",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "shift_handover_audit",
        "description": "Đối soát số liệu ca trực, bàn giao giao ban và kiểm tra nợ vỏ thuốc gây nghiện",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "coldchain_check",
        "description": "Giám sát viễn thông nhiệt độ tủ lạnh vắc xin và xử trí sự cố mất điện chuỗi lạnh",
        "parameters": {
            "type": "object",
            "properties": {
                "is_emergency": {"type": "boolean", "description": "Sự cố mất điện hoặc báo động nhiệt độ"}
            }
        }
    }
]
