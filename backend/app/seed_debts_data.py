"""
Dữ liệu khởi tạo Sổ Nợ Vỏ Thuốc Cấp Cứu Tủ Trực Bệnh Viện (<=100 LOC)
100% thuốc thật khớp CSDL 54.885 Thuốc Cục Quản lý Dược (DAV) & TT 20/2017/TT-BYT
"""

DEBTS_DATA = [
    {
        "id": "d-1", "code": "PN-2026-089", "item_name": "Morphin (Morphin hydroclorid 10mg/ml)",
        "item_type": "Thuốc gây nghiện", "quantity": 2, "patient_name": "Võ Minh Trí (BN-8820)",
        "patient_room": "Buồng cấp cứu 3 - Giường 02", "borrow_time": "01:40 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Cấp cứu đau thắt ngực nhồi máu cơ tim cấp, bắt buộc thu hồi vỏ ống TT 20/2017",
        "status": "debt", "ampoule_returned": False, "ampoule_destroyed": False
    },
    {
        "id": "d-2", "code": "PN-2026-090", "item_name": "Kali clorid 10%",
        "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Võ Minh Trí (BN-8820)",
        "patient_room": "Buồng cấp cứu 3 - Giường 02", "borrow_time": "01:45 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Pha truyền bù điện giải khẩn cấp hạ kali máu nặng 2.4 mmol/L High-Alert",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-3", "code": "PN-2026-085", "item_name": "Fentanyl 50 micrograms/ml",
        "item_type": "Thuốc gây nghiện", "quantity": 1, "patient_name": "Nguyễn Hải Đăng (BN-8791)",
        "patient_room": "Phòng mổ 1 - Phẫu thuật thần kinh", "borrow_time": "19:15 PM", "borrower": "BS. Trần Văn Hùng",
        "clinical_reason": "Khởi mê phẫu thuật sọ não cấp cứu, đã nộp khay vỏ ống đối soát",
        "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-4", "code": "PN-2026-088", "item_name": "Ceftriaxona Normon 1g",
        "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Hoàng Kim Dung (BN-8812)",
        "patient_room": "Hồi sức tích cực ICU - Giường 05", "borrow_time": "23:30 PM", "borrower": "ĐD. Phạm Thu Trang",
        "clinical_reason": "Nhiễm khuẩn huyết nặng, suy đa tạng, tiêm kháng sinh khẩn",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-5", "code": "PN-2026-091", "item_name": "Hadunalin 1 mg/ml (Adrenalin)",
        "item_type": "Thuốc cấp cứu", "quantity": 3, "patient_name": "Đặng Thị Lan (BN-8825)",
        "patient_room": "Khoa Cấp cứu A9 - Buồng Sốc phản vệ", "borrow_time": "02:10 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Cấp cứu sốc phản vệ độ 3 theo phác đồ Thông tư 51/2017/TT-BYT",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-6", "code": "PN-2026-092", "item_name": "Noradrenalin 4mg/4ml",
        "item_type": "Thuốc cấp cứu", "quantity": 4, "patient_name": "Trần Văn Toàn (BN-8819)",
        "patient_room": "Hồi sức tích cực ICU - Giường 02", "borrow_time": "03:00 AM", "borrower": "BS. Trần Văn Hùng",
        "clinical_reason": "Sốc nhiễm trùng tụt huyết áp kháng dịch, duy trì vận mạch qua bơm tiêm điện",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-7", "code": "PN-2026-083", "item_name": "Diazepam Injection BP 10mg/2ml",
        "item_type": "Thuốc gây nghiện", "quantity": 2, "patient_name": "Lê Hoàng Nam (BN-8830)",
        "patient_room": "Buồng cấp cứu Thần kinh - Giường 01", "borrow_time": "00:25 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Cắt cơn co giật động kinh liên tục, đã nộp vỏ hoàn tất",
        "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-8", "code": "PN-2026-093", "item_name": "Meroright 1g (Meropenem)",
        "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Phạm Thị Mai (BN-8814)",
        "patient_room": "Hồi sức Ngoại - Giường 04", "borrow_time": "04:15 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Kháng sinh phổ rộng cấp cứu nhiễm trùng ổ bụng sau phẫu thuật",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-9", "code": "PN-2026-082", "item_name": "Salbutamol 2,5 mg/ 2,5 ml",
        "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Vũ Đình Hưng (BN-8833)",
        "patient_room": "Cấp cứu A9 - Giường 06", "borrow_time": "01:15 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Khí dung cấp cứu cắt cơn co thắt phế quản ác tính, đã bù cơ số",
        "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-10", "code": "PN-2026-081", "item_name": "Lactated Ringer’s Injection/Vioser",
        "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Nguyễn Thị Yến (BN-8798)",
        "patient_room": "Phòng mổ 3 - Gây mê hồi sức", "borrow_time": "21:40 PM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Truyền dịch đa điện giải bù thể tích tuần hoàn cấp cứu",
        "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False
    },
    {
        "id": "d-11", "code": "PN-2026-094", "item_name": "Morphin (Morphin hydroclorid 10mg/ml)",
        "item_type": "Thuốc gây nghiện", "quantity": 1, "patient_name": "Bùi Đức Mạnh (BN-8835)",
        "patient_room": "Khoa Ngoại Chấn thương - Giường 11", "borrow_time": "03:45 AM", "borrower": "ĐD. Lê Thị Thu",
        "clinical_reason": "Giảm đau khẩn cấp đa chấn thương gãy hở xương đùi, chưa nộp vỏ",
        "status": "debt", "ampoule_returned": False, "ampoule_destroyed": False
    },
    {
        "id": "d-12", "code": "PN-2026-095", "item_name": "VANCOMYCIN 1g",
        "item_type": "Thuốc cấp cứu", "quantity": 1, "patient_name": "Nguyễn Quốc Bảo (BN-8810)",
        "patient_room": "Hồi sức tích cực ICU - Giường 09", "borrow_time": "02:40 AM", "borrower": "ĐD. Phạm Thu Trang",
        "clinical_reason": "Pha truyền tĩnh mạch chậm điều trị nhiễm khuẩn huyết do MRSA",
        "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False
    }
]
