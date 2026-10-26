"""
Dữ liệu khởi tạo Sự Cố Trang Thiết Bị Y Tế & Kiểm Định Bệnh Viện (Nghị định 98/2021) (<=110 LOC)
"""

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
