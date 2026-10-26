"""
Dữ liệu khởi tạo Kho Dược Bệnh Viện đồng bộ 100% CSDL 54.885 Thuốc Cục Quản lý Dược (<=200 LOC)
"""

INVENTORY_DATA = [
    {
        "id": "b-1", "shelf_life": "36 tháng", "applicant_name": "Công ty cổ phần Dược S. Pharm", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "PARACETAMOL 500mg", "national_code": "893100110026",
        "registration_number": "893100110026", "active_ingredient": "Paracetamol", "batch_number": "LOT-PC24-11A",
        "concentration": "500 mg", "dosage_form": "Viên nén bao phim", "manufacturer": "Công ty cổ phần Dược S. Pharm",
        "country": "Việt Nam", "packaging_spec": "Hộp 10 vỉ x 10 viên", "standard_pharmacopeia": "DĐVN V", "route": "Đường uống",
        "category": "Thuốc điều trị chuyên khoa", "expiry_date": "2026-11-05", "days_left": 10,
        "current_stock": 80, "min_threshold": 200, "max_threshold": 1000, "unit": "Viên",
        "warehouse_location": "Kho Dược Nội Trú (Kệ A1 - Tầng 1)", "is_near_expiry": True, "is_low_stock": True, "is_quarantined": False
    },
    {
        "id": "b-2", "shelf_life": "36 tháng", "applicant_name": "Laboratorios Normon, S.A.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Ceftriaxona Normon 1g", "national_code": "840110304425",
        "registration_number": "840110304425", "active_ingredient": "Ceftriaxon (dưới dạng ceftriaxon natri)", "batch_number": "LOT-CF24-03B",
        "concentration": "1g", "dosage_form": "Bột pha tiêm", "manufacturer": "Laboratorios Normon, S.A.",
        "country": "Tây Ban Nha", "packaging_spec": "Hộp 1 lọ", "standard_pharmacopeia": "NSX", "route": "Tiêm tĩnh mạch",
        "category": "Kháng sinh", "expiry_date": "2026-11-15", "days_left": 20,
        "current_stock": 45, "min_threshold": 100, "max_threshold": 500, "unit": "Lọ",
        "warehouse_location": "Kho Dược Nội Trú (Kệ B1 - Tầng 2)", "is_near_expiry": True, "is_low_stock": True, "is_quarantined": False
    },
    {
        "id": "b-3", "shelf_life": "24 tháng", "applicant_name": "Công ty Cổ phần Dược phẩm Trung ương Vidipha", "approval_decision": "QĐ 583/QĐ-QLD", "item_name": "Morphin (Morphin hydroclorid 10mg/ml)", "national_code": "893111093823",
        "registration_number": "893111093823", "active_ingredient": "Morphin hydroclorid", "batch_number": "LOT-MP24-X4",
        "concentration": "10mg/ml", "dosage_form": "Dung dịch tiêm", "manufacturer": "Chi nhánh Cty CPDP TW Vidipha Bình Dương",
        "country": "Việt Nam", "packaging_spec": "Hộp 10 Ống x 1ml", "standard_pharmacopeia": "DĐVN V", "route": "Tiêm dưới da / bắp / tĩnh mạch chậm",
        "category": "Thuốc gây nghiện", "expiry_date": "2026-11-25", "days_left": 30,
        "current_stock": 35, "min_threshold": 100, "max_threshold": 400, "unit": "Ống",
        "warehouse_location": "Tủ sắt thuốc độc gây nghiện (Khóa 2 lớp, TT 20/2017)", "is_near_expiry": True, "is_low_stock": True, "is_quarantined": False
    },
    {
        "id": "b-4", "shelf_life": "24 tháng", "applicant_name": "Cty CP Dược vật tư y tế Hải Dương", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Hadunalin 1 mg/ml", "national_code": "893110151100",
        "registration_number": "893110151100", "active_ingredient": "Adrenalin", "batch_number": "LOT-AD24-E1",
        "concentration": "1mg/ml", "dosage_form": "Dung dịch thuốc tiêm", "manufacturer": "Cty CP Dược vật tư y tế Hải Dương",
        "country": "Việt Nam", "packaging_spec": "Hộp 10 ống x 1ml", "standard_pharmacopeia": "DĐVN V", "route": "Tiêm bắp / Tiêm tĩnh mạch",
        "category": "Thuốc cấp cứu", "expiry_date": "2026-12-05", "days_left": 40,
        "current_stock": 30, "min_threshold": 80, "max_threshold": 300, "unit": "Ống",
        "warehouse_location": "Tủ cấp cứu Hồi sức A9 (Ngăn A - TT 51/2017)", "is_near_expiry": True, "is_low_stock": True, "is_quarantined": False
    },
    {
        "id": "b-5", "shelf_life": "36 tháng", "applicant_name": "Cty CPDP Vĩnh Phúc (Vinphaco)", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Kali clorid 10%", "national_code": "893110375223",
        "registration_number": "893110375223", "active_ingredient": "Kali clorid", "batch_number": "LOT-KC24-08",
        "concentration": "1g/10 ml", "dosage_form": "Dung dịch tiêm truyền", "manufacturer": "Cty CPDP Vĩnh Phúc (Vinphaco)",
        "country": "Việt Nam", "packaging_spec": "Hộp 10 vỉ x 5 Ống x 10ml", "standard_pharmacopeia": "DĐVN V", "route": "Pha truyền tĩnh mạch",
        "category": "Thuốc nguy cơ cao", "expiry_date": "2026-12-18", "days_left": 53,
        "current_stock": 60, "min_threshold": 100, "max_threshold": 500, "unit": "Ống",
        "warehouse_location": "Tủ thuốc Nguy cơ cao High-Alert (Dán nhãn cảnh báo đỏ)", "is_near_expiry": True, "is_low_stock": True, "is_quarantined": False
    },
    {
        "id": "b-6", "shelf_life": "24 tháng", "applicant_name": "Cty CPDP Vĩnh Phúc (Vinphaco)", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Noradrenalin 4mg/4ml", "national_code": "893110107400",
        "registration_number": "893110107400", "active_ingredient": "Noradrenalin (dưới dạng Noradrenalin tartrat)", "batch_number": "LOT-NA24-R3",
        "concentration": "4mg/4ml", "dosage_form": "Dung dịch thuốc tiêm", "manufacturer": "Cty CP Dược vật tư y tế Hải Dương",
        "country": "Việt Nam", "packaging_spec": "Hộp 10 ống x 4ml", "standard_pharmacopeia": "DĐVN V", "route": "Truyền tĩnh mạch qua bơm tiêm điện",
        "category": "Thuốc cấp cứu", "expiry_date": "2026-12-30", "days_left": 65,
        "current_stock": 120, "min_threshold": 60, "max_threshold": 300, "unit": "Ống",
        "warehouse_location": "Tủ cấp cứu Hồi sức A9 (Ngăn B)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-7", "shelf_life": "36 tháng", "applicant_name": "Swiss Parenterals Ltd.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Diazepam Injection BP 10mg/2ml", "national_code": "890112769224",
        "registration_number": "890112769224", "active_ingredient": "Diazepam 5mg/ml", "batch_number": "LOT-DZ25-01",
        "concentration": "10mg/2ml", "dosage_form": "Dung dịch tiêm", "manufacturer": "Swiss Parenterals Ltd.",
        "country": "Ấn Độ", "packaging_spec": "Hộp 10 ống x 2ml", "standard_pharmacopeia": "BP / NSX", "route": "Tiêm tĩnh mạch chậm / Tiêm bắp",
        "category": "Thuốc hướng thần", "expiry_date": "2027-01-20", "days_left": 86,
        "current_stock": 90, "min_threshold": 50, "max_threshold": 250, "unit": "Ống",
        "warehouse_location": "Tủ sắt thuốc hướng thần (Khóa kép, TT 20/2017)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-8", "shelf_life": "24 tháng (ở 2-8°C)", "applicant_name": "Viện Vắc xin và Sinh phẩm Y tế (IVAC)", "approval_decision": "QĐ 352/QĐ-QLD", "item_name": "Vaxigrip", "national_code": "300310033526",
        "registration_number": "300310033526", "active_ingredient": "Vắc xin cúm bất hoạt", "batch_number": "LOT-VX25-S1",
        "concentration": "0.5ml", "dosage_form": "Hỗn dịch tiêm", "manufacturer": "Sanofi Pasteur",
        "country": "Pháp", "packaging_spec": "Bơm tiêm nạp sẵn 1 liều 0.5ml", "standard_pharmacopeia": "NSX", "route": "Tiêm bắp",
        "category": "Vắc xin & Chuỗi lạnh", "expiry_date": "2027-02-15", "days_left": 112,
        "current_stock": 200, "min_threshold": 100, "max_threshold": 500, "unit": "Liều",
        "warehouse_location": "Kho Lạnh Dược GSP (Tủ bảo quản T1 2.0°C - 8.0°C)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-9", "shelf_life": "36 tháng", "applicant_name": "Macarthys Laboratories Limited", "approval_decision": "QĐ 403/QĐ-QLD", "item_name": "Fentanyl 50 micrograms/ml", "national_code": "VN-22499-20",
        "registration_number": "VN-22499-20", "active_ingredient": "Fentanyl (dưới dạng fentanyl citrat)", "batch_number": "LOT-FT25-A2",
        "concentration": "50mcg/ml", "dosage_form": "Dung dịch tiêm", "manufacturer": "Macarthys Laboratories Limited",
        "country": "Anh", "packaging_spec": "Hộp 10 ống x 2ml", "standard_pharmacopeia": "BP / NSX", "route": "Tiêm tĩnh mạch",
        "category": "Thuốc gây nghiện", "expiry_date": "2027-03-25", "days_left": 150,
        "current_stock": 160, "min_threshold": 50, "max_threshold": 300, "unit": "Ống",
        "warehouse_location": "Tủ sắt thuốc độc gây nghiện (Khóa 2 lớp, Kho Dược)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-10", "shelf_life": "36 tháng", "applicant_name": "M/S Zeiss Pharmaceuticals Pvt. Ltd.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Meroright 1g", "national_code": "890110030426",
        "registration_number": "890110030426", "active_ingredient": "Meropenem (dưới dạng Meropenem trihydrat)", "batch_number": "LOT-ME25-M1",
        "concentration": "1000mg", "dosage_form": "Bột pha dung dịch tiêm/tiêm truyền", "manufacturer": "M/S Zeiss Pharmaceuticals Pvt. Ltd.",
        "country": "Ấn Độ", "packaging_spec": "Hộp 1 lọ", "standard_pharmacopeia": "USP", "route": "Tiêm tĩnh mạch / Truyền tĩnh mạch",
        "category": "Kháng sinh", "expiry_date": "2027-04-18", "days_left": 174,
        "current_stock": 220, "min_threshold": 80, "max_threshold": 400, "unit": "Lọ",
        "warehouse_location": "Kho Dược Nội Trú (Kệ B2 - Tầng 3)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-11", "shelf_life": "24 tháng", "applicant_name": "Cty CPDP TW 1 - Pharbaco", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "VANCOMYCIN 1g", "national_code": "893115106026",
        "registration_number": "893115106026", "active_ingredient": "Vancomycin (dưới dạng Vancomycin hydroclorid)", "batch_number": "LOT-VC25-V1",
        "concentration": "1000 mg", "dosage_form": "Bột pha tiêm", "manufacturer": "Cty CPDP TW 1 - Pharbaco",
        "country": "Việt Nam", "packaging_spec": "Hộp 1 lọ", "standard_pharmacopeia": "DĐVN V", "route": "Truyền tĩnh mạch chậm",
        "category": "Kháng sinh", "expiry_date": "2027-05-30", "days_left": 216,
        "current_stock": 180, "min_threshold": 80, "max_threshold": 400, "unit": "Lọ",
        "warehouse_location": "Kho Dược Nội Trú (Kệ B2 - Tầng 2)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-12", "shelf_life": "36 tháng", "applicant_name": "Cty CPDP An Thiên", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Natri clorid 0,9% A.T", "national_code": "893110369425",
        "registration_number": "893110369425", "active_ingredient": "Natri clorid", "batch_number": "LOT-NC25-T1",
        "concentration": "9mg/ml (0.9%)", "dosage_form": "Dung dịch tiêm truyền", "manufacturer": "Cty CPDP An Thiên",
        "country": "Việt Nam", "packaging_spec": "Chai 500ml", "standard_pharmacopeia": "DĐVN V", "route": "Truyền tĩnh mạch",
        "category": "Dịch truyền & Cấp cứu", "expiry_date": "2027-06-25", "days_left": 242,
        "current_stock": 650, "min_threshold": 300, "max_threshold": 2000, "unit": "Chai",
        "warehouse_location": "Kho Dịch Truyền Thể Tích Lớn (Khu C1)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-13", "shelf_life": "36 tháng", "applicant_name": "Vioser S.A.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Lactated Ringer’s Injection/Vioser", "national_code": "520110410325",
        "registration_number": "520110410325", "active_ingredient": "Calci clorid dihydrat, Natri lactat, Kali clorid, Natri clorid", "batch_number": "LOT-LR25-V2",
        "concentration": "500ml", "dosage_form": "Dung dịch tiêm truyền tĩnh mạch", "manufacturer": "Vioser S.A.",
        "country": "Hy Lạp", "packaging_spec": "Chai 500ml", "standard_pharmacopeia": "EP / NSX", "route": "Truyền tĩnh mạch",
        "category": "Dịch truyền & Cấp cứu", "expiry_date": "2027-07-20", "days_left": 267,
        "current_stock": 500, "min_threshold": 200, "max_threshold": 1500, "unit": "Chai",
        "warehouse_location": "Kho Dịch Truyền Thể Tích Lớn (Khu C1)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-14", "shelf_life": "36 tháng", "applicant_name": "B. Braun Medical Industries Sdn. Bhd.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "5% Glucose Intravenous Infusion B.P.", "national_code": "955110960524",
        "registration_number": "955110960524", "active_ingredient": "Glucose monohydrate", "batch_number": "LOT-GL25-G5",
        "concentration": "5%", "dosage_form": "Dung dịch tiêm truyền tĩnh mạch", "manufacturer": "B. Braun Medical Industries",
        "country": "Malaysia", "packaging_spec": "Chai 500ml", "standard_pharmacopeia": "BP", "route": "Truyền tĩnh mạch",
        "category": "Dịch truyền & Cấp cứu", "expiry_date": "2027-08-30", "days_left": 308,
        "current_stock": 450, "min_threshold": 200, "max_threshold": 1200, "unit": "Chai",
        "warehouse_location": "Kho Dịch Truyền Thể Tích Lớn (Khu C2)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-15", "shelf_life": "24 tháng", "applicant_name": "Cty CP Dược Vật tư y tế Hải Dương", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Salbutamol 2,5 mg/ 2,5 ml", "national_code": "893115477725",
        "registration_number": "893115477725", "active_ingredient": "Salbutamol (dưới dạng salbutamol sulfat)", "batch_number": "LOT-SB25-K1",
        "concentration": "2.5mg/2.5ml", "dosage_form": "Dung dịch khí dung", "manufacturer": "Cty CP Dược Vật tư y tế Hải Dương",
        "country": "Việt Nam", "packaging_spec": "Hộp 4 vỉ x 5 ống x 2.5ml", "standard_pharmacopeia": "DĐVN V", "route": "Khí dung",
        "category": "Thuốc cấp cứu", "expiry_date": "2027-09-15", "days_left": 324,
        "current_stock": 300, "min_threshold": 100, "max_threshold": 800, "unit": "Ống",
        "warehouse_location": "Tủ thuốc Cấp cứu Hô hấp A9", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-16", "shelf_life": "24 tháng", "applicant_name": "Immacule Lifesciences Pvt. Ltd.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Prasocare", "national_code": "890110200326",
        "registration_number": "890110200326", "active_ingredient": "Esomeprazole natri 40mg", "batch_number": "LOT-PS25-E4",
        "concentration": "40mg", "dosage_form": "Bột đông khô pha tiêm", "manufacturer": "Immacule Lifesciences Pvt. Ltd.",
        "country": "Ấn Độ", "packaging_spec": "Hộp 1 lọ", "standard_pharmacopeia": "USP", "route": "Tiêm tĩnh mạch / Truyền tĩnh mạch",
        "category": "Thuốc điều trị chuyên khoa", "expiry_date": "2027-10-30", "days_left": 369,
        "current_stock": 350, "min_threshold": 150, "max_threshold": 800, "unit": "Lọ",
        "warehouse_location": "Kho Dược Nội Trú (Kệ A2 - Tầng 2)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-17", "shelf_life": "36 tháng", "applicant_name": "Sri Krishna Pharmaceuticals Limited", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Amiodarone Hydrochloride Tablets 200mg", "national_code": "890110188526",
        "registration_number": "890110188526", "active_ingredient": "Amiodaron hydroclorid", "batch_number": "LOT-AM25-C1",
        "concentration": "200mg", "dosage_form": "Viên nén", "manufacturer": "Sri Krishna Pharmaceuticals Limited",
        "country": "Ấn Độ", "packaging_spec": "Hộp 10 vỉ x 10 viên", "standard_pharmacopeia": "BP / NSX", "route": "Đường uống",
        "category": "Thuốc cấp cứu", "expiry_date": "2027-11-20", "days_left": 390,
        "current_stock": 180, "min_threshold": 80, "max_threshold": 500, "unit": "Viên",
        "warehouse_location": "Tủ thuốc Hồi sức Cấp cứu Tim Mạch", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-18", "shelf_life": "36 tháng", "applicant_name": "MSN Laboratories Private Limited", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Safeesem 5", "national_code": "890110197826",
        "registration_number": "890110197826", "active_ingredient": "S-amlodipine (dưới dạng S-amlodipine besylate)", "batch_number": "LOT-SF26-A1",
        "concentration": "5mg", "dosage_form": "Viên nén", "manufacturer": "MSN Laboratories Private Limited",
        "country": "Ấn Độ", "packaging_spec": "Hộp 3 vỉ x 10 viên", "standard_pharmacopeia": "NSX", "route": "Đường uống",
        "category": "Thuốc điều trị chuyên khoa", "expiry_date": "2028-01-15", "days_left": 446,
        "current_stock": 800, "min_threshold": 300, "max_threshold": 2500, "unit": "Viên",
        "warehouse_location": "Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-19", "shelf_life": "36 tháng", "applicant_name": "Inventia Healthcare Limited", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Panfor PR-750", "national_code": "890110197726",
        "registration_number": "890110197726", "active_ingredient": "Metformin Hydrochloride", "batch_number": "LOT-PF26-M7",
        "concentration": "750mg", "dosage_form": "Viên nén phóng thích kéo dài", "manufacturer": "Inventia Healthcare Limited",
        "country": "Ấn Độ", "packaging_spec": "Hộp 10 vỉ x 10 viên", "standard_pharmacopeia": "USP", "route": "Đường uống",
        "category": "Thuốc điều trị chuyên khoa", "expiry_date": "2028-03-20", "days_left": 510,
        "current_stock": 950, "min_threshold": 300, "max_threshold": 3000, "unit": "Viên",
        "warehouse_location": "Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    },
    {
        "id": "b-20", "shelf_life": "36 tháng", "applicant_name": "Sandoz Pharmaceuticals d.d.", "approval_decision": "QĐ 798/QĐ-QLD", "item_name": "Atorvastatin Sandoz 20mg", "national_code": "590110192126",
        "registration_number": "590110192126", "active_ingredient": "Atorvastatin (dưới dạng Atorvastatin calci trihydrat)", "batch_number": "LOT-AT26-S2",
        "concentration": "20mg", "dosage_form": "Viên nén bao phim", "manufacturer": "Lek S.A. (Ba Lan / Sandoz)",
        "country": "Ba Lan", "packaging_spec": "Hộp 3 vỉ x 10 viên", "standard_pharmacopeia": "NSX / EP", "route": "Đường uống",
        "category": "Thuốc điều trị chuyên khoa", "expiry_date": "2028-06-30", "days_left": 612,
        "current_stock": 600, "min_threshold": 200, "max_threshold": 2000, "unit": "Viên",
        "warehouse_location": "Kho Dược Ngoại Trú (Khu phát thuốc BHYT Mạn tính)", "is_near_expiry": False, "is_low_stock": False, "is_quarantined": False
    }
]
