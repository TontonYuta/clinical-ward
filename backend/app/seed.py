import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.models.debt import DebtRecord
from app.models.equipment import EquipmentTicket
from app.models.inventory import InventoryBatch
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.models.asset import AssetRecord
from app.models.audit import AuditRecord
from app.seed_registry import seed_dav_registry_if_needed

USERS_DATA = [
    {
        "id": "u-1", "role": "nurse", "name": "ĐD. Lê Thị Thu", "role_name": "Điều Dưỡng Ca Trực",
        "department": "Khoa Cấp Cứu A9", "practice_certificate": "004812/HN-CCHN",
        "pin_code": "1111", "rfid_card_id": "RFID-NURSE-8821",
        "responsibilities": "Ghi nợ thuốc cấp cứu ca đêm (TT 22), báo hỏng máy/phụ kiện (NĐ 98), nộp vỏ ống Morphin (TT 20)"
    },
    {
        "id": "u-2", "role": "biomedical_engineer", "name": "KS. Đặng Văn Nam", "role_name": "Kỹ Sư Trang Thiết Bị Y Tế",
        "department": "Phòng Vật Tư - TBYT", "practice_certificate": "BME-204/VTYT",
        "pin_code": "3333", "rfid_card_id": "RFID-BME-6672",
        "responsibilities": "Tiếp nhận sửa máy, quản lý sổ lý lịch máy, theo dõi hạn tem kiểm định (NĐ 98), kiểm kê 31/12 (NĐ 151)"
    },
    {
        "id": "u-3", "role": "pharmacist", "name": "DS. Nguyễn Bích Ngọc", "role_name": "Dược Sĩ Kho Dược",
        "department": "Kho Dược Lâm Sàng", "practice_certificate": "001098/BYT-CCHN",
        "pin_code": "2222", "rfid_card_id": "RFID-PHARM-1190",
        "responsibilities": "Duyệt hoàn bù nợ phiếu (TT 22), xuất kho FEFO (TT 36), giám sát chuỗi lạnh vắc xin, chủ trì hủy vỏ Morphin (TT 20)"
    },
    {
        "id": "u-4", "role": "doctor", "name": "BS. Trần Văn Hùng", "role_name": "Bác Sĩ Điều Trị",
        "department": "Khoa Hồi Sức Tích Cực (ICU)", "practice_certificate": "002341/HN-CCHN",
        "pin_code": "4444", "rfid_card_id": "RFID-DOC-9943",
        "responsibilities": "Kê đơn bù thuốc cấp cứu (TT 22), ký biên bản làm chứng hủy vỏ Morphin (TT 20), nghiệm thu máy tiếp nhận (NĐ 98)"
    },
    {
        "id": "u-5", "role": "director", "name": "TS.BS. Nguyễn Văn An", "role_name": "Ban Giám Đốc Bệnh Viện",
        "department": "Ban Giám Đốc", "practice_certificate": "001002/BYT-CCHN",
        "pin_code": "9999", "rfid_card_id": "RFID-DIR-0001",
        "responsibilities": "Phê duyệt thanh lý tài sản nhà nước (NĐ 151), giải phóng lô vắc xin sau sự cố chuỗi lạnh, giám sát toàn viện"
    }
]

