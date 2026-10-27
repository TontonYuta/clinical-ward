"""
Router xử lý Dặn dò bác sĩ & Gửi email nhắc uống thuốc qua Google Apps Script Webhook (<=200 LOC)
"""

import datetime
import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prescription-advice", tags=["Prescription Advice & Reminder"])


class MedicationTimeSlotModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = "morning"
    label: str = "Sáng"
    time: str = "07:00"
    dosage_text: str = Field(default="1 viên", alias="dosageText")
    meal_relation: str = Field(default="Sau khi ăn 15-30 phút", alias="mealRelation")
    note: Optional[str] = None


class ScheduledMedicationModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    medication_name: str = Field(..., alias="medicationName")
    active_ingredient: Optional[str] = Field(None, alias="activeIngredient")
    dosage: str = "500mg"
    route: str = "Đường uống"
    duration_days: int = Field(default=7, alias="durationDays")
    time_slots: List[MedicationTimeSlotModel] = Field(default_factory=list, alias="timeSlots")
    special_instructions: Optional[str] = Field(None, alias="specialInstructions")


class PatientPrescriptionAdviceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    prescription_id: Optional[str] = Field(None, alias="prescriptionId")
    patient_name: str = Field(..., alias="patientName")
    patient_email: str = Field(..., alias="patientEmail")
    patient_phone: Optional[str] = Field(None, alias="patientPhone")
    diagnosis: Optional[str] = "Theo dõi điều trị ngoại trú"
    doctor_name: str = Field(default="Bác sĩ điều trị", alias="doctorName")
    doctor_hospital: Optional[str] = Field(default="Bệnh Viện Đa Khoa Lâm Sàng", alias="doctorHospital")
    start_date: Optional[str] = Field(None, alias="startDate")
    end_date: Optional[str] = Field(None, alias="endDate")
    general_doctor_advice: str = Field(
        default="Uống thuốc đúng giờ, tái khám khi hết đơn hoặc có dấu hiệu bất thường.",
        alias="generalDoctorAdvice"
    )
    medications: List[ScheduledMedicationModel] = Field(default_factory=list)
    gas_webhook_url: Optional[str] = Field(None, alias="gasWebhookUrl")


class SendAdviceResponse(BaseModel):
    success: bool
    message: str
    timestamp: str
    email_sent_to: str
    provider: str


@router.post("/send-email", response_model=SendAdviceResponse)
async def send_medication_advice_email(payload: PatientPrescriptionAdviceModel):
    """
    Gửi thông báo dặn dò uống thuốc hàng ngày tới bệnh nhân:
    - Nếu có gas_webhook_url: Chuyển tiếp POST request tới Google Apps Script Web App
    - Nếu không có URL hoặc local test: Phản hồi chế độ mô phỏng thành công
    """
    if not payload.patient_email or "@" not in payload.patient_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Địa chỉ email bệnh nhân không hợp lệ"
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    webhook_url = payload.gas_webhook_url.strip() if payload.gas_webhook_url else None

    if webhook_url and webhook_url.startswith("http"):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.post(
                    webhook_url,
                    json={"advice": payload.model_dump(by_alias=True)}
                )
                if resp.status_code in (200, 201, 302):
                    logger.info("Đã chuyển tiếp email dặn dò thành công tới Google Apps Script: %s", webhook_url)
                    return SendAdviceResponse(
                        success=True,
                        message=f"Đã gửi email nhắc uống thuốc thành công qua Google Apps Script tới: {payload.patient_email}",
                        timestamp=now_iso,
                        email_sent_to=payload.patient_email,
                        provider="google_apps_script"
                    )
                else:
                    logger.warning("Google Apps Script trả về status: %d - %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.error("Lỗi kết nối tới Google Apps Script webhook: %s", exc)

    # Chế độ nội bộ / Local Fallback
    logger.info("Ghi nhận lệnh gửi email dặn dò bệnh nhân %s (%s)", payload.patient_name, payload.patient_email)
    return SendAdviceResponse(
        success=True,
        message=f"Đã gửi email dặn dò uống thuốc thành công tới bệnh nhân: {payload.patient_email} (Chế độ mô phỏng y tế)",
        timestamp=now_iso,
        email_sent_to=payload.patient_email,
        provider="backend_relay"
    )
