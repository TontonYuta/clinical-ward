"""
Dữ liệu khởi tạo Bệnh nhân & Hồ sơ Dặn dò lâm sàng chuẩn Bộ Y tế (<=200 LOC)
"""
from app.seed_patients_dataset import PATIENTS_EXTRA_DATA
from app.seed_advices_data import INITIAL_ADVICES_DATA

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
        "room": "Phòng mổ 1 - Phẫu thuật thần kinh",
        "allergies": "Không ghi nhận tiền sử dị ứng thuốc",
        "chronic_conditions": "Chấn thương sọ não kín, Loét dạ dày tá tràng mạn tính, GERD",
        "egfr": 95.0,
        "creatinine": 75.0,
        "weight_kg": 72.0
    },
    {
        "id": "BN-8812",
        "full_name": "Hoàng Kim Dung",
        "dob": "1968-11-20",
        "age": 58,
        "gender": "Nữ",
        "cccd": "034199023412",
        "phone": "0918234567",
        "email": "dung.hk@hospital.vn",
        "room": "Buồng ICU 1 - Giường 05",
        "allergies": "Kháng sinh nhóm Macrolid (Erythromycin)",
        "chronic_conditions": "Nhiễm khuẩn huyết nặng, Đái tháo đường Tuýp 2 phụ thuộc insulin",
        "egfr": 45.2,
        "creatinine": 135.0,
        "weight_kg": 60.0
    },
    {
        "id": "BN-8819",
        "full_name": "Trần Văn Toàn",
        "dob": "1980-02-18",
        "age": 46,
        "gender": "Nam",
        "cccd": "038080009182",
        "phone": "0981122334",
        "email": "toan.tv@hospital.vn",
        "room": "Buồng ICU 2 - Giường 02",
        "allergies": "Thuốc chống viêm không steroid (NSAIDs - Ibuprofen)",
        "chronic_conditions": "Sốc nhiễm trùng kháng dịch, Tổn thương thận cấp KDIGO giai đoạn 1",
        "egfr": 78.0,
        "creatinine": 88.0,
        "weight_kg": 70.0
    },
    {
        "id": "BN-8830",
        "full_name": "Lê Hoàng Nam",
        "dob": "1995-12-08",
        "age": 31,
        "gender": "Nam",
        "cccd": "001095018294",
        "phone": "0938445566",
        "email": "nam.lh@hospital.vn",
        "room": "Buồng Cấp cứu Thần kinh - Giường 01",
        "allergies": "Không ghi nhận tiền sử dị ứng thuốc",
        "chronic_conditions": "Cơn co giật động kinh toàn thể liên tục, Rối loạn giấc ngủ",
        "egfr": 110.0,
        "creatinine": 70.0,
        "weight_kg": 64.0
    }
] + PATIENTS_EXTRA_DATA

__all__ = ["PATIENTS_DATA", "INITIAL_ADVICES_DATA"]
