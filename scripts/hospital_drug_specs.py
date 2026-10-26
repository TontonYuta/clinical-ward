"""
scripts/hospital_drug_specs.py
Định nghĩa thông số đối soát 20 thuốc kho bệnh viện với Dược Thư QG 2022 và CSDL Cục QLD (<=200 LOC)
"""

HOSPITAL_DRUG_SPECS = [
    {
        "id": "b-1", "sdk": "893100110026", "brand_name": "PARACETAMOL 500mg", "inn": "Paracetamol",
        "p_start": 1118, "p_end": 1121, "atc": "N02BE01",
        "antidote": "N-acetylcystein (uống hoặc tiêm tĩnh mạch; có thể dùng Methionin nếu không có N-acetylcystein). Cần cho thuốc càng sớm càng tốt, tối ưu trong vòng 8 - 10 giờ đầu sau ngộ độc.",
        "reg_note": "DĐVN V • Giảm đau hạ sốt", "is_dtqg": True
    },
    {
        "id": "b-2", "sdk": "840110304425", "brand_name": "Ceftriaxona Normon 1g", "inn": "Ceftriaxon",
        "p_start": 371, "p_end": 375, "atc": "J01DD04",
        "antidote": "Điều trị triệu chứng và hồi sức hỗ trợ. Thẩm tách máu hoặc thẩm tách màng bụng không làm giảm nồng độ thuốc.",
        "reg_note": "Kháng sinh nhóm cephalosporin thế hệ 3 • TƯƠNG KỴ TỬ VONG VỚI CALCI (QĐ 5948/QĐ-BYT)", "is_dtqg": True
    },
    {
        "id": "b-3", "sdk": "893111093823", "brand_name": "Morphin (Morphin hydroclorid 10mg/ml)", "inn": "Morphin",
        "p_start": 1005, "p_end": 1010, "atc": "N02AA01",
        "antidote": "Naloxon tiêm tĩnh mạch 0,4 - 2 mg; nhắc lại sau 2 - 3 phút nếu cần (tổng liều tới 10 - 20 mg). Có thể tiêm bắp hoặc dưới da nếu không lập được đường tĩnh mạch.",
        "reg_note": "Thuốc gây nghiện (Thông tư 20/2017/TT-BYT) • Quản lý tủ sắt 2 khóa, đối soát vỏ ống", "is_dtqg": True
    },
    {
        "id": "b-4", "sdk": "893110151100", "brand_name": "Hadunalin 1 mg/ml", "inn": "Adrenalin",
        "p_start": 594, "p_end": 597, "atc": "C01CA24",
        "antidote": "Phentolamin (thuốc chẹn alpha-adrenergic đặc hiệu) xử trí hoại tử mô do thoát mạch: Pha 5 - 10 mg Phentolamin trong 10 ml NaCl 0,9%, tiêm thấm nhiều điểm vào vùng hoại tử trong vòng 12h.",
        "reg_note": "Thuốc cấp cứu sốc phản vệ số 1 (Thông tư 51/2017/TT-BYT) • CẤM TIÊM TM TRỰC TIẾP CHƯA PHA LOÃNG", "is_dtqg": True
    },
    {
        "id": "b-5", "sdk": "893110375223", "brand_name": "Kali clorid 10%", "inn": "Kali clorid",
        "p_start": 853, "p_end": 856, "atc": "A12BA01",
        "antidote": "Calci gluconat 10% tiêm TM chậm ổn định màng cơ tim; truyền Glucose + Insulin (10 ĐV Insulin trong 500ml Glucose 20%); Kayexalate hoặc thẩm tách máu.",
        "reg_note": "Thuốc nguy cơ cao (High-Alert Medication) • CẤM TIÊM TĨNH MẠCH TRỰC TIẾP (BOLUS), BẮT BUỘC PHA TRUYỀN", "is_dtqg": True
    },
    {
        "id": "b-6", "sdk": "893110107400", "brand_name": "Noradrenalin 4mg/4ml", "inn": "Noradrenalin",
        "p_start": 1065, "p_end": 1068, "atc": "C01CA03",
        "antidote": "Phentolamin mesylat (5 - 10 mg pha 10 - 15 ml NaCl 0,9% tiêm thấm tại chỗ hoại tử mạch trong 12h đầu); Atropin xử trí nhịp tim chậm do phản xạ.",
        "reg_note": "Thuốc cấp cứu hồi sức A9 • CẤM TIÊM TM TRỰC TIẾP, BẮT BUỘC TRUYỀN BƠM TIÊM ĐIỆN TĨNH MẠCH LỚN", "is_dtqg": True
    },
    {
        "id": "b-7", "sdk": "890112769224", "brand_name": "Diazepam Injection BP 10mg/2ml", "inn": "Diazepam",
        "p_start": 513, "p_end": 518, "atc": "N05BA01",
        "antidote": "Flumazenil (thuốc đối kháng thụ thể benzodiazepin đặc hiệu): Tiêm tĩnh mạch ban đầu 0,2 mg trong 30 giây, sau đó 0,1 mg mỗi phút (tối đa 1 mg ở người lớn).",
        "reg_note": "Thuốc hướng thần (Thông tư 20/2017/TT-BYT) • Quản lý tủ sắt khóa kép chuyên biệt", "is_dtqg": True
    },
    {
        "id": "b-8", "sdk": "300310033526", "brand_name": "Vaxigrip", "inn": "Vắc xin cúm bất hoạt",
        "p_start": 0, "p_end": 0, "atc": "J07BB01",
        "antidote": "Adrenalin 1 mg/ml tiêm bắp theo Thông tư 51/2017/TT-BYT khi xảy ra phản vệ sau tiêm vắc xin; thuốc kháng histamin.",
        "reg_note": "Vắc xin & Dây chuyền lạnh GSP (TT 36/2018/TT-BYT) • Bảo quản 2.0°C - 8.0°C, TUYỆT ĐỐI KHÔNG ĐỂ ĐÔNG BĂNG", "is_dtqg": False
    },
    {
        "id": "b-9", "sdk": "VN-22499-20", "brand_name": "Fentanyl 50 micrograms/ml", "inn": "Fentanyl",
        "p_start": 655, "p_end": 660, "atc": "N01AH01",
        "antidote": "Naloxon tiêm tĩnh mạch (người lớn 0,4 - 2 mg; nhắc lại sau 2 - 3 phút). Bắt buộc hỗ trợ thông khí nhân tạo và thở oxy.",
        "reg_note": "Thuốc gây nghiện giảm đau cực mạnh (Thông tư 20/2017/TT-BYT) • Gây mê hồi sức chuyên khoa", "is_dtqg": True
    },
    {
        "id": "b-10", "sdk": "890110030426", "brand_name": "Meroright 1g", "inn": "Meropenem",
        "p_start": 950, "p_end": 954, "atc": "J01DH02",
        "antidote": "Điều trị hỗ trợ và điều trị triệu chứng. Meropenem và các chất chuyển hóa được loại bỏ qua thẩm tách máu.",
        "reg_note": "Kháng sinh nhóm carbapenem phổ rộng dự trữ (QĐ 5631/QĐ-BYT) • Tiêm TM chậm 3-5 phút hoặc truyền TM", "is_dtqg": True
    },
    {
        "id": "b-11", "sdk": "893115106026", "brand_name": "VANCOMYCIN 1g", "inn": "Vancomycin",
        "p_start": 1455, "p_end": 1460, "atc": "J01XA01",
        "antidote": "Điều trị hỗ trợ và duy trì lọc cầu thận. Thẩm tách máu hoặc thẩm tách màng bụng không loại trừ được vancomycin hiệu quả; cần lọc máu hấp phụ bằng resin.",
        "reg_note": "Kháng sinh glycopeptid điều trị tụ cầu MRSA • BẮT BUỘC TRUYỀN TĨNH MẠCH CHẬM >= 60-100 PHÚT", "is_dtqg": True
    },
    {
        "id": "b-12", "sdk": "893110369425", "brand_name": "Natri clorid 0,9% A.T", "inn": "Natri clorid",
        "p_start": 1030, "p_end": 1034, "atc": "B05CB01",
        "antidote": "Dừng truyền dung dịch; dùng thuốc lợi tiểu quai (Furosemid) để thải natri và dịch thừa, phối hợp bù kali.",
        "reg_note": "Dung dịch đẳng trương bồi phụ nước và điện giải ngoại bào", "is_dtqg": True
    },
    {
        "id": "b-13", "sdk": "520110410325", "brand_name": "Lactated Ringer’s Injection/Vioser", "inn": "Ringer lactat",
        "p_start": 1247, "p_end": 1250, "atc": "B05BB01",
        "antidote": "Ngừng truyền ngay; điều trị triệu chứng quá tải tuần hoàn bằng thuốc lợi tiểu quai (Furosemid) và thở oxy.",
        "reg_note": "Dịch truyền bồi phụ thể tích tuần hoàn và kiềm hóa • TƯƠNG KỴ TỬ VONG VỚI CEFTRIAXON (QĐ 5948/QĐ-BYT)", "is_dtqg": True
    },
    {
        "id": "b-14", "sdk": "955110960524", "brand_name": "5% Glucose Intravenous Infusion B.P.", "inn": "Glucose",
        "p_start": 748, "p_end": 752, "atc": "B05BA03",
        "antidote": "Tiêm insulin nhanh để hạ đường huyết và truyền dịch cân bằng điện giải theo dõi sát kali máu.",
        "reg_note": "Dịch truyền cung cấp năng lượng và nước tự do • Dung môi pha truyền chuẩn cho Amiodaron, Noradrenalin", "is_dtqg": True
    },
    {
        "id": "b-15", "sdk": "893115477725", "brand_name": "Salbutamol 2,5 mg/ 2,5 ml", "inn": "Salbutamol",
        "p_start": 1262, "p_end": 1267, "atc": "R03CC02",
        "antidote": "Thuốc chẹn thụ thể beta chọn lọc tim (Esmolol, Metoprolol) dùng thận trọng để kiểm soát nhịp tim nhanh và đánh trống ngực.",
        "reg_note": "Thuốc giãn phế quản tác dụng ngắn SABA • Cắt cơn hen phế quản cấp và đợt cấp COPD", "is_dtqg": True
    },
    {
        "id": "b-16", "sdk": "890110200326", "brand_name": "Prasocare", "inn": "Esomeprazol",
        "p_start": 619, "p_end": 623, "atc": "A02BC05",
        "antidote": "Điều trị triệu chứng và hỗ trợ chức năng sống. Esomeprazole gắn kết protein rất cao nên không thể loại bỏ qua thẩm tách máu.",
        "reg_note": "Thuốc ức chế bơm proton PPI • Điều trị loét dạ dày tá tràng và xuất huyết tiêu hóa", "is_dtqg": True
    },
    {
        "id": "b-17", "sdk": "890110188526", "brand_name": "Amiodarone Hydrochloride Tablets 200mg", "inn": "Amiodaron",
        "p_start": 180, "p_end": 185, "atc": "C01BD01",
        "antidote": "Nếu nhịp tim chậm: Dùng Atropin hoặc máy tạo nhịp tạm thời. Tụt huyết áp: Bù dịch và dùng thuốc vận mạch (Noradrenalin). Amiodaron không lọc được qua lọc máu.",
        "reg_note": "Thuốc chống loạn nhịp nhóm III • TƯƠNG TÁC KÉO DÀI KHOẢNG QT GÂY XOẮN ĐỈNH (QĐ 5948/QĐ-BYT)", "is_dtqg": True
    },
    {
        "id": "b-18", "sdk": "890110197826", "brand_name": "Safeesem 5", "inn": "Amlodipin",
        "p_start": 187, "p_end": 191, "atc": "C08CA01",
        "antidote": "Calci gluconat hoặc Calci clorid tiêm tĩnh mạch; truyền dung dịch bù thể tích; dùng thuốc co mạch (Noradrenalin); truyền Insulin liều cao kèm Glucose.",
        "reg_note": "Thuốc chẹn kênh calci DHP • Hạ huyết áp và kiểm soát đau thắt ngực", "is_dtqg": True
    },
    {
        "id": "b-19", "sdk": "890110197726", "brand_name": "Panfor PR-750", "inn": "Metformin",
        "p_start": 955, "p_end": 959, "atc": "A10BA02",
        "antidote": "Thẩm tách máu (chạy thận nhân tạo) là biện pháp hữu hiệu nhất để đào thải metformin và điều chỉnh toan chuyển hóa máu (Lactic Acidosis).",
        "reg_note": "Thuốc điều trị đái tháo đường typ 2 hàng đầu • Cảnh báo nguy cơ nhiễm toan lactic khi suy thận", "is_dtqg": True
    },
    {
        "id": "b-20", "sdk": "590110192126", "brand_name": "Atorvastatin Sandoz 20mg", "inn": "Atorvastatin",
        "p_start": 286, "p_end": 290, "atc": "C10AA05",
        "antidote": "Điều trị triệu chứng tiêu cơ vân và bảo vệ chức năng thận bằng bù dịch truyền kiềm hóa nước tiểu (Natri bicarbonat). Thẩm tách máu không làm tăng đáng kể thanh thải atorvastatin.",
        "reg_note": "Thuốc hạ lipid máu nhóm statin • Cảnh báo nguy cơ tiêu cơ vân cấp khi phối hợp nhóm fibrat (QĐ 5948)", "is_dtqg": True
    },
]
