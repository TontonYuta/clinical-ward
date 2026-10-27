"""
Dữ liệu khởi tạo Bệnh nhân & Hồ sơ Dặn dò lâm sàng chuẩn Bộ Y tế (<=200 LOC)
"""

PATIENTS_DATA = [
    {
        "id": "BN-8820",
        "full_name": "Võ Minh Trí",
        "dob": "1968-05-14",
        "age": 58,
        "gender": "Nam",
        "cccd": "079068012345",
        "phone": "0912345678",
        "email": "tri.vm@hospital.vn",
        "room": "Buồng Cấp Cứu 3 - Giường 02",
        "allergies": "Penicillin, Aspirin (phù mạch, co thắt)",
        "chronic_conditions": "Tăng huyết áp vô căn, Bệnh mạch vành mạn",
        "egfr": 68.5,
        "creatinine": 92.0,
        "weight_kg": 67.0
    },
    {
        "id": "BN-8825",
        "full_name": "Đặng Thị Lan",
        "dob": "1964-11-20",
        "age": 62,
        "gender": "Nữ",
        "cccd": "079164098765",
        "phone": "0987654321",
        "email": "lan.dt@hospital.vn",
        "room": "Khoa Nội Tiết - Giường 08",
        "allergies": "Sulfonamide (Co-trimoxazole)",
        "chronic_conditions": "Đái tháo đường Tuýp 2, Rối loạn lipid máu",
        "egfr": 52.0,
        "creatinine": 110.0,
        "weight_kg": 58.0
    },
    {
        "id": "BN-8791",
        "full_name": "Nguyễn Hải Đăng",
        "dob": "1981-08-09",
        "age": 45,
        "gender": "Nam",
        "cccd": "001081005432",
        "phone": "0903112233",
        "email": "dang.nh@hospital.vn",
        "room": "Khoa Tiêu Hóa - Giường 04",
        "allergies": "Không ghi nhận dị ứng",
        "chronic_conditions": "Loét dạ dày tá tràng mạn tính, GERD",
        "egfr": 95.0,
        "creatinine": 75.0,
        "weight_kg": 72.0
    },
    {
        "id": "BN-9012",
        "full_name": "Trần Thị Mai",
        "dob": "1992-03-25",
        "age": 34,
        "gender": "Nữ",
        "cccd": "001192008899",
        "phone": "0934567890",
        "email": "mai.tt@hospital.vn",
        "room": "Khoa Khám Bệnh - Phòng 102",
        "allergies": "Không ghi nhận dị ứng",
        "chronic_conditions": "Hen phế quản nhẹ",
        "egfr": 105.0,
        "creatinine": 65.0,
        "weight_kg": 50.0
    },
    {
        "id": "BN-7701",
        "full_name": "Nguyễn Văn An",
        "dob": "1976-12-10",
        "age": 50,
        "gender": "Nam",
        "cccd": "079076001122",
        "phone": "0977889900",
        "email": "an.nv@gmail.com",
        "room": "Khoa Cơ Xương Khớp",
        "allergies": "Không ghi nhận dị ứng",
        "chronic_conditions": "Thoái hóa khớp gối",
        "egfr": 88.0,
        "creatinine": 82.0,
        "weight_kg": 65.0
    }
]

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