DEBTS_DATA = [
    {"id": "d-1", "code": "PN-2026-089", "item_name": "Morphin sulfat 10mg/1ml", "item_type": "Thuốc gây nghiện", "quantity": 2, "patient_name": "Võ Minh Trí (BN-8820)", "patient_room": "Buồng cấp cứu 3 - Giường 02", "borrow_time": "01:40 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Cấp cứu đau thắt ngực nhồi máu cơ tim cấp", "status": "debt", "ampoule_returned": False, "ampoule_destroyed": False},
    {"id": "d-2", "code": "PN-2026-090", "item_name": "Dây truyền dịch có bầu đếm giọt", "item_type": "Vật tư tiêu hao", "quantity": 1, "patient_name": "Võ Minh Trí (BN-8820)", "patient_room": "Buồng cấp cứu 3 - Giường 02", "borrow_time": "01:45 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Thiết lập đường truyền tĩnh mạch khẩn cấp", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-3", "code": "PN-2026-085", "item_name": "Fentanyl 0.1mg/2ml", "item_type": "Thuốc gây nghiện", "quantity": 1, "patient_name": "Nguyễn Hải Đăng (BN-8791)", "patient_room": "Phòng mổ 1 - Phẫu thuật thần kinh", "borrow_time": "19:15 PM", "borrower": "BS. Trần Văn Hùng", "clinical_reason": "Khởi mê phẫu thuật sọ não cấp cứu", "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-4", "code": "PN-2026-088", "item_name": "Kháng sinh Ceftriaxone 1g (Lọ bột pha tiêm)", "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Hoàng Kim Dung (BN-8812)", "patient_room": "Hồi sức tích cực ICU - Giường 05", "borrow_time": "23:30 PM", "borrower": "ĐD. Phạm Thu Trang", "clinical_reason": "Nhiễm khuẩn huyết nặng, suy đa tạng", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-5", "code": "PN-2026-091", "item_name": "Adrenalin 1mg/1ml (Epinephrine)", "item_type": "Thuốc cấp cứu", "quantity": 3, "patient_name": "Đặng Thị Lan (BN-8825)", "patient_room": "Khoa Cấp cứu A9 - Buồng Sốc phản vệ", "borrow_time": "02:10 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Cấp cứu sốc phản vệ độ 3 sau tiêm thuốc cản quang (phác đồ TT 51/2017)", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-6", "code": "PN-2026-092", "item_name": "Noradrenalin 4mg/4ml (Norepinephrine)", "item_type": "Thuốc cấp cứu", "quantity": 4, "patient_name": "Trần Văn Toàn (BN-8819)", "patient_room": "Hồi sức tích cực ICU - Giường 02", "borrow_time": "03:00 AM", "borrower": "BS. Trần Văn Hùng", "clinical_reason": "Sốc nhiễm trùng tụt huyết áp kháng dịch, duy trì vận mạch", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-7", "code": "PN-2026-083", "item_name": "Diazepam 10mg/2ml (Seduxen)", "item_type": "Thuốc gây nghiện", "quantity": 2, "patient_name": "Lê Hoàng Nam (BN-8830)", "patient_room": "Buồng cấp cứu Thần kinh - Giường 01", "borrow_time": "00:25 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Cắt cơn co giật động kinh liên tục", "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-8", "code": "PN-2026-093", "item_name": "Catheter tĩnh mạch trung tâm 3 nòng CVC 7Fr 20cm", "item_type": "Vật tư tiêu hao", "quantity": 1, "patient_name": "Phạm Thị Mai (BN-8814)", "patient_room": "Hồi sức Ngoại - Giường 04", "borrow_time": "04:15 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Đặt catheter tĩnh mạch trung tâm đo CVP và truyền dịch nuôi dưỡng", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-9", "code": "PN-2026-082", "item_name": "Atropin sulfat 0.25mg/ml", "item_type": "Thuốc cấp cứu", "quantity": 2, "patient_name": "Vũ Đình Hưng (BN-8833)", "patient_room": "Cấp cứu A9 - Giường 06", "borrow_time": "01:15 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Nhịp chậm xoang nguy kịch đe dọa ngừng tuần hoàn", "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-10", "code": "PN-2026-081", "item_name": "Nhũ dịch Lipid 20% Lipofundin MCT/LCT 100ml", "item_type": "Thuốc cấp cứu", "quantity": 1, "patient_name": "Nguyễn Thị Yến (BN-8798)", "patient_room": "Phòng mổ 3 - Gây mê hồi sức", "borrow_time": "21:40 PM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Giải độc ngộ độc thuốc tê toàn thân LAST sau gây tê tủy sống", "status": "settled", "ampoule_returned": True, "ampoule_destroyed": False},
    {"id": "d-11", "code": "PN-2026-094", "item_name": "Morphin sulfat 10mg/1ml", "item_type": "Thuốc gây nghiện", "quantity": 1, "patient_name": "Bùi Đức Mạnh (BN-8835)", "patient_room": "Khoa Ngoại Chấn Thương - Giường 11", "borrow_time": "03:45 AM", "borrower": "ĐD. Lê Thị Thu", "clinical_reason": "Đa chấn thương gãy hở xương đùi độ III, giảm đau tiền phẫu", "status": "debt", "ampoule_returned": False, "ampoule_destroyed": False},
    {"id": "d-12", "code": "PN-2026-095", "item_name": "Bộ dây thở máy 2 nhánh người lớn kèm bẫy nước", "item_type": "Vật tư tiêu hao", "quantity": 1, "patient_name": "Nguyễn Quốc Bảo (BN-8810)", "patient_room": "Hồi sức tích cực ICU - Giường 09", "borrow_time": "02:40 AM", "borrower": "ĐD. Phạm Thu Trang", "clinical_reason": "Thay dây máy thở khẩn cấp do bệnh nhân cắn vỡ đầu nối bẫy nước", "status": "debt", "ampoule_returned": True, "ampoule_destroyed": False}
]

EQUIPMENT_DATA = [
    {
        "id": "eq-1", "code": "SC-2026-042", "device_name": "Máy thở Puritan Bennett 840 (PB840)",
        "device_model": "Puritan Bennett 840 - Medtronic", "serial_number": "PB840-VN-2021-998", "risk_class": "D",
        "location": "Phòng mổ 2 - Tầng 3 (Khu Phẫu Thuật)", "accessory_issue": "Dây thở silicon nứt khớp nối gây xì khí áp lực thấp (Ppeak giảm)",
        "urgency": "urgent", "status": "reported", "assigned_engineer": "KS. Đặng Văn Nam (Phòng Vật tư - TBYT)",
        "next_inspection_due": "15/04/2027", "inspection_unit": "Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 1 (Quatest 1)",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Thiết bị loại D can thiệp trực tiếp tính mạng",
        "action_log": ["02:15 AM: Nhận cảnh báo xì khí từ phòng mổ 2", "02:20 AM: Tự động điều phối dây thở dự phòng tiệt trùng tại Kho A1", "02:35 AM: KS. Đặng Văn Nam tiếp nhận ticket, tiến hành thay thế và test kín khí"]
    },
    {
        "id": "eq-2", "code": "SC-2026-039", "device_name": "Máy sốc tim Zoll R Series",
        "device_model": "Zoll R Series Defibrillator BLS/ALS", "serial_number": "ZOLL-R-8831", "risk_class": "D",
        "location": "Khoa Cấp Cứu A9 - Xe tiêm số 1", "accessory_issue": "Bản cực sốc tim ngoài lồng ngực (Paddles) bị tróc lớp phủ tiếp xúc",
        "urgency": "normal", "status": "resolved", "assigned_engineer": "KS. Bùi Quốc Bảo (Phòng Vật tư - TBYT)",
        "next_inspection_due": "10/11/2026 (Còn 26 ngày)", "inspection_unit": "Viện Trang thiết bị và Công trình Y tế (NIEMET)",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Điều 54 Kiểm định định kỳ thiết bị rủi ro cao",
        "action_log": ["Đã thay thế bộ bản cực mới chính hãng Zoll", "Đã test xung năng lượng 200J đạt chuẩn", "Lên lịch kiểm định dán tem chu kỳ 2026-2027 với Viện TBYT"]
    },
    {
        "id": "eq-3", "code": "SC-2026-041", "device_name": "Máy theo dõi bệnh nhân Philips MP50",
        "device_model": "Philips IntelliVue MP50 Monitor", "serial_number": "PHI-MP50-4102", "risk_class": "C",
        "location": "Hồi sức tích cực ICU - Giường 08", "accessory_issue": "Cáp đo SpO2 người lớn chập chờn tín hiệu Pleth",
        "urgency": "warning", "status": "reported", "assigned_engineer": "KS. Đặng Văn Nam",
        "next_inspection_due": "01/06/2027", "inspection_unit": "Quatest 1",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Kiểm tra bảo dưỡng định kỳ",
        "action_log": ["Chờ kỹ sư bàn giao cáp SpO2 Nellcor tương thích từ kho dự trữ"]
    },
    {
        "id": "eq-4", "code": "SC-2026-043", "device_name": "Hệ thống lọc máu liên tục CRRT Prismaflex",
        "device_model": "Prismaflex System v8.0 - Baxter", "serial_number": "PRISMA-VN-2022-014", "risk_class": "D",
        "location": "Hồi sức tích cực ICU - Buồng lọc máu", "accessory_issue": "Cảm biến áp lực xuyên màng TMP vượt ngưỡng cảnh báo 350 mmHg",
        "urgency": "urgent", "status": "in_repair", "assigned_engineer": "KS. Đặng Văn Nam",
        "next_inspection_due": "20/03/2027", "inspection_unit": "Quatest 1",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Thiết bị loại D can thiệp trực tiếp tính mạng",
        "action_log": ["03:10 AM: Báo lỗi đông màng lọc hoặc tăng áp lực dịch siêu lọc", "03:25 AM: Kỹ sư phối hợp bác sĩ xả rửa bolus heparin và cân chỉnh sensor áp lực"]
    },
    {
        "id": "eq-5", "code": "SC-2026-044", "device_name": "Bơm tiêm điện B.Braun Perfusor Space",
        "device_model": "Perfusor Space - B.Braun Germany", "serial_number": "BBR-PERF-9921", "risk_class": "C",
        "location": "Khoa Cấp Cứu A9 - Xe tiêm 02", "accessory_issue": "Cell pin tích điện NiMH bị chai, nguồn sụt dưới 10 phút khi rút phích cắm AC 220V",
        "urgency": "warning", "status": "reported", "assigned_engineer": "KS. Bùi Quốc Bảo",
        "next_inspection_due": "12/08/2026 (Đã quá hạn dán tem)", "inspection_unit": "Viện Trang thiết bị và Công trình Y tế (NIEMET)",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Kiểm định an toàn điện lực thiết bị y tế",
        "action_log": ["Đề xuất thay thế pack pin NiMH chính hãng và dán tem kiểm định lại"]
    },
    {
        "id": "eq-6", "code": "SC-2026-040", "device_name": "Máy thở Maquet Servo-i Universal",
        "device_model": "Servo-i - Getinge Maquet Sweden", "serial_number": "MAQ-SERVOI-3104", "risk_class": "D",
        "location": "Khoa Hồi Sức Ngoại - Giường 03", "accessory_issue": "O2 Cell (cảm biến nồng độ oxy FiO2) bị cạn hóa chất đo sai lệch 8%",
        "urgency": "normal", "status": "resolved", "assigned_engineer": "KS. Đặng Văn Nam",
        "next_inspection_due": "05/05/2027", "inspection_unit": "Quatest 1",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Điều 34 Quản lý thiết bị loại D",
        "action_log": ["Đã thay O2 Cell chính hãng Getinge", "Hiệu chuẩn 2 điểm FiO2 21% và 100% đạt chuẩn", "Đã thử tải thông khí phổi giả 60 phút đạt chuẩn lâm sàng"]
    },
    {
        "id": "eq-7", "code": "SC-2026-038", "device_name": "Máy phá rung tim Philips HeartStart XL",
        "device_model": "HeartStart XL M4735A - Philips", "serial_number": "PHI-HSXL-7712", "risk_class": "D",
        "location": "Phòng Hồi Tỉnh - Khu Phẫu Thuật", "accessory_issue": "Hạn kiểm định đo lường năng lượng xung phóng hết hạn chu kỳ 2026",
        "urgency": "normal", "status": "resolved", "assigned_engineer": "KS. Bùi Quốc Bảo",
        "next_inspection_due": "28/10/2026 (Còn 12 ngày)", "inspection_unit": "Viện Trang thiết bị và Công trình Y tế (NIEMET)",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Kiểm định định kỳ hằng năm",
        "action_log": ["Đã đo kiểm năng lượng phóng 50J, 100J, 200J, 360J sai số dưới 3%", "Hồ sơ đã chuyển cho đơn vị kiểm định dán tem chu kỳ 2026-2027"]
    },
    {
        "id": "eq-8", "code": "SC-2026-046", "device_name": "Máy đo khí máu và điện giải Radiometer ABL90 FLEX",
        "device_model": "ABL90 FLEX PLUS - Radiometer Denmark", "serial_number": "RAD-ABL90-5541", "risk_class": "C",
        "location": "Phòng Xét Nghiệm Nhanh ICU", "accessory_issue": "Sensor Cassette báo lỗi tắc buồng đo heparinize hút mẫu máu",
        "urgency": "warning", "status": "in_repair", "assigned_engineer": "KS. Đặng Văn Nam",
        "next_inspection_due": "10/02/2027", "inspection_unit": "Quatest 1",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Thiết bị xét nghiệm chẩn đoán in vitro",
        "action_log": ["Tiến hành chu trình Flush xả rửa tự động với dung dịch Clenz", "Đã thay màng lọc mẫu máu mao dẫn mới"]
    },
    {
        "id": "eq-9", "code": "SC-2026-047", "device_name": "Bình làm ẩm thở máy Fisher & Paykel MR850",
        "device_model": "MR850 Heated Respiratory Humidifier", "serial_number": "FP-MR850-8802", "risk_class": "C",
        "location": "Hồi sức tích cực ICU - Giường 04", "accessory_issue": "Đầu dò nhiệt độ dây nhiệt buồng ẩm báo lỗi E102",
        "urgency": "urgent", "status": "in_repair", "assigned_engineer": "KS. Đặng Văn Nam",
        "next_inspection_due": "18/07/2027", "inspection_unit": "Quatest 1",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Phụ kiện thiết bị hồi sức hô hấp",
        "action_log": ["Cảnh báo nhiệt độ khí thở đầu vào ống nội khí quản giảm dưới 32°C", "Đã thay thế cụm probe nhiệt độ dự phòng chính hãng Fisher & Paykel"]
    },
    {
        "id": "eq-10", "code": "SC-2026-037", "device_name": "Máy điện tim 12 cần Nihon Kohden Cardiofax M",
        "device_model": "Cardiofax M ECG-1250K - Nihon Kohden Japan", "serial_number": "NK-ECG12-1089", "risk_class": "B",
        "location": "Phòng Khám Cấp Cứu 1", "accessory_issue": "Bộ dây cáp bệnh nhân 10 đầu đạo trình bị đứt ngầm dây V2-V4 gây nhiễu sóng",
        "urgency": "normal", "status": "resolved", "assigned_engineer": "KS. Bùi Quốc Bảo",
        "next_inspection_due": "02/09/2027", "inspection_unit": "Trung tâm Đo lường Chất lượng 3",
        "legal_basis": "Nghị định 98/2021/NĐ-CP - Kiểm định tính năng kỹ thuật",
        "action_log": ["Đã thay dây cáp bệnh nhân 10 đạo trình chống nhiễu AC 50Hz", "Đã test chuẩn trên thiết bị phát tín hiệu mô phỏng ECG đạt 100%"]
    }
]

from app.seed_inventory_data import INVENTORY_DATA

ASSETS_DATA = [
    {"id": "ast-1", "code": "TS-2026-001", "device_name": "Máy thở Puritan Bennett 840 (PB840)", "model": "PB840 Ventilator - Medtronic", "serial_number": "PB840-VN-2021-998", "risk_class": "D", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Phòng Mổ 2 (Khu Phẫu Thuật)", "is_misallocated": True, "depreciation_rate_percent": 40, "operating_years": 4, "pending_liquidation": False, "last_scanned_at": "08:30 AM - Kiểm kê buồng mổ"},
    {"id": "ast-2", "code": "TS-2026-002", "device_name": "Máy X-Quang di động C-Arm Shimadzu", "model": "OEC-9900 C-Arm System", "serial_number": "SHIM-CARM-2015-11", "risk_class": "C", "registered_department": "Khoa Chẩn Đoán Hình Ảnh", "actual_department": "Kho Phế Liệu Tầng Hầm Bệnh Viện", "is_misallocated": False, "depreciation_rate_percent": 95, "operating_years": 10, "pending_liquidation": False, "last_scanned_at": "09:15 AM - Kiểm kê kho phế liệu"},
    {"id": "ast-3", "code": "TS-2026-003", "device_name": "Máy sốc tim Zoll R Series", "model": "Zoll R Series BLS/ALS Defibrillator", "serial_number": "ZOLL-R-8831", "risk_class": "D", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Khoa Cấp Cứu A9", "is_misallocated": False, "depreciation_rate_percent": 30, "operating_years": 3, "pending_liquidation": False, "last_scanned_at": "07:45 AM - Xe tiêm cấp cứu A9"},
    {"id": "ast-4", "code": "TS-2026-004", "device_name": "Máy theo dõi bệnh nhân Philips MP50", "model": "IntelliVue MP50 Patient Monitor", "serial_number": "PHI-MP50-4102", "risk_class": "C", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Hồi Sức Tích Cực ICU - Giường 08", "is_misallocated": True, "depreciation_rate_percent": 50, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "08:10 AM - Quét buồng ICU"},
    {"id": "ast-5", "code": "TS-2026-005", "device_name": "Máy điện tim 6 cần Fukuda Denshi", "model": "Cardimax FX-7202 ECG", "serial_number": "FKD-FX7202-094", "risk_class": "B", "registered_department": "Khoa Ngoại Chấn Thương", "actual_department": "Kho Vật Tư Hỏng - Phòng 104", "is_misallocated": False, "depreciation_rate_percent": 100, "operating_years": 8, "pending_liquidation": True, "last_scanned_at": "09:30 AM - Rà soát thiết bị loại B"},
    {"id": "ast-6", "code": "TS-2026-006", "device_name": "Hệ thống lọc máu liên tục CRRT Prismaflex", "model": "Prismaflex v8.0 - Baxter", "serial_number": "PRISMA-VN-2022-014", "risk_class": "D", "registered_department": "Hồi Sức Tích Cực (ICU)", "actual_department": "Hồi Sức Tích Cực (ICU)", "is_misallocated": False, "depreciation_rate_percent": 35, "operating_years": 3, "pending_liquidation": False, "last_scanned_at": "08:45 AM - Buồng lọc máu ICU"},
    {"id": "ast-7", "code": "TS-2026-007", "device_name": "Máy thở Maquet Servo-i Universal", "model": "Servo-i Universal Ventilator", "serial_number": "MAQ-SERVOI-3104", "risk_class": "D", "registered_department": "Khoa Hồi Sức Ngoại", "actual_department": "Khoa Hồi Sức Ngoại", "is_misallocated": False, "depreciation_rate_percent": 45, "operating_years": 4, "pending_liquidation": False, "last_scanned_at": "08:20 AM - Buồng Hồi Sức 3"},
    {"id": "ast-8", "code": "TS-2026-008", "device_name": "Máy phá rung tim Philips HeartStart XL", "model": "HeartStart XL M4735A", "serial_number": "PHI-HSXL-7712", "risk_class": "D", "registered_department": "Khoa Can Thiệp Tim Mạch", "actual_department": "Phòng Hồi Tỉnh - Khu Phẫu Thuật", "is_misallocated": True, "depreciation_rate_percent": 60, "operating_years": 6, "pending_liquidation": False, "last_scanned_at": "09:05 AM - Kiểm kê khu mổ"},
    {"id": "ast-9", "code": "TS-2026-009", "device_name": "Bơm tiêm điện B.Braun Perfusor Space", "model": "Perfusor Space Infusion Pump", "serial_number": "BBR-PERF-9921", "risk_class": "C", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Khoa Cấp Cứu A9", "is_misallocated": False, "depreciation_rate_percent": 50, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "07:55 AM - Xe tiêm Cấp Cứu"},
    {"id": "ast-10", "code": "TS-2026-010", "device_name": "Máy siêu âm tim màu 4D GE Vivid E95", "model": "Vivid E95 4D Ultrasound System", "serial_number": "GE-VE95-2018-03", "risk_class": "C", "registered_department": "Khoa Can Thiệp Tim Mạch", "actual_department": "Khoa Can Thiệp Tim Mạch", "is_misallocated": False, "depreciation_rate_percent": 55, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "09:40 AM - Phòng Siêu Âm Tim"},
    {"id": "ast-11", "code": "TS-2026-011", "device_name": "Máy hút dịch áp lực âm di động Atmos Record 55", "model": "Atmos Record 55 Mobile Suction", "serial_number": "ATM-REC55-1022", "risk_class": "B", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Kho Thiết Bị Tầng 2", "is_misallocated": True, "depreciation_rate_percent": 70, "operating_years": 7, "pending_liquidation": False, "last_scanned_at": "10:00 AM - Quét mã kho đệm"},
    {"id": "ast-12", "code": "TS-2026-012", "device_name": "Máy ly tâm lạnh túi máu Hettich Roto Silenta 630RS", "model": "Roto Silenta 630RS Refrigerated Centrifuge", "serial_number": "HET-ROTO-2012-01", "risk_class": "B", "registered_department": "Đơn Vị Huyết Học Truyền Máu", "actual_department": "Kho Phế Liệu Tầng Hầm", "is_misallocated": False, "depreciation_rate_percent": 100, "operating_years": 12, "pending_liquidation": True, "last_scanned_at": "10:15 AM - Rà soát thiết bị thanh lý"}
]

AUDIT_DATA = [
    {
        "id": "AUD-2026-0091", "timestamp": "2026-10-15 19:20:14", "action_type": "SETTLE_DEBT",
        "action_title": "Hoàn bù cơ số Fentanyl 0.1mg/2ml tủ trực cấp cứu", "target_item": "PN-2026-085 (Fentanyl 0.1mg/2ml x 1 ống)",
        "legal_basis": "Điều 10 Thông tư 22/2011/TT-BYT", "signer_name": "ĐD. Lê Thị Thu",
        "signer_certificate": "004812/HN-CCHN", "witness_name": "BS. Trần Văn Hùng", "witness_certificate": "002341/HN-CCHN",
        "auth_method": "RFID_NFC", "previous_hash": "GENESIS_BLOCK_HOSPITAL_AUDIT_2026",
        "integrity_hash": "930a45042ded56a9c4e95ba76c8519756857441457d4f1af81b9c3173f604465",
        "payload_data": {"ticket_code": "PN-2026-085", "action": "SETTLE"}
    }
]

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(User.__table__.delete())
        await conn.execute(DebtRecord.__table__.delete())
        await conn.execute(EquipmentTicket.__table__.delete())
        await conn.execute(InventoryBatch.__table__.delete())
        await conn.execute(ColdChainCurrentState.__table__.delete())
        await conn.execute(ColdChainTelemetry.__table__.delete())
        await conn.execute(AssetRecord.__table__.delete())
        await conn.execute(AuditRecord.__table__.delete())

    async with AsyncSessionLocal() as session:
        # 1. Users
        for u in USERS_DATA:
            session.add(User(**u))

        # 2. Debts
        for d in DEBTS_DATA:
            session.add(DebtRecord(**d))

        # 3. Equipment
        for eq in EQUIPMENT_DATA:
            session.add(EquipmentTicket(**eq))

        # 4. Inventory Batches
        for b in INVENTORY_DATA:
            session.add(InventoryBatch(**b))

        # 5. Cold Chain State & Logs
        state = ColdChainCurrentState(
            id=1, current_temp=4.5, is_outage=False, is_quarantined=False,
            vvm_level=1, mkt_temp=5.6, outage_minutes=0, total_vaccine_doses=1250
        )
        session.add(state)
        sample_telemetry = [
            ColdChainTelemetry(timestamp="00:00", temperature=4.2),
            ColdChainTelemetry(timestamp="04:00", temperature=4.5),
            ColdChainTelemetry(timestamp="08:00", temperature=4.8),
            ColdChainTelemetry(timestamp="12:00", temperature=5.1),
            ColdChainTelemetry(timestamp="16:00", temperature=4.6),
            ColdChainTelemetry(timestamp="20:00", temperature=4.3),
        ]
        for t in sample_telemetry:
            session.add(t)

        # 6. Assets
        for ast in ASSETS_DATA:
            session.add(AssetRecord(**ast))

        # 7. Audit records
        for aud in AUDIT_DATA:
            session.add(AuditRecord(**aud))

        await session.commit()
        seed_dav_registry_if_needed()
        print("Successfully seeded all hospital clinical datasets into database!")

if __name__ == "__main__":
    asyncio.run(seed())
