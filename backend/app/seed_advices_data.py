"""
Dữ liệu khởi tạo Hồ sơ Dặn dò lâm sàng chuẩn Bộ Y tế (<=200 LOC)
"""

INITIAL_ADVICES_DATA = [
    {
        "id": "ADV-2026-001",
        "prescription_id": "RX-2026-0012",
        "patient_id": "BN-8820",
        "patient_name": "Võ Minh Trí",
        "patient_email": "tri.vm@hospital.vn",
        "patient_phone": "0912345678",
        "diagnosis": "Đau thắt ngực ổn định & Theo dõi sau cơn cấp",
        "doctor_name": "BS.CKII Trần Văn Hùng",
        "doctor_hospital": "Bệnh Viện Đa Khoa Lâm Sàng",
        "department": "Khoa Tim Mạch Can Thiệp",
        "start_date": "2026-10-27",
        "end_date": "2026-11-03",
        "general_doctor_advice": "Uống thuốc đúng giờ sau ăn, hạn chế muối và chất béo. Tái khám ngay nếu xuất hiện cơn đau thắt ngực trở lại.",
        "medications_json": '[{"medicationName":"Nitroglycerin 0.5mg ngậm dưới lưỡi","activeIngredient":"Nitroglycerin","dosage":"0.5mg","route":"Ngậm dưới lưỡi","durationDays":7,"timeSlots":[{"id":"morning","label":"Sáng","time":"07:30","dosageText":"Khi có cơn đau","mealRelation":"Bụng đói hoặc khi đau"}]},{"medicationName":"Bisoprolol 2.5mg","activeIngredient":"Bisoprolol fumarat","dosage":"2.5mg","route":"Đường uống","durationDays":14,"timeSlots":[{"id":"morning","label":"Sáng","time":"08:00","dosageText":"1 viên","mealRelation":"Sau ăn sáng"}]}]',
        "notification_status": "sent",
        "email_sent_at": "2026-10-27T08:30:00Z"
    }
]
