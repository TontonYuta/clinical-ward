"""
Router API Thẩm Định Đơn Thuốc Lâm Sàng 5 Trụ Cột (AI Clinical Prescription Audit) (<=80 LOC)
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.services.clinical_prescription_auditor import (
    ClinicalPrescriptionAuditor,
    PrescriptionAuditResult
)

router = APIRouter(prefix="/prescriptions", tags=["Thẩm Định Đơn Thuốc Lâm Sàng"])

class AuditPrescriptionRequest(BaseModel):
    order: Dict[str, Any] = Field(..., description="Dữ liệu đơn thuốc CPOE")
    patient: Optional[Dict[str, Any]] = Field(None, description="Dữ liệu lâm sàng người bệnh (tuổi, cân nặng, eGFR...)")

@router.post("/audit", response_model=PrescriptionAuditResult)
async def audit_prescription_endpoint(payload: AuditPrescriptionRequest):
    """Thẩm định đơn thuốc tự động trên 5 trụ cột tiêu chuẩn Bộ Y tế."""
    try:
        auditor = ClinicalPrescriptionAuditor()
        result = auditor.audit_prescription(payload.order, payload.patient)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích thẩm định đơn thuốc: {str(e)}")
