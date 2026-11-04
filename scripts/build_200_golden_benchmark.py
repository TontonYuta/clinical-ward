#!/usr/bin/env python3
"""
Generator for the 200 Curated Golden Clinical Benchmark Cases.
Derived from historical copilot logs, clinical protocols, and DAV/DĐVN V databases.
"""
import json
from pathlib import Path

BENCHMARK_CASES = []

def add_case(cid, cat, query, intent, entities, legal, ideal_chips, key_facts):
    BENCHMARK_CASES.append({
        "id": f"case-{cid:03d}",
        "category": cat,
        "query": query,
        "expected_intent": intent,
        "expected_entities": entities,
        "legal_basis": legal,
        "ideal_chips": ideal_chips,
        "key_facts": key_facts
    })

# ==============================================================================
# NHÓM 1: CHỈ ĐỊNH, DẠNG BÀO CHẾ & THỜI ĐIỂM DÙNG THUỐC (35 CÂU)
# ==============================================================================
add_case(1, "indications_and_timing", "Kháng sinh Zithromax uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE",
         ["zithromax", "azithromycin"], "Dược thư Quốc gia Việt Nam DĐVN V & HDSD",
         ["Liều Zithromax người lớn", "Tác dụng phụ của Azithromycin", "Zithromax cho phụ nữ có thai"],
         ["Viên nang/hỗn dịch uống lúc đói trước ăn 1h hoặc sau ăn 2h", "Viên nén bao phim có thể uống cùng thức ăn", "Tránh uống cùng antacid nhôm/magie"])

add_case(2, "indications_and_timing", "Metformin uống lúc đói được không?", "MEDICATION_SAFETY_PROFILE",
         ["metformin"], "DĐVN V Trang 955",
         ["Liều tối đa Metformin", "Chỉnh liều Metformin theo eGFR", "Nguy cơ nhiễm toan acid lactic"],
         ["Uống trong hoặc ngay sau bữa ăn", "Không uống lúc đói để tránh kích ứng dạ dày và hạ đường huyết"])

add_case(3, "indications_and_timing", "Thuốc Smecta uống lúc nào tốt nhất?", "MEDICATION_SAFETY_PROFILE",
         ["smecta", "diosmectite"], "DĐVN V Trang 535",
         ["Khoảng cách Smecta với thuốc khác", "Smecta cho trẻ em tiêu chảy", "Chỉ định Smecta"],
         ["Uống xa bữa ăn", "Cách xa các thuốc khác ít nhất 2 giờ để không giảm hấp thu"])

add_case(4, "indications_and_timing", "Alendronate loãng xương uống thế nào cho đúng?", "MEDICATION_SAFETY_PROFILE",
         ["alendronate"], "DĐVN V & Hướng dẫn Bộ Y tế",
         ["Tác dụng phụ loét thực quản Alendronate", "Bổ sung Canxi và Vitamin D", "Chống chỉ định Alendronate"],
         ["Uống sáng sớm khi đói với cốc nước đầy 200ml", "Giữ tư thế ngồi thẳng hoặc đứng ít nhất 30 phút", "Tuyệt đối không nằm"])

add_case(5, "indications_and_timing", "Thuốc Gliclazide uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE",
         ["gliclazide"], "DĐVN V Trang 720",
         ["Nguy cơ hạ đường huyết Gliclazide", "Liều khởi đầu Diamicron MR", "Tương tác Gliclazide"],
         ["Uống trước bữa ăn sáng 15 - 30 phút", "Ăn đúng giờ sau khi uống để tránh hạ đường huyết"])

add_case(6, "indications_and_timing", "Thuốc Coversyl nên uống vào thời điểm nào trong ngày?", "MEDICATION_SAFETY_PROFILE",
         ["coversyl", "perindopril"], "DĐVN V Trang 1085",
         ["Tác dụng phụ ho khan do ACEI", "Theo dõi Kali máu khi dùng Coversyl", "Chống chỉ định thai kỳ ACEI"],
         ["Uống một lần duy nhất vào buổi sáng trước bữa ăn", "Thức ăn có thể làm giảm chuyển hóa thành perindoprilat"])

add_case(7, "indications_and_timing", "Jardiance nên uống buổi sáng hay buổi tối?", "MEDICATION_SAFETY_PROFILE",
         ["jardiance", "empagliflozin"], "DĐVN V & Hướng dẫn ADA/BYT",
         ["Nguy cơ nhiễm toan ceton eDKA", "Uống đủ nước khi dùng SGLT2i", "Theo dõi chức năng thận eGFR"],
         ["Uống vào buổi sáng để tránh đi tiểu đêm", "Uống nhiều nước phòng ngừa nhiễm khuẩn tiết niệu"])

add_case(8, "indications_and_timing", "Klacid 500mg uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE",
         ["klacid", "clarithromycin"], "DĐVN V Trang 410",
         ["Tương tác Klacid với Statin", "Tác dụng phụ đắng miệng Klacid", "Phác đồ diệt H.pylori Klacid"],
         ["Dạng viên phóng thích kéo dài uống trong bữa ăn", "Viên nén quy ước uống trước hoặc sau ăn"])

add_case(9, "indications_and_timing", "Thuốc Doxycycline uống thế nào để tránh loét thực quản?", "MEDICATION_SAFETY_PROFILE",
         ["doxycycline"], "DĐVN V Trang 550",
         ["Tương tác Doxycycline với Canxi", "Chống chỉ định Doxycycline trẻ dưới 8 tuổi", "Tác dụng phụ nhạy cảm ánh sáng"],
         ["Uống với nhiều nước ở tư thế đứng hoặc ngồi thẳng", "Không nằm trong ít nhất 30 phút sau khi uống", "Cách xa sữa và chế phẩm sắt"])

add_case(10, "indications_and_timing", "Phosphalugel uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE",
         ["phosphalugel"], "DĐVN V Trang 1098",
         ["Liều dùng Phosphalugel", "Cách xa thuốc khác 2 giờ", "Tác dụng phụ táo bón"],
         ["Uống khi có cơn đau dạ dày hoặc sau ăn 1 - 2 giờ", "Uống cách xa các thuốc khác tối thiểu 2 giờ"])

add_case(11, "indications_and_timing", "Paracetamol có chỉ định trong các trường hợp nào?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V Trang 1050",
         ["Liều Paracetamol người lớn", "Chống chỉ định Paracetamol suy gan", "Quá liều Paracetamol"],
         ["Hạ sốt và giảm đau từ nhẹ đến vừa", "Không có tác dụng chống viêm đáng kể"])

add_case(12, "indications_and_timing", "Augmentin là thuốc gì, dùng điều trị bệnh gì?", "MEDICATION_SAFETY_PROFILE",
         ["augmentin", "amoxicillin"], "DĐVN V Trang 150",
         ["Liều Augmentin người lớn", "Dị ứng Penicillin", "Augmentin uống trong bữa ăn"],
         ["Kháng sinh phối hợp Amoxicillin và Acid clavulanic", "Nhiễm khuẩn hô hấp, tai mũi họng, tiết niệu, da"])

add_case(13, "indications_and_timing", "Nexium 40mg chỉ định và thời điểm uống?", "MEDICATION_SAFETY_PROFILE",
         ["nexium", "esomeprazol"], "DĐVN V Trang 610",
         ["Tương tác Nexium và Clopidogrel", "Liều Nexium trào ngược dạ dày", "Tác dụng phụ Nexium kéo dài"],
         ["Trào ngược dạ dày thực quản GERD, loét dạ dày tá tràng", "Uống trước bữa ăn sáng ít nhất 30 - 60 phút"])

add_case(14, "indications_and_timing", "Plavix 75mg dùng để làm gì?", "MEDICATION_SAFETY_PROFILE",
         ["plavix", "clopidogrel"], "DĐVN V Trang 430",
         ["Tương tác Plavix với Omeprazole", "Theo dõi chảy máu khi dùng Plavix", "Phối hợp Plavix và Aspirin DAPT"],
         ["Ức chế ngưng tập tiểu cầu, phòng ngừa huyết khối xơ vữa", "Hội chứng vành cấp, sau đặt stent mạch vành, đột quỵ thiếu máu"])

add_case(15, "indications_and_timing", "Concor 5mg chỉ định cho những bệnh gì?", "MEDICATION_SAFETY_PROFILE",
         ["concor", "bisoprolol"], "DĐVN V Trang 250",
         ["Chống chỉ định Concor hen phế quản", "Theo dõi nhịp tim khi dùng Bisoprolol", "Concor trong suy tim mạn ổn định"],
         ["Tăng huyết áp, đau thắt ngực, suy tim mạn tính ổn định", "Chẹn chọn lọc beta-1 giao cảm"])

add_case(16, "indications_and_timing", "Thuốc Rocephin 1g là thuốc gì và đường dùng?", "MEDICATION_SAFETY_PROFILE",
         ["rocephin", "ceftriaxon"], "DĐVN V Trang 320",
         ["Chống chỉ định Rocephin pha dung dịch Canxi", "Liều Rocephin viêm màng não", "Dị ứng Cephalosporin"],
         ["Kháng sinh Cephalosporin thế hệ 3", "Tiêm tĩnh mạch chậm, truyền tĩnh mạch hoặc tiêm bắp"])

add_case(17, "indications_and_timing", "Thuốc Medrol 16mg uống vào lúc nào trong ngày?", "MEDICATION_SAFETY_PROFILE",
         ["medrol", "methylprednisolon"], "DĐVN V Trang 970",
         ["Tác dụng phụ hội chứng Cushing Medrol", "Giảm liều Medrol từ từ", "Uống Medrol sau bữa ăn no"],
         ["Uống vào khoảng 8 giờ sáng sau bữa ăn no", "Mô phỏng nhịp tiết sinh lý của vỏ thượng thận, giảm ức chế trục HPA"])

add_case(18, "indications_and_timing", "Ciprofloxacin uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin"], "DĐVN V Trang 400",
         ["Tương tác Ciprofloxacin với Sắt Canxi", "Nguy cơ viêm gân đứt gân gót Achilles", "Uống nhiều nước khi dùng Ciprofloxacin"],
         ["Có thể uống trước hoặc sau ăn", "Không uống cùng lúc với sữa, sữa chua hoặc thuốc kháng acid chứa ion kim loại"])

add_case(19, "indications_and_timing", "Thuốc hạ mỡ máu Atorvastatin nên uống lúc nào?", "MEDICATION_SAFETY_PROFILE",
         ["atorvastatin"], "DĐVN V Trang 190",
         ["Tác dụng phụ tiêu cơ vân Statin", "Xét nghiệm men gan AST/ALT định kỳ", "Tương tác Statin"],
         ["Có thể uống bất kỳ thời điểm nào trong ngày do thời gian bán thải dài", "Uống vào buổi tối thường được ưu tiên"])

add_case(20, "indications_and_timing", "Thuốc Amlodipine 5mg dùng điều trị bệnh gì?", "MEDICATION_SAFETY_PROFILE",
         ["amlodipine"], "DĐVN V Trang 140",
         ["Tác dụng phụ phù mắt cá chân Amlodipine", "Liều khởi đầu Amlodipine", "Phối hợp Amlodipine và ACEI"],
         ["Tăng huyết áp, đau thắt ngực ổn định và co thắt mạch vành", "Chẹn kênh canxi phân nhóm Dihydropyridine"])

add_case(21, "indications_and_timing", "Ventolin xịt (Salbutamol) chỉ định và cách dùng khi lên cơn khó thở?", "MEDICATION_SAFETY_PROFILE",
         ["ventolin", "salbutamol"], "DĐVN V Trang 1180",
         ["Tác dụng phụ run tay đánh trống ngực", "Cách dùng buồng đệm Babyhaler", "Cắt cơn hen phế quản cấp"],
         ["Cắt cơn co thắt phế quản cấp trong hen và COPD", "Xịt 1 - 2 nhát hít sâu, nín thở 10 giây"])

add_case(22, "indications_and_timing", "Thuốc Colchicine chỉ định cho bệnh gì?", "MEDICATION_SAFETY_PROFILE",
         ["colchicine"], "DĐVN V Trang 445",
         ["Tác dụng phụ tiêu chảy Colchicine", "Liều Colchicine cơn Gút cấp", "Độc tính ngộ độc Colchicine"],
         ["Cơn Gút cấp tính, dự phòng tái phát Gút, sốt Địa Trung Hải", "Chỉ số điều trị hẹp, nguy cơ ngộ độc cao"])

add_case(23, "indications_and_timing", "Allopurinol uống vào thời điểm nào?", "MEDICATION_SAFETY_PROFILE",
         ["allopurinol"], "DĐVN V Trang 110",
         ["Dị ứng Stevens-Johnson Allopurinol", "Không khởi đầu Allopurinol trong cơn Gút cấp", "Uống nhiều nước"],
         ["Uống ngay sau bữa ăn", "Uống nhiều nước (tối thiểu 2 lít/ngày) để tránh lắng đọng tinh thể urat ở thận"])

add_case(24, "indications_and_timing", "Thuốc lợi tiểu Furosemid nên uống vào thời gian nào?", "MEDICATION_SAFETY_PROFILE",
         ["furosemid"], "DĐVN V Trang 690",
         ["Tác dụng phụ hạ Kali máu Furosemid", "Liều Furosemid suy tim phù", "Bổ sung Kali khi dùng lợi tiểu"],
         ["Nên uống vào buổi sáng để tránh đi tiểu đêm làm gián đoạn giấc ngủ", "Uống lúc đói hoặc no"])

add_case(25, "indications_and_timing", "Spironolactone chỉ định trong các trường hợp nào?", "MEDICATION_SAFETY_PROFILE",
         ["spironolactone"], "DĐVN V Trang 1230",
         ["Tăng Kali máu do Spironolactone", "Tác dụng phụ to vú ở nam giới", "Phối hợp Spironolactone suy tim"],
         ["Suy tim mạn tính phân suất tống máu giảm, xơ gan cổ trướng, tăng aldosteron", "Lợi tiểu giữ kali"])

add_case(26, "indications_and_timing", "Thuốc Cefixim 200mg thuộc nhóm nào, chỉ định gì?", "MEDICATION_SAFETY_PROFILE",
         ["cefixim"], "DĐVN V Trang 295",
         ["Liều Cefixim người lớn", "Dị ứng Cephalosporin", "Cefixim nhiễm khuẩn tiết niệu"],
         ["Kháng sinh Cephalosporin thế hệ 3 dùng đường uống", "Nhiễm khuẩn hô hấp, tai mũi họng, tiết niệu không biến chứng"])

add_case(27, "indications_and_timing", "Levofloxacin 500mg chỉ định điều trị bệnh gì?", "MEDICATION_SAFETY_PROFILE",
         ["levofloxacin"], "DĐVN V Trang 890",
         ["Nguy cơ kéo dài khoảng QTc Levofloxacin", "Đứt gân gót Achilles do Quinolone", "Chỉnh liều suy thận Levofloxacin"],
         ["Viêm phổi mắc phải cộng đồng, viêm xoang cấp, nhiễm khuẩn da và tiết niệu phức tạp", "Fluoroquinolone hô hấp"])

add_case(28, "indications_and_timing", "Thuốc Enoxaparin (Lovenox) tiêm ở vị trí nào?", "MEDICATION_SAFETY_PROFILE",
         ["enoxaparin", "lovenox"], "DĐVN V Trang 580",
         ["Theo dõi tiểu cầu giảm HIT Enoxaparin", "Chỉnh liều Lovenox khi suy thận ClCr < 30", "Chảy máu do Enoxaparin"],
         ["Tiêm dưới da sâu vùng bụng trước bên hoặc sau bên", "Không xoa bóp vị trí tiêm để tránh bầm tím và tụ máu"])

add_case(29, "indications_and_timing", "Thuốc Diazepam chỉ định trong trường hợp nào?", "MEDICATION_SAFETY_PROFILE",
         ["diazepam"], "DĐVN V Trang 510",
         ["Nguy cơ phụ thuộc thuốc Diazepam", "Chống chỉ định suy hô hấp nặng", "Xử trí cắt cơn co giật Diazepam"],
         ["Cắt cơn co giật, tiền mê, giảm lo âu kích động, cai rượu", "Nhóm Benzodiazepin hướng tâm thần"])

add_case(30, "indications_and_timing", "Thuốc Sibelium (Flunarizin) chỉ định điều trị gì?", "MEDICATION_SAFETY_PROFILE",
         ["sibelium", "flunarizin"], "DĐVN V Trang 670",
         ["Tác dụng phụ ngoại tháp trầm cảm Flunarizin", "Uống Flunarizin buổi tối", "Dự phòng đau nửa đầu Migraine"],
         ["Dự phòng cơn đau nửa đầu Migraine, điều trị triệu chứng chóng mặt tiền đình", "Chẹn kênh canxi chọn lọc"])

add_case(31, "indications_and_timing", "Thuốc Losartan 50mg chỉ định và cơ chế?", "MEDICATION_SAFETY_PROFILE",
         ["losartan"], "DĐVN V Trang 920",
         ["Chống chỉ định Losartan thai kỳ", "Theo dõi Kali máu và Creatinin", "Phối hợp Losartan suy tim"],
         ["Tăng huyết áp, bảo vệ thận ở bệnh nhân đái tháo đường týp 2 có protein niệu", "Đối kháng thụ thể Angiotensin II (ARB)"])

add_case(32, "indications_and_timing", "Thuốc Omeprazol 20mg uống lúc nào hiệu quả nhất?", "MEDICATION_SAFETY_PROFILE",
         ["omeprazol"], "DĐVN V Trang 1030",
         ["Tương tác Omeprazol và Clopidogrel", "Liều Omeprazol loét dạ dày", "Tác dụng phụ giảm hấp thu Magie Canxi B12"],
         ["Uống trước bữa ăn sáng 30 - 60 phút", "Nuốt nguyên viên không nhai hoặc nghiền nhỏ"])

add_case(33, "indications_and_timing", "Heparin không phân đoạn chỉ định trong bệnh cảnh nào?", "MEDICATION_SAFETY_PROFILE",
         ["heparin"], "DĐVN V Trang 760",
         ["Theo dõi aPTT khi dùng Heparin", "Thuốc giải độc Heparin Protamine", "Giảm tiểu cầu do Heparin HIT"],
         ["Điều trị và dự phòng thuyên tắc huyết khối tĩnh mạch, hội chứng vành cấp, lọc máu", "Kháng đông đường tiêm"])

add_case(34, "indications_and_timing", "Thuốc Vitamin K1 (Phytomenadion) chỉ định trong trường hợp nào?", "MEDICATION_SAFETY_PROFILE",
         ["vitamin k1", "phytomenadion"], "DĐVN V Trang 1080",
         ["Xử trí quá liều Warfarin Vitamin K1", "Dự phòng xuất huyết não màng não trẻ sơ sinh", "Đường dùng Vitamin K1"],
         ["Xuất huyết hoặc nguy cơ xuất huyết do thiếu prothrombin, giải độc kháng vitamin K (Warfarin)", "Dự phòng xuất huyết sơ sinh"])

add_case(35, "indications_and_timing", "Prednisolon 5mg chỉ định và thời điểm uống?", "MEDICATION_SAFETY_PROFILE",
         ["prednisolon"], "DĐVN V Trang 1120",
         ["Uống Prednisolon sau bữa ăn sáng", "Hội chứng Cushing khi dùng kéo dài", "Giảm liều dần Prednisolon"],
         ["Chống viêm, ức chế miễn dịch trong bệnh dị ứng, khớp, tự miễn", "Uống 1 lần vào buổi sáng sau ăn"])

# ==============================================================================
# NHÓM 2: LIỀU LƯỢNG, LIỀU TRẺ EM & HIỆU CHỈNH SUY THẬN / GAN (35 CÂU)
# ==============================================================================
add_case(36, "dosage_and_adjustments", "Liều dùng Paracetamol cho trẻ em 15kg là bao nhiêu?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V Trang 1050",
         ["Khoảng cách giữa các lần uống Paracetamol", "Liều tối đa Paracetamol trẻ em trong ngày", "Xử trí khi trẻ nôn sau uống thuốc"],
         ["Liều 10 - 15 mg/kg/lần (với trẻ 15kg: 150 - 225 mg/lần)", "Cách mỗi 4 - 6 giờ một lần nếu còn sốt", "Tối đa không quá 60 mg/kg/ngày (900 mg/ngày)"])

add_case(37, "dosage_and_adjustments", "Paracetamol liều tối đa trong ngày của người lớn là bao nhiêu?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V Trang 1050",
         ["Ngộ độc gan do Paracetamol quá liều", "Khoảng cách an toàn giữa 2 liều Paracetamol", "Giải độc Paracetamol bằng Acetylcystein"],
         ["Tối đa 4g (4000mg)/ngày ở người có chức năng gan bình thường", "Mỗi lần 500 - 1000mg cách nhau tối thiểu 4 - 6 giờ", "Khuyến cáo người lớn tuổi hoặc nghiện rượu nên dưới 3g/ngày"])

add_case(38, "dosage_and_adjustments", "Augmentin liều dùng cho trẻ em 12kg điều trị viêm tai giữa?", "MEDICATION_SAFETY_PROFILE",
         ["augmentin", "amoxicillin"], "DĐVN V & Hướng dẫn Bộ Y tế",
         ["Cách pha hỗn dịch Augmentin", "Augmentin uống trong bữa ăn giảm tiêu chảy", "Dấu hiệu dị ứng Augmentin"],
         ["Liều cao 80 - 90 mg/kg/ngày chia 2 lần (khoảng 500mg Amoxicillin/ngày)", "Uống vào đầu bữa ăn"])

add_case(39, "dosage_and_adjustments", "Vancomycin suy thận chỉnh liều thế nào?", "CLINICAL_AI_CONSULTATION",
         ["vancomycin"], "DĐVN V & Hướng dẫn TDM Bộ Y tế",
         ["Mục tiêu nồng độ đáy Vancomycin Trough level 15-20 mcg/ml", "Thời điểm lấy mẫu máu định lượng Vancomycin", "Độc tính trên thận của Vancomycin"],
         ["Hiệu chỉnh liều theo ClCr hoặc eGFR", "Kéo dài khoảng cách đưa liều 24 - 48h khi ClCr giảm", "Bắt buộc theo dõi nồng độ đáy Trough level"])

add_case(40, "dosage_and_adjustments", "Metformin chỉnh liều theo chức năng thận eGFR thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["metformin"], "DĐVN V & Quyết định 5481/QĐ-BYT",
         ["Nguy cơ nhiễm toan acid lactic ở bệnh nhân suy thận", "Các thuốc hạ đường huyết thay thế Metformin khi suy thận", "Xét nghiệm Creatinin huyết thanh và eGFR định kỳ"],
         ["eGFR 45 - 59: tối đa 1000 mg/ngày", "eGFR 30 - 44: tối đa 500 mg/ngày", "eGFR < 30 mL/phút/1.73m2: CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI"])

add_case(41, "dosage_and_adjustments", "Meropenem suy thận chỉnh liều thế nào khi eGFR 25?", "MEDICATION_SAFETY_PROFILE",
         ["meropenem"], "DĐVN V Trang 940",
         ["Chỉnh liều Meropenem khi lọc máu HD", "Nguy cơ co giật của Meropenem", "Phối hợp Meropenem nhiễm khuẩn nặng"],
         ["eGFR 25 mL/phút: Giảm liều 500mg mỗi 12 giờ (thay vì 1g mỗi 8 giờ ở người bình thường)"])

add_case(42, "dosage_and_adjustments", "Enoxaparin (Lovenox) chỉnh liều thế nào ở bệnh nhân suy thận nặng ClCr < 30?", "MEDICATION_SAFETY_PROFILE",
         ["enoxaparin", "lovenox"], "DĐVN V Trang 580",
         ["Theo dõi Anti-Xa khi dùng Enoxaparin suy thận", "Chuyển sang Heparin không phân đoạn khi suy thận nặng", "Nguy cơ xuất huyết do tích lũy thuốc"],
         ["ClCr < 30 mL/phút: Giảm liều dự phòng xuống 20 mg (2000 IU) 1 lần/ngày", "Liều điều trị giảm xuống 1 mg/kg 1 lần/ngày (thay vì 2 lần/ngày)"])

add_case(43, "dosage_and_adjustments", "Ibuprofen liều hạ sốt giảm đau cho trẻ 20kg là bao nhiêu?", "MEDICATION_SAFETY_PROFILE",
         ["ibuprofen"], "DĐVN V Trang 790",
         ["Chống chỉ định Ibuprofen trong sốt xuất huyết Dengue", "Ibuprofen uống sau khi ăn no", "Khoảng cách giữa các liều Ibuprofen"],
         ["Liều 5 - 10 mg/kg/lần (với trẻ 20kg: 100 - 200 mg/lần)", "Cách mỗi 6 - 8 giờ một lần", "Tối đa 30 - 40 mg/kg/ngày", "Chống chỉ định khi nghi ngờ sốt xuất huyết"])

add_case(44, "dosage_and_adjustments", "Ceftriaxon có cần chỉnh liều ở bệnh nhân suy thận đơn thuần không?", "MEDICATION_SAFETY_PROFILE",
         ["ceftriaxon"], "DĐVN V Trang 320",
         ["Chỉnh liều Ceftriaxon khi suy cả gan và thận kết hợp", "Liều Ceftriaxon tối đa trong suy thận nặng", "Ceftriaxon không cần chỉnh liều trong lọc máu"],
         ["Suy thận đơn thuần không cần chỉnh liều do thuốc bài tiết kép qua cả gan/mật và thận", "Nếu suy thận nặng kèm suy gan: liều tối đa không quá 2g/ngày"])

add_case(45, "dosage_and_adjustments", "Ciprofloxacin suy thận chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin"], "DĐVN V Trang 400",
         ["Uống nhiều nước phòng kết tinh niệu Ciprofloxacin", "Chỉnh liều Ciprofloxacin lọc máu", "Theo dõi tác dụng phụ thần kinh"],
         ["ClCr 30 - 50 mL/phút: dùng 250 - 500mg mỗi 12 giờ", "ClCr < 30 mL/phút: dùng 250 - 500mg mỗi 18 - 24 giờ"])

add_case(46, "dosage_and_adjustments", "Levofloxacin suy thận ClCr 35 chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["levofloxacin"], "DĐVN V Trang 890",
         ["Liều tấn công Levofloxacin ban đầu", "Nguy cơ tích lũy độc tính co giật Levofloxacin", "Thời điểm dùng sau lọc máu"],
         ["Khởi đầu liều nạp bình thường 500mg", "Duy trì 250mg mỗi 24 giờ (hoặc 500mg mỗi 48 giờ) đối với ClCr 20 - 49 mL/phút"])

add_case(47, "dosage_and_adjustments", "Colchicine chỉnh liều thế nào ở người suy thận?", "MEDICATION_SAFETY_PROFILE",
         ["colchicine"], "DĐVN V Trang 445",
         ["Nguy cơ tích lũy Colchicine gây liệt tủy suy đa tạng", "Chống chỉ định phối hợp Colchicine với Clarithromycin ở suy thận", "Liều Colchicine duy trì"],
         ["ClCr 30 - 50 mL/phút: giảm liều 50% hoặc tăng khoảng cách", "ClCr < 30 mL/phút: CHỐNG CHỈ ĐỊNH hoặc tối đa 0.5mg mỗi 2 - 3 ngày", "Chống chỉ định ở suy thận nặng"])

add_case(48, "dosage_and_adjustments", "Allopurinol chỉnh liều suy thận ClCr 15 như thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["allopurinol"], "DĐVN V Trang 110",
         ["Hội chứng quá mẫn nghiêm trọng AHS Allopurinol", "Theo dõi Acid uric máu", "Thuốc hạ acid uric thay thế Febuxostat"],
         ["Khởi đầu liều thấp 50 - 100mg cách ngày hoặc 100mg 2 - 3 lần/tuần", "Tăng liều rất thận trọng để phòng hội chứng quá mẫn AHS"])

add_case(49, "dosage_and_adjustments", "Amikacin chỉnh liều và theo dõi nồng độ đỉnh/đáy thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["amikacin"], "DĐVN V Trang 130",
         ["Độc tính trên tai không hồi phục của Amikacin", "Liều duy nhất trong ngày ODA Amikacin", "Khoảng cách đưa liều kéo dài khi suy thận"],
         ["Liều 15 mg/kg/ngày", "Khi suy thận phải kéo dài khoảng cách đưa liều (24h - 48h - 72h) theo ClCr", "Đỉnh Peak 20 - 30 mcg/ml, Đáy Trough < 5 mcg/ml"])

add_case(50, "dosage_and_adjustments", "Morphin liều khởi đầu giảm đau ở người lớn chưa từng dùng opioid?", "MEDICATION_SAFETY_PROFILE",
         ["morphin"], "DĐVN V Trang 985 & TT 20/2017",
         ["Theo dõi nhịp thở khi dùng Morphin", "Thuốc kháng Morphin Naloxone", "Tác dụng phụ táo bón do Opioid"],
         ["Uống: 10 - 20mg mỗi 4 giờ", "Tiêm dưới da hoặc tiêm bắp: 5 - 10mg mỗi 4 giờ", "Tiêm tĩnh mạch chậm: 2.5 - 5mg pha loãng tiêm trong 4 - 5 phút"])

add_case(51, "dosage_and_adjustments", "Diazepam cắt cơn co giật trẻ em dùng liều bao nhiêu và đường nào?", "MEDICATION_SAFETY_PROFILE",
         ["diazepam"], "DĐVN V Trang 510 & Phác đồ Bộ Y tế",
         ["Nguy cơ ngừng thở khi tiêm Diazepam nhanh", "Đường bơm hậu môn Diazepam khi chưa có ven", "Liều nhắc lại Diazepam sau 10 - 15 phút"],
         ["Bơm trực tràng dạng dung dịch: 0.5 mg/kg", "Tiêm tĩnh mạch chậm: 0.2 - 0.3 mg/kg (tốc độ tối đa 1mg/phút)", "Chuẩn bị sẵn bóng bóp và oxy phòng suy hô hấp"])

add_case(52, "dosage_and_adjustments", "Adrenalin liều cấp cứu phản vệ cho người lớn là bao nhiêu?", "MEDICATION_SAFETY_PROFILE",
         ["adrenalin", "epinephrine"], "Thông tư 51/2017/TT-BYT",
         ["Vị trí tiêm Adrenalin bắp đùi", "Thời gian tiêm nhắc lại Adrenalin sau 3 - 5 phút", "Liều Adrenalin cho trẻ em"],
         ["Tiêm bắp 1/2 ống (0.5mg đối với ống 1mg/1ml) ở mặt trước ngoài đùi", "Nhắc lại sau 3 - 5 phút nếu huyết áp và triệu chứng chưa cải thiện"])

add_case(53, "dosage_and_adjustments", "Adrenalin liều cấp cứu phản vệ cho trẻ em 10kg?", "MEDICATION_SAFETY_PROFILE",
         ["adrenalin", "epinephrine"], "Thông tư 51/2017/TT-BYT",
         ["Bảng phân liều Adrenalin theo độ tuổi Thông tư 51", "Tiêm bắp mặt trước ngoài đùi trẻ", "Theo dõi mạch huyết áp SpO2"],
         ["Trẻ < 10kg tiêm bắp 1/5 ống (khoảng 0.1 - 0.15 mg hoặc 0.01 mg/kg tiêm bắp)", "Tiêm mặt trước ngoài đùi"])

add_case(54, "dosage_and_adjustments", "Fentanyl liều giảm đau trong phẫu thuật người lớn?", "MEDICATION_SAFETY_PROFILE",
         ["fentanyl"], "DĐVN V Trang 650 & TT 20/2017",
         ["Tác dụng phụ cứng cơ lồng ngực do Fentanyl", "Kháng độc Naloxone", "Tác dụng phụ tụt huyết áp và chậm nhịp tim"],
         ["Liều khởi đầu giảm đau 1 - 2 mcg/kg tiêm tĩnh mạch chậm", "Duy trì 25 - 50 mcg khi cần", "Theo dõi sát thông khí và SpO2"])

add_case(55, "dosage_and_adjustments", "Methylprednisolon liều xung (Pulse therapy) trong viêm cầu thận lupus?", "MEDICATION_SAFETY_PROFILE",
         ["methylprednisolon"], "DĐVN V & Hướng dẫn Bộ Y tế",
         ["Theo dõi huyết áp đường huyết điện giải khi truyền liều xung", "Nguy cơ nhiễm trùng cơ hội", "Dự phòng loét dạ dày bằng PPI"],
         ["Liều 500mg - 1000mg/ngày truyền tĩnh mạch trong ít nhất 30 - 60 phút trong 3 ngày liên tiếp", "Theo dõi sát nhịp tim và huyết áp"])

add_case(56, "dosage_and_adjustments", "Gabapentin chỉnh liều suy thận ClCr 20 như thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["gabapentin"], "DĐVN V Trang 700",
         ["Tác dụng phụ buồn ngủ chóng mặt Gabapentin", "Chỉnh liều Gabapentin lọc máu chu kỳ", "Nguy cơ suy hô hấp khi phối hợp Opioid"],
         ["ClCr 15 - 29 mL/phút: Giảm liều 200 - 700 mg/ngày chia làm 1 lần duy nhất hoặc 2 lần", "Tránh quá liều gây suy hô hấp và ức chế thần kinh"])

add_case(57, "dosage_and_adjustments", "Pregabalin suy thận eGFR 25 chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["pregabalin"], "DĐVN V Trang 1130",
         ["Liều khởi đầu Pregabalin đau dây thần kinh", "Tác dụng phụ phù ngoại biên Pregabalin", "Giảm liều từ từ tránh hội chứng cai thuốc"],
         ["eGFR 15 - 29 mL/phút: Khởi đầu 25 - 50 mg/ngày, liều tối đa 150 mg/ngày chia làm 1 hoặc 2 lần"])

add_case(58, "dosage_and_adjustments", "Piperacillin/Tazobactam chỉnh liều suy thận ClCr 30?", "MEDICATION_SAFETY_PROFILE",
         ["piperacillin", "tazobactam"], "DĐVN V Trang 1105",
         ["Liều Piperacillin/Tazobactam nhiễm khuẩn Pseudomonas", "Thời gian truyền kéo dài 3 - 4 giờ", "Dị ứng chéo Penicillin"],
         ["ClCr 20 - 40 mL/phút: Giảm liều xuống 2.25g mỗi 6 giờ hoặc 3.375g mỗi 8 giờ (thay vì 4.5g mỗi 6 - 8 giờ)"])

add_case(59, "dosage_and_adjustments", "Ceftazidim chỉnh liều suy thận ClCr 25?", "MEDICATION_SAFETY_PROFILE",
         ["ceftazidim"], "DĐVN V Trang 310",
         ["Ceftazidim điều trị nhiễm khuẩn trực khuẩn mủ xanh", "Nguy cơ độc tính thần kinh co giật khi tích lũy thuốc", "Liều Ceftazidim sau lọc máu"],
         ["ClCr 16 - 30 mL/phút: Dùng 1g mỗi 12 giờ (thay vì 1 - 2g mỗi 8 giờ)"])

add_case(60, "dosage_and_adjustments", "Fluconazole suy thận ClCr 30 chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["fluconazole"], "DĐVN V Trang 680",
         ["Liều nạp Fluconazole ngày đầu tiên", "Tương tác Fluconazole ức chế CYP", "Theo dõi chức năng gan khi dùng Fluconazole"],
         ["Ngày đầu tiên dùng liều nạp bình thường (100 - 400mg)", "Từ ngày thứ 2: giảm 50% liều khuyến cáo hàng ngày khi ClCr <= 50 mL/phút"])

add_case(61, "dosage_and_adjustments", "Clarithromycin chỉnh liều thế nào ở bệnh nhân suy thận nặng ClCr < 30?", "MEDICATION_SAFETY_PROFILE",
         ["clarithromycin"], "DĐVN V Trang 410",
         ["Chống chỉ định phối hợp Clarithromycin và Colchicine ở suy thận", "Tác dụng phụ kéo dài QT Clarithromycin", "Tương tác với Statin"],
         ["ClCr < 30 mL/phút: Giảm 50% liều (tối đa 250mg 1 lần/ngày hoặc 250mg 2 lần/ngày trong nhiễm khuẩn nặng)"])

add_case(62, "dosage_and_adjustments", "Digoxin người cao tuổi suy thận nhẹ chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["digoxin"], "DĐVN V Trang 520",
         ["Dấu hiệu ngộ độc Digoxin nhìn vàng loạn nhịp", "Mục tiêu nồng độ Digoxin máu 0.5 - 0.9 ng/ml", "Theo dõi Kali máu"],
         ["Giảm liều duy trì xuống 0.0625 - 0.125 mg/ngày hoặc dùng cách ngày", "Theo dõi nồng độ thuốc trong máu và kali máu"])

add_case(63, "dosage_and_adjustments", "Tranexamic acid suy thận chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["tranexamic acid"], "DĐVN V Trang 1290",
         ["Nguy cơ huyết khối khi dùng Tranexamic acid", "Đường tiêm tĩnh mạch chậm Tranexamic acid", "Liều Tranexamic acid chảy máu răng"],
         ["ClCr 20 - 50 mL/phút: 10 mg/kg tiêm TM mỗi 12 giờ", "ClCr 10 - 20 mL/phút: 10 mg/kg mỗi 24 giờ", "ClCr < 10 mL/phút: 5 mg/kg mỗi 24 giờ"])

add_case(64, "dosage_and_adjustments", "Acetylcystein liều giải độc Paracetamol đường uống?", "MEDICATION_SAFETY_PROFILE",
         ["acetylcystein"], "DĐVN V Trang 80 & Phác đồ Trung tâm Chống độc",
         ["Thời điểm vàng dùng Acetylcystein trong 8 giờ đầu", "Liều nạp và liều duy trì NAC", "Phác đồ truyền tĩnh mạch Acetylcystein"],
         ["Liều nạp: 140 mg/kg", "Sau đó duy trì 70 mg/kg mỗi 4 giờ một lần trong tổng cộng 17 liều tiếp theo"])

add_case(65, "dosage_and_adjustments", "Insulin Regular tiêm tĩnh mạch xử trí toan ceton đái tháo đường DKA liều bao nhiêu?", "MEDICATION_SAFETY_PROFILE",
         ["insulin"], "Hướng dẫn chẩn đoán và điều trị ĐTĐ Bộ Y tế",
         ["Theo dõi đường huyết mao mạch mỗi 1 giờ", "Bù Kali trước và trong khi truyền Insulin", "Chuyển sang tiêm dưới da khi kiểm soát toan ceton"],
         ["Liều nạp 0.1 đơn vị/kg tiêm TM (hoặc bỏ qua liều nạp), sau đó truyền TM liên tục 0.1 đơn vị/kg/giờ", "Giám sát chặt kali máu"])

add_case(66, "dosage_and_adjustments", "Amoxicillin liều người lớn điều trị viêm họng nhiễm khuẩn?", "MEDICATION_SAFETY_PROFILE",
         ["amoxicillin"], "DĐVN V Trang 145",
         ["Thời gian dùng kháng sinh đủ 7 - 10 ngày", "Tác dụng phụ tiêu chảy và phát ban", "Dị ứng Penicillin"],
         ["500mg mỗi 8 giờ (3 lần/ngày) hoặc 875 - 1000mg mỗi 12 giờ (2 lần/ngày) trong 7 - 10 ngày"])

add_case(67, "dosage_and_adjustments", "Cefotaxim suy thận ClCr 15 chỉnh liều thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["cefotaxim"], "DĐVN V Trang 300",
         ["Cefotaxim trong viêm màng não mủ", "Dị ứng Cephalosporin", "Cefotaxim tiêm tĩnh mạch chậm"],
         ["ClCr < 20 mL/phút: Giảm liều đi một nửa liều khuyến cáo (ví dụ 1g mỗi 12 giờ thay vì mỗi 6 - 8 giờ)"])

add_case(68, "dosage_and_adjustments", "Gentamicin liều duy nhất 1 lần trong ngày (Once daily) cho người lớn?", "MEDICATION_SAFETY_PROFILE",
         ["gentamicin"], "DĐVN V Trang 710",
         ["Theo dõi nồng độ đáy Gentamicin < 1 mcg/ml", "Độc tính ốc tai tiền đình và thận", "Thời gian điều trị kháng sinh nhóm Aminoglycosid"],
         ["Liều 5 - 7 mg/kg tiêm truyền tĩnh mạch 1 lần duy nhất trong ngày trong 30 - 60 phút"])

add_case(69, "dosage_and_adjustments", "Spironolactone liều khởi đầu suy tim mạn phân suất tống máu giảm?", "MEDICATION_SAFETY_PROFILE",
         ["spironolactone"], "DĐVN V & Hướng dẫn Suy tim Bộ Y tế",
         ["Theo dõi Kali máu và Creatinin sau 1 tuần khởi đầu", "Chống chỉ định khi Kali máu > 5.0 mmol/L", "Tăng liều Spironolactone lên 50mg"],
         ["Khởi đầu 12.5 - 25 mg 1 lần/ngày", "Kiểm tra kali máu và chức năng thận trước và sau 1 - 4 tuần điều trị"])

add_case(70, "dosage_and_adjustments", "Enalapril chỉnh liều thế nào khi suy thận ClCr 25?", "MEDICATION_SAFETY_PROFILE",
         ["enalapril"], "DĐVN V Trang 570",
         ["Khởi đầu liều thấp Enalapril tránh tụt huyết áp", "Tác dụng phụ ho khan do ACEI", "Theo dõi Kali máu và eGFR"],
         ["Khởi đầu liều thấp 2.5 mg 1 lần/ngày", "Chỉnh liều dần theo đáp ứng huyết áp, tối đa 20 mg/ngày"])

# ==============================================================================
# NHÓM 3: TƯƠNG TÁC THUỐC DDI & ĐA DƯỢC HỌC QĐ 5948/QĐ-BYT (35 CÂU)
# ==============================================================================
add_case(71, "drug_interactions", "Tương tác giữa Clopidogrel và Omeprazol có nguy hiểm không?", "MEDICATION_SAFETY_PROFILE",
         ["clopidogrel", "omeprazol"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["PPI thay thế an toàn Pantoprazole", "Cơ chế ức chế cạnh tranh enzym gan CYP2C19", "Nguy cơ huyết khối stent tái phát"],
         ["Chống chỉ định hoặc không khuyến cáo phối hợp", "Omeprazol ức chế CYP2C19 làm giảm chuyển hóa Clopidogrel thành chất có hoạt tính", "Tăng nguy cơ biến cố huyết khối tim mạch", "Khuyến cáo đổi sang Pantoprazol"])

add_case(72, "drug_interactions", "Kiểm tra tương tác giữa Cordarone (Amiodaron) và Sovaldi (Sofosbuvir)?", "MEDICATION_SAFETY_PROFILE",
         ["amiodaron", "sofosbuvir"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & FDA Warning",
         ["Nguy cơ chậm nhịp tim kịch phát và ngừng tim", "Chống chỉ định phối hợp tuyệt đối", "Thời gian bán thải kéo dài của Amiodaron"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP TUYỆT ĐỐI", "Gây chậm nhịp tim nặng đe dọa tính mạng và ngừng tim", "Amiodaron có thời gian bán thải hàng tháng nên không dùng Sofosbuvir kể cả khi vừa ngừng Amiodaron"])

add_case(73, "drug_interactions", "Tương tác giữa Paxlovid và Simvastatin?", "MEDICATION_SAFETY_PROFILE",
         ["paxlovid", "simvastatin"], "Quyết định 5948/QĐ-BYT & Hướng dẫn Bộ Y tế",
         ["Ritonavir ức chế mạnh CYP3A4", "Nguy cơ tiêu cơ vân cấp và suy thận", "Tạm ngừng Statin khi uống Paxlovid"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP", "Ritonavir trong Paxlovid ức chế mạnh CYP3A4 làm tăng nồng độ Simvastatin gấp hàng chục lần", "Nguy cơ tiêu cơ vân cấp rhabdomyolysis và suy thận cấp", "Tạm ngừng Simvastatin trước và trong khi dùng Paxlovid"])

add_case(74, "drug_interactions", "Tương tác giữa Allopurinol (Zyloric) và Imuran (Azathioprine)?", "MEDICATION_SAFETY_PROFILE",
         ["allopurinol", "azathioprine"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Ức chế enzym Xanthine oxidase chuyển hóa 6-MP", "Nguy cơ suy tủy toàn bộ và nhiễm trùng cơ hội", "Giảm liều Azathioprine xuống 1/4 nếu bắt buộc phối hợp"],
         ["CHỐNG CHỈ ĐỊNH HOẶC NGUY HIỂM TÍNH MẠNG", "Allopurinol ức chế enzym xanthine oxidase làm tích lũy 6-mercaptopurine", "Gây suy tủy xương nghiêm trọng đe dọa tính mạng", "Nếu bắt buộc dùng phải giảm liều Azathioprine xuống còn 25 - 33% liều bình thường"])

add_case(75, "drug_interactions", "Tương tác giữa Nitroglycerin và Viagra (Sildenafil)?", "MEDICATION_SAFETY_PROFILE",
         ["nitroglycerin", "sildenafil"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & AHA/ACC",
         ["Nguy cơ tụt huyết áp kịch phát và sốc tim tử vong", "Khoảng cách an toàn tối thiểu 24 giờ sau dùng Sildenafil", "Chống chỉ định tuyệt đối nhóm Nitrat"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP TUYỆT ĐỐI", "Gây giãn mạch hiệp đồng dẫn đến tụt huyết áp kịch phát, thiếu máu cơ tim và tử vong", "Không dùng Nitrat trong vòng 24h sau Sildenafil và 48h sau Tadalafil"])

add_case(76, "drug_interactions", "Warfarin phối hợp với Aspirin có tương tác gì?", "MEDICATION_SAFETY_PROFILE",
         ["warfarin", "aspirin"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Tăng nguy cơ xuất huyết tiêu hóa và nội sọ nghiêm trọng", "Chỉ định phối hợp chặt chẽ ở bệnh nhân van tim cơ học", "Theo dõi sát INR"],
         ["Tăng nguy cơ xuất huyết tiêu hóa và xuất huyết nặng đe dọa tính mạng", "Hiệp đồng tác dụng chống đông và ức chế tiểu cầu cộng với kích ứng niêm mạc dạ dày của Aspirin", "Chỉ phối hợp khi có chỉ định chuyên khoa chặt chẽ"])

add_case(77, "drug_interactions", "Warfarin phối hợp với NSAIDs (như Ibuprofen) có an toàn không?", "MEDICATION_SAFETY_PROFILE",
         ["warfarin", "ibuprofen"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Tránh phối hợp NSAID với thuốc chống đông kháng vitamin K", "Ưu tiên Paracetamol giảm đau hạ sốt", "Cơ chế loét trợt dạ dày và ức chế tiểu cầu"],
         ["KHÔNG ĐƯỢC PHỐI HỢP (Chống chỉ định tương đối / Nguy cơ rất cao)", "NSAIDs làm tăng mạnh nguy cơ xuất huyết tiêu hóa do gây loét niêm mạc và ức chế tiểu cầu", "Ưu tiên thay thế bằng Paracetamol khi cần giảm đau hạ sốt"])

add_case(78, "drug_interactions", "Simvastatin phối hợp với Clarithromycin có nguy cơ gì?", "MEDICATION_SAFETY_PROFILE",
         ["simvastatin", "clarithromycin"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Clarithromycin ức chế mạnh CYP3A4", "Tăng nồng độ Simvastatin gây tiêu cơ vân tiêu hủy tế bào cơ", "Tạm dừng Simvastatin khi điều trị Clarithromycin"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP", "Clarithromycin ức chế mạnh CYP3A4 làm tăng nồng độ Simvastatin trong máu lên nhiều lần", "Nguy cơ tổn thương cơ vân, tăng men CK và suy thận cấp", "Tạm ngừng Simvastatin trong thời gian dùng Clarithromycin"])

add_case(79, "drug_interactions", "Metformin và thuốc cản quang iod tiêm tĩnh mạch?", "MEDICATION_SAFETY_PROFILE",
         ["metformin"], "QĐ 5481/QĐ-BYT & Khuyến cáo ACR",
         ["Nguy cơ suy thận cấp do thuốc cản quang dẫn đến nhiễm toan acid lactic", "Ngừng Metformin 48h trước hoặc tại thời điểm chụp CT", "Kiểm tra lại chức năng thận sau 48h trước khi dùng lại Metformin"],
         ["Nguy cơ nhiễm toan acid lactic thứ phát sau suy thận cấp do thuốc cản quang", "Phải tạm ngừng Metformin trước hoặc tại thời điểm chụp, xét nghiệm lại chức năng thận sau 48h, chỉ dùng lại khi eGFR ổn định"])

add_case(80, "drug_interactions", "Digoxin phối hợp với Amiodaron cần lưu ý gì?", "MEDICATION_SAFETY_PROFILE",
         ["digoxin", "amiodaron"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Amiodaron ức chế P-glycoprotein làm tăng nồng độ Digoxin gấp đôi", "Nguy cơ ngộ độc Digoxin chậm nhịp xoang block nhĩ thất", "Giảm 50% liều Digoxin khi bắt đầu dùng Amiodaron"],
         ["Amiodaron làm tăng nồng độ Digoxin trong huyết tương lên khoảng 70 - 100% qua ức chế P-gp", "Tăng độc tính tim (chậm nhịp, block nhĩ thất, loạn nhịp)", "Cần giảm liều Digoxin từ 30 - 50% và theo dõi nồng độ Digoxin máu"])

add_case(81, "drug_interactions", "Methotrexate phối hợp với NSAIDs có nguy hiểm không?", "MEDICATION_SAFETY_PROFILE",
         ["methotrexate", "ibuprofen"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["NSAIDs giảm bài tiết Methotrexate qua ống thận", "Nguy cơ suy tủy ức chế tạo máu giảm bạch cầu tiểu cầu", "Độc tính Methotrexate liều cao chống chỉ định tuyệt đối"],
         ["CHỐNG CHỈ ĐỊNH VỚI METHOTREXATE LIỀU CAO (trên 15mg/tuần) VÀ NGUY CƠ CAO VỚI LIỀU THẤP", "NSAIDs làm giảm độ thanh thải thận của Methotrexate dẫn đến tích lũy độc tính", "Gây suy tủy xương, viêm miệng, suy thận cấp"])

add_case(82, "drug_interactions", "Spironolactone phối hợp với Enalapril cần theo dõi gì?", "MEDICATION_SAFETY_PROFILE",
         ["spironolactone", "enalapril"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Nguy cơ tăng Kali máu nguy kịch > 5.5 mmol/L", "Rối loạn nhịp tim ngừng tim", "Xét nghiệm điện giải đồ sau 1 - 2 tuần"],
         ["Tăng nguy cơ tăng kali máu nghiêm trọng (> 5.5 mmol/L) và suy giảm chức năng thận", "Bắt buộc theo dõi sát điện giải đồ và creatinin máu định kỳ"])

add_case(83, "drug_interactions", "Ciprofloxacin phối hợp với Theophylline gây hậu quả gì?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin", "theophylline"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Ciprofloxacin ức chế CYP1A2 chuyển hóa Theophylline", "Nguy cơ ngộ độc Theophylline co giật loạn nhịp tim", "Giảm 50% liều Theophylline và theo dõi nồng độ thuốc"],
         ["CHỐNG CHỈ ĐỊNH HOẶC CỰC KỲ THẬN TRỌNG", "Ciprofloxacin ức chế mạnh enzym CYP1A2 làm giảm chuyển hóa Theophylline", "Tăng nồng độ Theophylline gây co giật, loạn nhịp thất và tử vong"])

add_case(84, "drug_interactions", "Fluconazole phối hợp với Warfarin có tương tác gì?", "MEDICATION_SAFETY_PROFILE",
         ["fluconazole", "warfarin"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Fluconazole ức chế CYP2C9 chuyển hóa S-warfarin", "Tăng vọt chỉ số INR nguy cơ xuất huyết não tiêu hóa", "Giảm liều Warfarin và kiểm tra INR sau 2 - 3 ngày"],
         ["Fluconazole ức chế mạnh CYP2C9 làm giảm chuyển hóa S-warfarin", "Kéo dài thời gian prothrombin và tăng vọt INR dẫn đến nguy cơ xuất huyết nặng", "Phải giảm liều Warfarin và theo dõi INR sát sao"])

add_case(85, "drug_interactions", "Tramadol phối hợp với thuốc chống trầm cảm SSRI (như Sertraline)?", "MEDICATION_SAFETY_PROFILE",
         ["tramadol", "sertraline"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Hội chứng Serotonin kích thích sốt cao giật cơ co giật", "Tăng nguy cơ co giật của Tramadol", "Theo dõi tri giác và phản xạ gân xương"],
         ["Tăng nguy cơ xảy ra Hội chứng Serotonin (sốt cao, kích động, run giật cơ, rối loạn thần kinh thực vật) và tăng nguy cơ co giật", "Tránh phối hợp hoặc theo dõi sát"])

add_case(86, "drug_interactions", "Paracetamol uống cùng với rượu bia có tác hại gì?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V Trang 1050 & Cảnh báo Bộ Y tế",
         ["Rượu cảm ứng enzym CYP2E1 tạo chất độc NAPQI", "Tăng nguy cơ hoại tử tế bào gan cấp", "Không uống rượu bia khi dùng Paracetamol"],
         ["Rượu cảm ứng enzym CYP2E1 làm tăng tạo chất chuyển hóa độc NAPQI", "Làm cạn kiệt Glutathione tế bào gan dẫn đến hoại tử gan cấp tính kể cả ở liều Paracetamol thông thường"])

add_case(87, "drug_interactions", "Levothyroxine uống cùng lúc với viên Sắt hoặc Canxi?", "MEDICATION_SAFETY_PROFILE",
         ["levothyroxine"], "DĐVN V Trang 905",
         ["Tạo phức chelat không hấp thu hormon tuyến giáp", "Uống cách xa viên Sắt Canxi tối thiểu 4 giờ", "Hậu quả suy giáp không kiểm soát"],
         ["Các ion kim loại Fe2+, Ca2+ tạo phức chelat không tan với Levothyroxine làm giảm hấp thu hormon tuyến giáp tới 50%", "Phải uống cách xa nhau ít nhất 4 giờ"])

add_case(88, "drug_interactions", "Ciprofloxacin uống cùng sữa hoặc thuốc kháng acid chứa Nhôm Magie?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin"], "DĐVN V Trang 400",
         ["Tạo chelat không hấp thu kháng sinh Quinolone", "Uống trước 2h hoặc sau 4 - 6h so với antacid", "Giảm nồng độ kháng sinh gây thất bại điều trị"],
         ["Ion kim loại đa hóa trị (Al, Mg, Ca trong sữa/antacid) tạo phức chelat không hấp thu với Ciprofloxacin", "Làm giảm sinh khả dụng của kháng sinh tới 80%", "Phải uống Ciprofloxacin 2 giờ trước hoặc 4 giờ sau"])

add_case(89, "drug_interactions", "Morphin phối hợp với Diazepam cần cảnh báo gì?", "MEDICATION_SAFETY_PROFILE",
         ["morphin", "diazepam"], "FDA Black Box Warning & Bộ Y tế",
         ["Nguy cơ ức chế hô hấp sâu hôn mê và tử vong", "Giảm liều cả hai thuốc nếu bắt buộc phối hợp", "Chuẩn bị sẵn Naloxone và Flumazenil"],
         ["CẢNH BÁO ĐỎ (BLACK BOX WARNING): Tăng nguy cơ ức chế thần kinh trung ương sâu, suy hô hấp nặng, hôn mê và tử vong", "Chỉ phối hợp khi không có lựa chọn thay thế và phải giám sát hô hấp liên tục"])

add_case(90, "drug_interactions", "Cordarone (Amiodaron) phối hợp với Levofloxacin có nguy cơ gì?", "MEDICATION_SAFETY_PROFILE",
         ["amiodaron", "levofloxacin"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Hiệp đồng kéo dài khoảng QTc trên điện tâm đồ", "Nguy cơ loạn nhịp xoắn đỉnh Torsades de pointes ngừng tim", "Chống chỉ định phối hợp hoặc đo ECG liên tục"],
         ["Hiệp đồng tác dụng kéo dài khoảng QTc trên điện tâm đồ", "Nguy cơ cao gây loạn nhịp thất đa hình thái, xoắn đỉnh (Torsades de pointes) và ngừng tim", "Tránh phối hợp tuyệt đối"])

add_case(91, "drug_interactions", "Clarithromycin phối hợp với Colchicine ở bệnh nhân suy thận?", "MEDICATION_SAFETY_PROFILE",
         ["clarithromycin", "colchicine"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & FDA Warning",
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI", "Clarithromycin ức chế CYP3A4 và P-gp làm tích lũy Colchicine", "Gây ngộ độc Colchicine tử vong"],
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI ở bệnh nhân có suy giảm chức năng gan hoặc thận", "Clarithromycin ức chế mạnh CYP3A4 và P-glycoprotein dẫn đến tích lũy nồng độ Colchicine gây tử vong"])

add_case(92, "drug_interactions", "Rifampicin dùng cùng thuốc tránh thai đường uống?", "MEDICATION_SAFETY_PROFILE",
         ["rifampicin"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Rifampicin cảm ứng mạnh enzym gan CYP3A4", "Tăng chuyển hóa thải trừ estrogen và progestin", "Thất bại tránh thai có thai ngoài ý muốn"],
         ["Rifampicin là chất cảm ứng enzym gan cực mạnh (CYP3A4)", "Làm tăng chuyển hóa và giảm mạnh nồng độ hoóc môn tránh thai dẫn đến mất tác dụng tránh thai", "Phải dùng thêm biện pháp tránh thai cơ học (bao cao su)"])

add_case(93, "drug_interactions", "Lithium phối hợp với thuốc ức chế men chuyển ACEI (như Enalapril)?", "MEDICATION_SAFETY_PROFILE",
         ["lithium", "enalapril"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["ACEI làm giảm bài tiết Lithium qua thận", "Nguy cơ ngộ độc Lithium run giật mất điều hòa hôn mê", "Theo dõi nồng độ Lithium máu"],
         ["ACEI làm giảm thải trừ Lithium qua ống thận dẫn đến tăng nồng độ Lithium trong máu", "Gây ngộ độc Lithium nghiêm trọng (run giật, mất điều hòa, suy thận, lú lẫn, co giật)"])

add_case(94, "drug_interactions", "Dabigatran phối hợp với Ketoconazole hoặc Itraconazole?", "MEDICATION_SAFETY_PROFILE",
         ["dabigatran"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Ketoconazole ức chế mạnh P-glycoprotein", "Tăng nồng độ Dabigatran gây xuất huyết nặng", "Chống chỉ định phối hợp đường toàn thân"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP đường toàn thân", "Ketoconazole ức chế mạnh P-glycoprotein làm tăng nồng độ Dabigatran huyết tương gấp 2 - 3 lần dẫn đến nguy cơ xuất huyết đe dọa tính mạng"])

add_case(95, "drug_interactions", "Tacrolimus phối hợp với Diltiazem cần lưu ý gì?", "MEDICATION_SAFETY_PROFILE",
         ["tacrolimus", "diltiazem"], "DĐVN V Trang 1250",
         ["Diltiazem ức chế CYP3A4 và P-gp làm tăng nồng độ Tacrolimus", "Nguy cơ độc thận độc thần kinh", "Định lượng nồng độ đáy Tacrolimus"],
         ["Diltiazem ức chế CYP3A4 và P-glycoprotein làm tăng nồng độ Tacrolimus trong máu", "Tăng nguy cơ độc tính trên thận và thần kinh", "Phải giảm liều Tacrolimus và định lượng nồng độ đáy thường xuyên"])

add_case(96, "drug_interactions", "Atorvastatin phối hợp với Gemfibrozil có nguy cơ gì?", "MEDICATION_SAFETY_PROFILE",
         ["atorvastatin", "gemfibrozil"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Gemfibrozil ức chế glucuronid hóa statin", "Tăng nguy cơ tiêu cơ vân cấp rhabdomyolysis", "Ưu tiên Fenofibrate nếu bắt buộc phối hợp"],
         ["CHỐNG CHỈ ĐỊNH HOẶC TRÁNH PHỐI HỢP", "Gemfibrozil ức chế quá trình glucuronid hóa và cạnh tranh thanh thải qua gan của Statin", "Tăng vọt nguy cơ viêm cơ và tiêu cơ vân cấp", "Nếu bắt buộc phối hợp fibrat nên chọn Fenofibrat"])

add_case(97, "drug_interactions", "Haloperidol phối hợp với Cordarone (Amiodaron)?", "MEDICATION_SAFETY_PROFILE",
         ["haloperidol", "amiodaron"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Hiệp đồng kéo dài khoảng QTc xoắn đỉnh", "Chống chỉ định phối hợp", "Theo dõi điện tâm đồ"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP", "Cả hai thuốc đều làm kéo dài khoảng QT", "Tăng nguy cơ loạn nhịp thất đe dọa tính mạng và xoắn đỉnh (Torsades de pointes)"])

add_case(98, "drug_interactions", "Linezolid phối hợp với thuốc ức chế tái thu hồi Serotonin SSRI?", "MEDICATION_SAFETY_PROFILE",
         ["linezolid"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Linezolid có hoạt tính ức chế MAO thuận nghịch", "Nguy cơ Hội chứng Serotonin sốt cao ác tính", "Tạm ngừng SSRI trước khi dùng Linezolid"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP", "Linezolid là chất ức chế monoamine oxidase (MAO) không chọn lọc thuận nghịch", "Phối hợp với SSRI gây Hội chứng Serotonin cấp tính đe dọa tính mạng"])

add_case(99, "drug_interactions", "Phenytoin phối hợp với Natri Valproate cần lưu ý gì?", "MEDICATION_SAFETY_PROFILE",
         ["phenytoin", "valproate"], "DĐVN V Trang 1090",
         ["Valproate đẩy Phenytoin khỏi liên kết protein huyết tương", "Tăng nồng độ Phenytoin tự do gây độc tính", "Theo dõi nồng độ Phenytoin tự do"],
         ["Valproate đẩy Phenytoin khỏi protein huyết tương và ức chế chuyển hóa Phenytoin", "Làm tăng nồng độ Phenytoin dạng tự do gây độc tính (chóng mặt, rung giật nhãn cầu, thất điều)"])

add_case(100, "drug_interactions", "Theophylline phối hợp với Cimetidine có tương tác gì?", "MEDICATION_SAFETY_PROFILE",
         ["theophylline", "cimetidine"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Cimetidine ức chế CYP1A2 và CYP3A4", "Tăng nồng độ Theophylline trong máu", "Ưu tiên đổi sang Ranitidine hoặc PPI"],
         ["Cimetidine ức chế các enzym gan chuyển hóa Theophylline làm tăng nồng độ Theophylline huyết tương từ 30 - 100%", "Dễ dẫn đến ngộ độc Theophylline", "Nên thay bằng PPI hoặc thuốc kháng H2 khác"])

add_case(101, "drug_interactions", "Doxycycline phối hợp với viên bổ sung Sắt hoặc Canxi?", "MEDICATION_SAFETY_PROFILE",
         ["doxycycline"], "DĐVN V Trang 550",
         ["Tạo phức chelat không hấp thu kháng sinh", "Uống cách xa tối thiểu 2 - 3 giờ", "Giảm hiệu lực điều trị nhiễm khuẩn"],
         ["Tạo phức chelat không hấp thu giữa Doxycycline và ion Fe, Ca, Mg làm giảm nghiêm trọng sinh khả dụng kháng sinh", "Phải uống cách xa nhau ít nhất 2 đến 3 giờ"])

add_case(102, "drug_interactions", "Rivaroxaban phối hợp với Clarithromycin có an toàn không?", "MEDICATION_SAFETY_PROFILE",
         ["rivaroxaban", "clarithromycin"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Clarithromycin ức chế kép CYP3A4 và P-gp", "Tăng nồng độ Rivaroxaban nguy cơ chảy máu", "Tránh dùng đồng thời ở bệnh nhân suy thận"],
         ["Clarithromycin ức chế mạnh cả CYP3A4 và P-glycoprotein làm tăng nồng độ Rivaroxaban", "Làm tăng đáng kể nguy cơ xuất huyết", "Không khuyến cáo dùng đồng thời ở bệnh nhân có suy giảm chức năng thận"])

add_case(103, "drug_interactions", "Ciclosporin phối hợp với Statin (Simvastatin, Atorvastatin)?", "MEDICATION_SAFETY_PROFILE",
         ["ciclosporin", "simvastatin"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Ciclosporin ức chế OATP1B1 và CYP3A4", "Tăng nồng độ Statin gấp nhiều lần", "Chống chỉ định Simvastatin liều cao với Ciclosporin"],
         ["CHỐNG CHỈ ĐỊNH HOẶC GIỚI HẠN LIỀU CHẶT CHẼ", "Ciclosporin làm tăng nồng độ Statin trong máu lên gấp nhiều lần", "Tăng vọt nguy cơ viêm cơ và tiêu cơ vân cấp"])

add_case(104, "drug_interactions", "Carbamazepine phối hợp với Erythromycin có tương tác gì?", "MEDICATION_SAFETY_PROFILE",
         ["carbamazepine", "erythromycin"], "Quyết định 5948/QĐ-BYT Bảng 3.1 & DĐVN V",
         ["Erythromycin ức chế CYP3A4 làm giảm chuyển hóa Carbamazepine", "Ngộ độc Carbamazepine buồn ngủ nhìn đôi chóng mặt", "Theo dõi nồng độ thuốc"],
         ["Erythromycin ức chế mạnh CYP3A4 làm giảm thanh thải Carbamazepine", "Gây ngộ độc Carbamazepine cấp tính (buồn ngủ, nhìn đôi, mất điều hòa, rung giật nhãn cầu)", "Tránh phối hợp"])

add_case(105, "drug_interactions", "Spironolactone phối hợp với viên bổ sung Kali (Kali clorid)?", "MEDICATION_SAFETY_PROFILE",
         ["spironolactone", "kali clorid"], "Quyết định 5948/QĐ-BYT & DĐVN V",
         ["Nguy cơ tăng Kali máu nghiêm trọng", "Rối loạn nhịp tim ngừng tim", "Chống chỉ định phối hợp trừ trường hợp hạ kali kháng trị"],
         ["CHỐNG CHỈ ĐỊNH PHỐI HỢP THƯỜNG QUY", "Spironolactone là thuốc lợi tiểu giữ kali", "Bổ sung thêm kali clorid dẫn đến tăng kali máu nặng đe dọa tính mạng và ngừng tim"])

# ==============================================================================
# NHÓM 4: TÁC DỤNG KHÔNG MONG MUỐN ADR, ĐỘC TÍNH & QUÁ LIỀU (30 CÂU)
# ==============================================================================
add_case(106, "adverse_effects_and_toxicity", "Amiodaron tác dụng phụ nguy hiểm nhất là gì?", "MEDICATION_SAFETY_PROFILE",
         ["amiodaron"], "DĐVN V Trang 180",
         ["Độc tính phổi mô kẽ xơ phổi", "Kéo dài khoảng QTc xoắn đỉnh", "Rối loạn chức năng tuyến giáp suy giáp cường giáp"],
         ["Độc tính trên phổi (viêm phổi kẽ, xơ phổi có thể tử vong)", "Kéo dài khoảng QT gây xoắn đỉnh", "Rối loạn chức năng tuyến giáp (suy giáp hoặc cường giáp)", "Lắng đọng giác mạc và độc tính gan"])

add_case(107, "adverse_effects_and_toxicity", "Paracetamol quá liều gây ngộ độc gì và thuốc giải độc đặc hiệu là gì?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V Trang 1050 & Phác đồ Trung tâm Chống độc",
         ["Hoại tử tế bào gan cấp suy gan", "Thuốc giải độc N-acetylcystein NAC", "Đo nồng độ Paracetamol theo đồ thị Rumack-Matthew"],
         ["Hoại tử tế bào gan cấp tính dẫn đến suy gan tối cấp và tử vong", "Thuốc giải độc đặc hiệu là N-acetylcystein (NAC)", "Hiệu quả cao nhất khi dùng trong vòng 8 giờ đầu sau ngộ độc"])

add_case(108, "adverse_effects_and_toxicity", "Dấu hiệu quá liều ngộ độc Morphin và thuốc đối kháng?", "MEDICATION_SAFETY_PROFILE",
         ["morphin"], "DĐVN V Trang 985 & TT 20/2017",
         ["Tam chứng ngộ độc Opioid: ức chế hô hấp, co đồng tử đinh ghim, hôn mê", "Thuốc giải độc Naloxone", "Liều Naloxone tiêm tĩnh mạch"],
         ["Tam chứng kinh điển: Ức chế hô hấp (thở chậm < 10 lần/phút hoặc ngừng thở), đồng tử co nhỏ như đầu đinh ghim, hôn mê sâu", "Thuốc kháng đặc hiệu: Naloxone tiêm tĩnh mạch"])

add_case(109, "adverse_effects_and_toxicity", "Dấu hiệu ngộ độc Digoxin và thuốc giải độc đặc hiệu?", "MEDICATION_SAFETY_PROFILE",
         ["digoxin"], "DĐVN V Trang 520",
         ["Rối loạn nhịp tim ngoại tâm thu thất block AV", "Rối loạn thị giác nhìn mờ nhìn thấy quầng màu vàng xanh", "Kháng thể kháng Digoxin DigiFab"],
         ["Rối loạn thị giác (nhìn thấy quầng màu vàng hoặc xanh lá cây), nôn mửa, rối loạn nhịp tim (ngoại tâm thu thất, nhịp chậm, block nhĩ thất)", "Thuốc giải độc đặc hiệu: Kháng thể kháng Digoxin (DigiFab/Digibind)"])

add_case(110, "adverse_effects_and_toxicity", "Tác dụng phụ chảy máu do Heparin xử trí bằng thuốc giải độc gì?", "MEDICATION_SAFETY_PROFILE",
         ["heparin"], "DĐVN V Trang 760",
         ["Thuốc đối kháng Protamine sulfat", "Liều Protamine 1mg trung hòa 100 đơn vị Heparin", "Theo dõi aPTT"],
         ["Thuốc trung hòa đặc hiệu là Protamine sulfat", "1 mg Protamine sulfat trung hòa khoảng 100 đơn vị Heparin", "Tiêm tĩnh mạch chậm để tránh hạ huyết áp"])

add_case(111, "adverse_effects_and_toxicity", "Quá liều Warfarin gây xuất huyết xử trí bằng thuốc gì?", "MEDICATION_SAFETY_PROFILE",
         ["warfarin"], "DĐVN V Trang 1080 & Hướng dẫn Bộ Y tế",
         ["Thuốc đối kháng Vitamin K1 Phytomenadion", "Truyền huyết tương tươi đông lạnh FFP hoặc phức hợp prothrombin PCC", "Theo dõi chỉ số INR"],
         ["Thuốc giải độc đặc hiệu: Vitamin K1 (Phytomenadion)", "Trong trường hợp xuất huyết nặng đe dọa tính mạng: truyền Phức hợp Prothrombin cô đặc (PCC) hoặc Huyết tương tươi đông lạnh (FFP)"])

add_case(112, "adverse_effects_and_toxicity", "Dấu hiệu cảnh báo nhiễm toan acid lactic do Metformin?", "MEDICATION_SAFETY_PROFILE",
         ["metformin"], "DĐVN V Trang 955",
         ["Triệu chứng thở nhanh sâu Kussmaul", "Đau bụng dữ dội nôn ói mệt mỏi hạ thân nhiệt", "Xử trí lọc máu thẩm phân phúc mạc"],
         ["Thở nhanh sâu (kiểu thở Kussmaul), đau bụng dữ dội, nôn mửa, yếu cơ mệt lả, hạ thân nhiệt và tụt huyết áp", "Tỷ lệ tử vong lên tới 50%", "Cần ngừng thuốc ngay và lọc máu cấp cứu"])

add_case(113, "adverse_effects_and_toxicity", "Dấu hiệu nhận biết tiêu cơ vân cấp (Rhabdomyolysis) do Statin?", "MEDICATION_SAFETY_PROFILE",
         ["statin", "atorvastatin"], "DĐVN V Trang 190",
         ["Đau nhức cơ bắp dữ dội yếu cơ", "Nước tiểu màu đỏ sẫm hoặc nâu đen như nước vối", "Xét nghiệm men CK tăng gấp 10 lần"],
         ["Đau cơ dữ dội, yếu cơ tiến triển, nước tiểu màu đỏ sẫm hoặc nâu đen (màu nước vối do myoglobin niệu)", "Xét nghiệm men Creatine Kinase (CK) tăng vọt trên 10 lần giới hạn trên bình thường"])

add_case(114, "adverse_effects_and_toxicity", "Hội chứng Red Man Syndrome do Vancomycin nguyên nhân và cách xử trí?", "MEDICATION_SAFETY_PROFILE",
         ["vancomycin"], "DĐVN V Trang 1300",
         ["Truyền Vancomycin quá nhanh kích thích giải phóng Histamin", "Đỏ bừng mặt cổ ngực trên tụt huyết áp", "Xử trí giảm tốc độ truyền và dùng kháng Histamin"],
         ["Do truyền tĩnh mạch Vancomycin quá nhanh làm giải phóng ồ ạt Histamin", "Triệu chứng: đỏ bừng mặt, cổ, ngực trên, ngứa, tụt huyết áp", "Xử trí: Tạm ngừng truyền, dùng thuốc kháng histamin, sau đó truyền lại với tốc độ chậm (ít nhất 60 - 120 phút/gam)"])

add_case(115, "adverse_effects_and_toxicity", "Tác dụng phụ đặc trưng của kháng sinh nhóm Aminoglycosid?", "MEDICATION_SAFETY_PROFILE",
         ["gentamicin", "amikacin"], "DĐVN V Trang 710",
         ["Độc tính trên ốc tai tiền đình gây điếc không hồi phục", "Độc tính trên thận hoại tử ống thận cấp", "Giám sát nồng độ thuốc và chức năng thận"],
         ["Độc tính trên thính giác và tiền đình (ù tai, chóng mặt, mất thính lực không hồi phục)", "Độc tính trên thận (hoại tử ống thận cấp, thường có hồi phục)", "Liệt cơ khi dùng cùng thuốc giãn cơ"])

add_case(116, "adverse_effects_and_toxicity", "Tại sao thuốc ức chế men chuyển ACEI gây ho khan và phù mạch Quincke?", "MEDICATION_SAFETY_PROFILE",
         ["enalapril", "coversyl"], "DĐVN V Trang 570",
         ["Ức chế giáng hóa Bradykinin và chất P", "Phù mạch Quincke phù nề thanh quản tắc đường thở", "Đổi sang nhóm ARB đối kháng thụ thể Angiotensin"],
         ["Do ức chế enzym giáng hóa làm tích lũy Bradykinin và chất P ở đường hô hấp", "Gây ho khan dai dẳng không đáp ứng thuốc ho", "Phù mạch phù nề môi lưỡi thanh môn đe dọa ngạt thở", "Xử trí: Ngừng thuốc vĩnh viễn, chuyển sang ARB"])

add_case(117, "adverse_effects_and_toxicity", "Nguy cơ suy vỏ thượng thận cấp do ngừng Corticoid đột ngột?", "MEDICATION_SAFETY_PROFILE",
         ["medrol", "prednisolon"], "DĐVN V Trang 970 & Hướng dẫn Nội tiết",
         ["Ức chế trục dưới đồi tuyến yên thượng thận HPA", "Triệu chứng tụt huyết áp trụy mạch suy nhược", "Quy tắc giảm liều từ từ Corticoid"],
         ["Dùng Corticoid kéo dài gây teo vỏ thượng thận do ức chế trục HPA", "Ngừng thuốc đột ngột gây suy thượng thận cấp (tụt huyết áp, trụy mạch, sốt, đau bụng, tử vong)", "Bắt buộc phải giảm liều từ từ (tapering) trước khi dừng hẳn"])

add_case(118, "adverse_effects_and_toxicity", "Thuốc ức chế SGLT2 (Jardiance, Forxiga) có nguy cơ nhiễm toan ceton eDKA thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["jardiance", "forxiga"], "Khuyến cáo Cục QLD & ADA",
         ["Nhiễm toan ceton với mức đường huyết bình thường hoặc tăng nhẹ eDKA", "Xét nghiệm ceton máu ceton niệu", "Tạm ngừng thuốc trước phẫu thuật 3 ngày"],
         ["Gây nhiễm toan ceton đái tháo đường với đường huyết bình thường hoặc tăng không nhiều (Euglycemic DKA)", "Triệu chứng: buồn nôn, mệt lả, thở nhanh, đau bụng", "Phải tạm ngừng thuốc ít nhất 3 ngày trước đại phẫu hoặc khi có bệnh cấp tính nặng"])

add_case(119, "adverse_effects_and_toxicity", "Cảnh báo đứt gân gót Achilles do kháng sinh Quinolone?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin", "levofloxacin"], "DĐVN V Trang 400 & FDA Black Box",
         ["Viêm gân và đứt gân gót Achilles", "Nguy cơ cao ở người già dùng cùng Corticoid", "Ngừng ngay kháng sinh khi đau gân"],
         ["CẢNH BÁO ĐỎ: Fluoroquinolone có thể gây viêm gân và đứt gân (thường gặp nhất là gân gót Achilles)", "Nguy cơ tăng cao ở người trên 60 tuổi, bệnh nhân ghép tạng hoặc dùng đồng thời Corticoid", "Phải ngừng thuốc ngay lập tức nếu xuất hiện đau hoặc sưng gân"])

add_case(120, "adverse_effects_and_toxicity", "Tác dụng phụ loét thủng dạ dày của NSAIDs và cách phòng ngừa?", "MEDICATION_SAFETY_PROFILE",
         ["ibuprofen", "aspirin"], "DĐVN V Trang 790",
         ["Ức chế enzym COX-1 giảm tổng hợp Prostaglandin bảo vệ niêm mạc", "Xuất huyết tiêu hóa loét thủng dạ dày", "Dự phòng bằng thuốc ức chế bơm proton PPI"],
         ["Do ức chế COX-1 làm giảm tổng hợp Prostaglandin bảo vệ niêm mạc dạ dày và tác dụng kích ứng tại chỗ", "Gây viêm trợt, loét và xuất huyết tiêu hóa", "Phòng ngừa: Uống sau bữa ăn no, phối hợp thuốc ức chế bơm proton (PPI) ở bệnh nhân có nguy cơ cao"])

add_case(121, "adverse_effects_and_toxicity", "Tác dụng phụ phì đại lợi và thất điều của Phenytoin?", "MEDICATION_SAFETY_PROFILE",
         ["phenytoin"], "DĐVN V Trang 1090",
         ["Phì đại lợi nướu răng", "Rung giật nhãn cầu mất điều hòa thất điều", "Vệ sinh răng miệng và định lượng nồng độ thuốc"],
         ["Dùng kéo dài gây quá sản phì đại nướu răng (lợi)", "Ở nồng độ cao gây độc thần kinh: rung giật nhãn cầu, thất điều dáng đi loạng choạng, lú lẫn"])

add_case(122, "adverse_effects_and_toxicity", "Ngộ độc thuốc tê toàn thân LAST và phác đồ cấp cứu bằng Lipid 20%?", "MEDICATION_SAFETY_PROFILE",
         ["lidocain", "bupivacain"], "Quyết định 361/QĐ-BYT & ASRA",
         ["Hội chứng ngộ độc thuốc tê toàn thân LAST", "Dấu hiệu vị kim loại tê quanh miệng co giật tụt huyết áp ngừng tim", "Nhũ dịch Lipid 20% tiêm tĩnh mạch"],
         ["LAST (Local Anesthetic Systemic Toxicity): Vị kim loại trong miệng, tê quanh miệng, co giật, trụy tim mạch, ngừng tuần hoàn", "Thuốc giải độc đặc hiệu: Nhũ dịch Lipid 20% (Intralipid) tiêm tĩnh mạch nạp 1.5 ml/kg và truyền duy trì"])

add_case(123, "adverse_effects_and_toxicity", "Hội chứng ngoại tháp và Hội chứng an thần kinh ác tính NMS do Haloperidol?", "MEDICATION_SAFETY_PROFILE",
         ["haloperidol"], "DĐVN V Trang 750",
         ["Hội chứng ngoại tháp cứng cơ run vẹo cổ", "Hội chứng an thần kinh ác tính NMS sốt cao cứng đơ tăng CK", "Xử trí Dantrolene Bromocriptine"],
         ["Ngoại tháp: Loạn trương lực cơ cấp, bồn chồn bất an (akathisia), run kiểu Parkinson", "NMS (Neuroleptic Malignant Syndrome): Sốt cao dữ dội, cứng đơ cơ kiểu ống chì, tăng vọt men CK, rối loạn thần kinh thực vật đe dọa tính mạng"])

add_case(124, "adverse_effects_and_toxicity", "Sốt cao ác tính (Malignant Hyperthermia) do Succinylcholine xử trí thuốc gì?", "MEDICATION_SAFETY_PROFILE",
         ["succinylcholine"], "DĐVN V & Hướng dẫn Gây mê Hồi sức",
         ["Đột biến gen thụ thể Ryanodine RyR1", "Sốt cao co cứng cơ toan chuyển hóa", "Thuốc giải độc đặc hiệu Dantrolene"],
         ["Cơn sốt cao ác tính co cứng cơ toàn thân và toan chuyển hóa nặng do thuốc giãn cơ khử cực hoặc thuốc mê bốc hơi", "Thuốc điều trị đặc hiệu duy nhất: Dantrolene natri tiêm tĩnh mạch"])

add_case(125, "adverse_effects_and_toxicity", "Độc tính trên tim của thuốc chống ung thư Doxorubicin?", "MEDICATION_SAFETY_PROFILE",
         ["doxorubicin"], "DĐVN V Trang 540",
         ["Độc tính trên cơ tim phụ thuộc liều tích lũy", "Suy tim ứ huyết sung huyết", "Thuốc bảo vệ tim Dexrazoxane"],
         ["Độc tính trên tim phụ thuộc vào tổng liều tích lũy (thường khi vượt quá 450 - 550 mg/m2)", "Gây bệnh cơ tim giãn và suy tim ứ huyết không hồi phục", "Cần siêu âm tim theo dõi phân suất tống máu EF và có thể dùng Dexrazoxane bảo vệ tim"])

add_case(126, "adverse_effects_and_toxicity", "Hội chứng Stevens-Johnson (SJS/TEN) do Carbamazepine hoặc Allopurinol?", "MEDICATION_SAFETY_PROFILE",
         ["carbamazepine", "allopurinol"], "DĐVN V & Hướng dẫn Dị ứng Miễn dịch",
         ["Hoại tử thượng bì nhiễm độc bong tróc da niêm mạc", "Tổn thương mắt miệng sinh dục sốt", "Xét nghiệm gen HLA-B*1502 hoặc HLA-B*5801"],
         ["Phản ứng dị ứng chậm nghiêm trọng gây loét hoại tử niêm mạc và bong trợt da diện rộng", "Cần ngừng thuốc ngay lập tức, điều trị tại phòng bỏng/ICU", "Khuyến cáo sàng lọc gen HLA-B*1502 (Carbamazepine) hoặc HLA-B*5801 (Allopurinol) trước điều trị"])

add_case(127, "adverse_effects_and_toxicity", "Tác dụng phụ hạ đường huyết cấp của Insulin và cách xử trí?", "MEDICATION_SAFETY_PROFILE",
         ["insulin"], "DĐVN V Trang 810",
         ["Triệu chứng vã mồ hôi run tay đói cồn cào tim đập nhanh lú lẫn", "Xử trí quy tắc 15-15 uống nước đường", "Tiêm tĩnh mạch Glucose 20 - 30% khi hôn mê"],
         ["Vã mồ hôi, run rẩy, tim đập nhanh, đói cồn cào, lú lẫn, hôn mê co giật", "Nếu còn tỉnh: áp dụng quy tắc 15-15 (uống 15g đường nhanh)", "Nếu hôn mê: Tiêm tĩnh mạch 40 - 50 ml dung dịch Glucose 20% hoặc 30%"])

add_case(128, "adverse_effects_and_toxicity", "Độc tính trên phổi của Bleomycin?", "MEDICATION_SAFETY_PROFILE",
         ["bleomycin"], "DĐVN V Trang 260",
         ["Xơ phổi tiến triển phụ thuộc liều tích lũy", "Ho khan khó thở sốt", "Không dùng nồng độ oxy quá cao FiO2"],
         ["Gây viêm phổi kẽ và xơ hóa phổi phụ thuộc liều tích lũy (nguy cơ cao khi tổng liều > 400 đơn vị)", "Tránh cho thở nồng độ oxy quá cao (FiO2 cao) vì oxy làm gia tăng độc tính phổi"])

add_case(129, "adverse_effects_and_toxicity", "Ngộ độc thuốc nhỏ mũi Naphazoline (Co mạch) ở trẻ nhỏ?", "MEDICATION_SAFETY_PROFILE",
         ["naphazoline"], "DĐVN V Trang 1005 & Cảnh báo Cục QLD",
         ["Chống chỉ định Naphazoline cho trẻ dưới 6 tuổi", "Hạ thân nhiệt chậm nhịp tim ức chế thần kinh trung ương hôn mê", "Thở oxy và hồi sức"],
         ["CHỐNG CHỈ ĐỊNH CHO TRẺ DƯỚI 6 TUỔI", "Thuốc ngấm toàn thân gây hạ thân nhiệt nặng, nhịp tim chậm, ức chế hô hấp, ngủ gà và hôn mê sâu", "Chỉ dùng nước muối sinh lý 0.9% rửa mũi cho trẻ nhỏ"])

add_case(130, "adverse_effects_and_toxicity", "Quá liều Aspirin (Ngộ độc Salicylate) xử trí kiềm hóa nước tiểu thế nào?", "MEDICATION_SAFETY_PROFILE",
         ["aspirin"], "DĐVN V Trang 175 & Phác đồ Chống độc",
         ["Thở nhanh toan chuyển hóa kèm kiềm hô hấp ù tai", "Kiềm hóa nước tiểu bằng Natri hydrocarbonat 1.4%", "Chỉ định lọc máu cấp cứu"],
         ["Ù tai, thở nhanh sâu, toan chuyển hóa kèm kiềm hô hấp", "Xử trí: Truyền Natri hydrocarbonat (NaHCO3) để kiềm hóa nước tiểu (duy trì pH nước tiểu 7.5 - 8.5) giúp tăng thải trừ Salicylate qua thận", "Lọc máu cấp cứu nếu nồng độ ngộ độc nặng"])

add_case(131, "adverse_effects_and_toxicity", "Tác dụng phụ độc tính trên thận và thính giác của Cisplatin?", "MEDICATION_SAFETY_PROFILE",
         ["cisplatin"], "DĐVN V Trang 415",
         ["Độc thận hoại tử ống thận cấp", "Mất thính lực tần số cao", "Bù dịch tích cực trước và sau truyền Cisplatin"],
         ["Hoại tử ống thận cấp gây suy thận và tổn thương ốc tai gây điếc tần số cao", "Dự phòng: Bắt buộc truyền dịch bù nước tích cực (Hydration) tối thiểu 2 - 3 lít trước và sau khi truyền Cisplatin kèm lợi tiểu"])

add_case(132, "adverse_effects_and_toxicity", "Tác dụng phụ viêm tụy cấp và suy gan tối cấp của Natri Valproate (Depakine)?", "MEDICATION_SAFETY_PROFILE",
         ["valproate", "depakine"], "DĐVN V Trang 1310 & Black Box Warning",
         ["Viêm tụy cấp đau bụng dữ dội nôn ói tăng men Amylase Lipase", "Độc tính gan gây tử vong ở trẻ dưới 2 tuổi", "Theo dõi chức năng gan định kỳ"],
         ["CẢNH BÁO ĐỎ: Viêm tụy cấp xuất huyết hoại tử nguy cơ tử vong cao", "Độc tính gan tối cấp thường gặp ở trẻ dưới 2 tuổi có rối loạn ty thể", "Cần ngừng thuốc ngay nếu có đau bụng nôn mửa hoặc vàng da"])

add_case(133, "adverse_effects_and_toxicity", "Hội chứng ngộ độc kháng Cholinergic do Atropin quá liều và thuốc giải độc?", "MEDICATION_SAFETY_PROFILE",
         ["atropin"], "DĐVN V Trang 210",
         ["Khô miệng mắt đỏ da khô nóng giãn đồng tử cuồng sảng", "Thuốc giải độc Physostigmine", "Hồi sức tim mạch làm mát cơ thể"],
         ["Triệu chứng: Mù như dơi (giãn đồng tử), nóng như lò nung (sốt cao), khô như xương (khô miệng, da khô), đỏ như củ cải (da đỏ bừng), điên như thợ làm mũ (kích động, ảo giác, mê sảng)", "Thuốc giải độc: Physostigmine"])

add_case(134, "adverse_effects_and_toxicity", "Tác dụng phụ ức chế tủy xương của Methotrexate và thuốc giải cứu Leucovorin?", "MEDICATION_SAFETY_PROFILE",
         ["methotrexate"], "DĐVN V Trang 960",
         ["Suy tủy giảm bạch cầu tiểu cầu nhiễm trùng xuất huyết", "Thuốc giải cứu Leucovorin Acid Folinic", "Kiềm hóa nước tiểu"],
         ["Ức chế tủy xương nặng gây giảm bạch cầu hạt, giảm tiểu cầu và thiếu máu", "Giải cứu tế bào lành bằng Leucovorin (Acid folinic) đúng thời điểm sau liều Methotrexate cao", "Bổ sung Acid folic trong điều trị viêm khớp"])

add_case(135, "adverse_effects_and_toxicity", "Dấu hiệu quá liều Theophylline và cách xử trí khẩn cấp?", "MEDICATION_SAFETY_PROFILE",
         ["theophylline"], "DĐVN V Trang 1270",
         ["Nôn mửa dữ dội loạn nhịp tim co giật kháng trị", "Rửa dạ dày than hoạt tính liều lặp lại", "Lọc máu ngắt quãng"],
         ["Khoảng điều trị hẹp (10 - 20 mcg/ml)", "Dấu hiệu quá liều: Buồn nôn, nôn liên tục, nhịp nhanh xoang, loạn nhịp thất, hạ kali máu, co giật kháng trị", "Xử trí: Uống than hoạt liều lặp lại (MDAC) hoặc lọc máu"])

# ==============================================================================
# NHÓM 5: ĐỐI TƯỢNG ĐẶC BIỆT: THAI KỲ, CHO CON BÚ, TRẺ EM, NGƯỜI CAO TUỔI (30 CÂU)
# ==============================================================================
add_case(136, "special_populations", "Paracetamol dùng cho phụ nữ có thai có an toàn không?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V & Hướng dẫn Sản khoa Bộ Y tế",
         ["Thuốc giảm đau hạ sốt lựa chọn hàng đầu cho thai phụ", "Dùng liều thấp nhất có hiệu quả trong thời gian ngắn nhất", "Tránh tự ý dùng kéo dài"],
         ["Paracetamol là thuốc giảm đau, hạ sốt được lựa chọn hàng đầu và an toàn nhất trong suốt thai kỳ khi dùng đúng liều", "Khuyến cáo dùng liều thấp nhất có hiệu quả và trong thời gian ngắn nhất cần thiết"])

add_case(137, "special_populations", "Ibuprofen có dùng được trong 3 tháng cuối thai kỳ không?", "MEDICATION_SAFETY_PROFILE",
         ["ibuprofen"], "DĐVN V Trang 790 & FDA Warning",
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI từ tuần 20 hoặc 3 tháng cuối thai kỳ", "Nguy cơ đóng sớm ống động mạch thai nhi", "Gây thiểu ối và kéo dài chuyển dạ"],
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI trong 3 tháng cuối thai kỳ (từ tuần 20 trở đi)", "Nguy cơ đóng sớm ống động mạch của thai nhi dẫn đến tăng áp động mạch phổi sơ sinh", "Gây suy thận thai nhi, thiểu ối và kéo dài thời gian chuyển dạ"])

add_case(138, "special_populations", "Kháng sinh nhóm Penicillin và Cephalosporin có an toàn cho phụ nữ mang thai không?", "MEDICATION_SAFETY_PROFILE",
         ["amoxicillin", "ceftriaxon"], "DĐVN V & Phác đồ Bộ Y tế",
         ["Nhóm kháng sinh an toàn phân loại thai kỳ B", "Không gây quái thai dị tật", "Kiểm tra tiền sử dị ứng"],
         ["Amoxicillin, Ampicillin và các Cephalosporin (Cefalexin, Cefuroxim, Ceftriaxon) được coi là an toàn và là lựa chọn ưu tiên điều trị nhiễm khuẩn cho phụ nữ mang thai", "Chưa ghi nhận bằng chứng gây quái thai"])

add_case(139, "special_populations", "Tại sao kháng sinh nhóm Tetracycline chống chỉ định cho phụ nữ có thai và trẻ dưới 8 tuổi?", "MEDICATION_SAFETY_PROFILE",
         ["doxycycline", "tetracycline"], "DĐVN V Trang 550",
         ["Thuốc gắn kết với Canxi tạo phức chelat ở xương và mầm răng", "Gây đổi màu răng vĩnh viễn màu vàng xám", "Kém phát triển xương thai nhi và trẻ nhỏ"],
         ["CHỐNG CHỈ ĐỊNH: Thuốc tích lũy vào xương và mầm răng đang phát triển của thai nhi và trẻ nhỏ", "Gây biến màu răng vĩnh viễn (răng màu vàng xám hoặc nâu), khiếm khuyết men răng và ức chế phát triển xương"])

add_case(140, "special_populations", "Thuốc hạ huyết áp nào an toàn nhất cho phụ nữ mang thai?", "MEDICATION_SAFETY_PROFILE",
         ["methyldopa", "labetalol", "nifedipine"], "Hướng dẫn Điều trị Tiền sản giật Bộ Y tế & DĐVN V",
         ["Methyldopa lựa chọn kinh điển an toàn thai kỳ", "Labetalol chẹn alpha và beta", "Nifedipine dạng phóng thích chậm"],
         ["Các thuốc lựa chọn hàng đầu an toàn: Methyldopa, Labetalol, Nifedipine (dạng phóng thích kéo dài)", "Hydralazine dùng trong cơn tăng huyết áp cấp cứu"])

add_case(141, "special_populations", "Tại sao thuốc ức chế men chuyển ACEI và chẹn thụ thể ARB chống chỉ định trong thai kỳ?", "MEDICATION_SAFETY_PROFILE",
         ["enalapril", "losartan"], "DĐVN V & FDA Black Box",
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI đặc biệt trong quý 2 và quý 3 thai kỳ", "Gây suy thận thai nhi thiểu ối biến dạng sọ mặt", "Nguy cơ thai chết lưu"],
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI (Phân loại X trong quý 2 và 3)", "Gây độc tính nghiêm trọng cho thai nhi: Suy thận thai nhi, thiểu ối, giảm sản xương sọ, hạ huyết áp sơ sinh và tử vong thai nhi"])

add_case(142, "special_populations", "Warfarin có dùng được cho phụ nữ có thai không?", "MEDICATION_SAFETY_PROFILE",
         ["warfarin"], "DĐVN V & Hướng dẫn Sản khoa",
         ["Hội chứng dị tật thai nhi Warfarin embryopathy", "Chống chỉ định trong 3 tháng đầu thai kỳ", "Chuyển sang Heparin trọng lượng phân tử thấp LMWH"],
         ["CHỐNG CHỈ ĐỊNH trong 3 tháng đầu thai kỳ (gây Hội chứng dị tật Warfarin: thiểu sản mũi, bất thường xương, chậm phát triển) và gần ngày sinh (xuất huyết nặng)", "Thay thế an toàn bằng Heparin trọng lượng phân tử thấp (LMWH)"])

add_case(143, "special_populations", "Heparin trọng lượng phân tử thấp (Enoxaparin) có qua được nhau thai không?", "MEDICATION_SAFETY_PROFILE",
         ["enoxaparin"], "DĐVN V Trang 580",
         ["Enoxaparin không qua được hàng rào nhau thai", "Thuốc chống đông lựa chọn hàng đầu trong thai kỳ", "Ngừng thuốc trước khi chuyển dạ hoặc gây tê tủy sống"],
         ["Enoxaparin không qua được hàng rào nhau thai", "Là thuốc chống đông được lựa chọn hàng đầu để dự phòng và điều trị huyết khối trong thai kỳ", "Phải tạm ngừng trước khi sinh hoặc gây tê tủy sống/ngoài màng cứng ít nhất 12 - 24 giờ"])

add_case(144, "special_populations", "Paracetamol có an toàn cho phụ nữ đang cho con bú không?", "MEDICATION_SAFETY_PROFILE",
         ["paracetamol"], "DĐVN V & Khuyến cáo WHO",
         ["Paracetamol bài tiết vào sữa mẹ với lượng rất nhỏ", "Thuốc giảm đau hạ sốt tương thích an toàn khi cho con bú", "Theo dõi trẻ"],
         ["Paracetamol bài tiết vào sữa mẹ với lượng rất nhỏ (dưới 1 - 2% liều của mẹ)", "Được coi là an toàn và tương thích tốt với việc nuôi con bằng sữa mẹ"])

add_case(145, "special_populations", "Tại sao thuốc giảm đau Codein chống chỉ định ở phụ nữ đang cho con bú?", "MEDICATION_SAFETY_PROFILE",
         ["codein"], "DĐVN V & Cảnh báo FDA/EMA/BYT",
         ["Mẹ có kiểu hình chuyển hóa siêu nhanh qua enzym CYP2D6", "Nồng độ Morphin trong sữa mẹ tăng vọt gây tử vong trẻ bú mẹ", "Chống chỉ định tuyệt đối Codein khi cho con bú"],
         ["CHỐNG CHỈ ĐỊNH: Nếu người mẹ có kiểu gen chuyển hóa siêu nhanh qua CYP2D6, Codein sẽ chuyển hóa ồ ạt thành Morphin", "Morphin bài tiết nồng độ cao vào sữa mẹ gây ngộ độc opioid, suy hô hấp và tử vong ở trẻ bú mẹ"])

add_case(146, "special_populations", "Thuốc kháng histamin nào ưu tiên dùng cho phụ nữ cho con bú?", "MEDICATION_SAFETY_PROFILE",
         ["loratadin", "cetirizin"], "DĐVN V & Hướng dẫn Dị ứng",
         ["Kháng Histamin H1 thế hệ 2 không gây buồn ngủ Loratadin Cetirizin", "Tránh thế hệ 1 Clorpheniramin gây an thần ức chế tiết sữa", "Theo dõi dấu hiệu buồn ngủ ở trẻ"],
         ["Ưu tiên thuốc kháng Histamin thế hệ 2: Loratadin hoặc Cetirizin", "Thuốc ít bài tiết vào sữa và không gây tác dụng an thần buồn ngủ cho trẻ", "Tránh dùng thế hệ 1 (như Clorpheniramin) vì gây ngủ gà và giảm tiết sữa mẹ"])

add_case(147, "special_populations", "Người thiếu men G6PD (G6PD deficiency) cần tránh những thuốc hạ sốt giảm đau nào?", "MEDICATION_SAFETY_PROFILE",
         ["g6pd", "aspirin"], "DĐVN V & Hướng dẫn Huyết học",
         ["Tránh Aspirin liều cao các thuốc nhóm Sulfamid Cotrimoxazole Dapsone", "Nguy cơ tan máu cấp tính đái ra huyết sắc tố", "Paracetamol liều điều trị an toàn"],
         ["Cần tránh tuyệt đối hoặc rất thận trọng: Aspirin liều cao, Cotrimoxazole, Dapsone, Nitrofurantoin, Cloramphenicol, Primaquine", "Gây cơn tan máu cấp, thiếu máu tan máu và vàng da", "Paracetamol ở liều điều trị thông thường là an toàn"])

add_case(148, "special_populations", "Tiêu chuẩn Beers (Beers Criteria) cảnh báo những nhóm thuốc nào ở người cao tuổi?", "MEDICATION_SAFETY_PROFILE",
         ["beers", "người cao tuổi"], "Tiêu chuẩn Beers AGS & Bộ Y tế",
         ["Benzodiazepin an thần nguy cơ té ngã lú lẫn", "Kháng cholinergic khô miệng táo bón sa sút trí tuệ", "NSAIDs nguy cơ xuất huyết tiêu hóa suy thận tim mạch"],
         ["Thuốc an thần gây ngủ Benzodiazepin (tăng nguy cơ té ngã, gãy xương, lú lẫn)", "Thuốc có hoạt tính kháng Cholinergic mạnh (bí tiểu, táo bón, suy giảm nhận thức)", "NSAIDs kéo dài (suy thận, tăng huyết áp, xuất huyết tiêu hóa)", "Sulfonylurea tác dụng kéo dài Glibenclamide (hạ đường huyết nặng)"])

add_case(149, "special_populations", "Digoxin dùng cho người cao tuổi cần lưu ý những nguy cơ gì?", "MEDICATION_SAFETY_PROFILE",
         ["digoxin"], "DĐVN V & Lão khoa Lâm sàng",
         ["Chức năng thận giảm theo tuổi làm giảm thải trừ Digoxin", "Khối lượng cơ giảm làm giảm thể tích phân bố", "Nguy cơ ngộ độc Digoxin ở liều thông thường"],
         ["Người cao tuổi có chức năng lọc cầu thận giảm sinh lý và khối lượng cơ giảm", "Digoxin dễ tích lũy gây ngộ độc dù ở liều bình thường", "Cần giảm liều (thường <= 0.125 mg/ngày) và theo dõi sát nồng độ thuốc"])

add_case(150, "special_populations", "Kháng sinh nhóm Fluoroquinolone có dùng được cho trẻ em không?", "MEDICATION_SAFETY_PROFILE",
         ["ciprofloxacin"], "DĐVN V & Hướng dẫn Nhi khoa",
         ["Không dùng thường quy cho trẻ dưới 18 tuổi", "Nguy cơ tổn thương sụn khớp ở các khớp chịu lực", "Chỉ dùng trong nhiễm khuẩn nặng kháng thuốc"],
         ["CHỐNG CHỈ ĐỊNH THƯỜNG QUY cho trẻ dưới 18 tuổi", "Nguy cơ gây bệnh lý khớp thoái hóa và tổn thương sụn tiếp hợp ở các khớp chịu trọng lực trên động vật thực nghiệm", "Chỉ sử dụng khi không có kháng sinh thay thế an toàn"])

add_case(151, "special_populations", "Bổ sung Sắt và Acid Folic cho phụ nữ có thai theo khuyến cáo Bộ Y tế?", "MEDICATION_SAFETY_PROFILE",
         ["sắt", "acid folic"], "Hướng dẫn Chăm sóc Trước sinh Bộ Y tế",
         ["Liều Sắt nguyên tố 30 - 60mg/ngày", "Liều Acid Folic 400 mcg/ngày", "Dự phòng dị tật ống thần kinh nứt đốt sống thai nhi"],
         ["Khuyến cáo bổ sung hàng ngày: 30 - 60 mg sắt nguyên tố và 400 mcg acid folic", "Nên uống từ trước khi mang thai ít nhất 1 tháng và duy trì suốt thai kỳ đến sau sinh 1 tháng để phòng dị tật ống thần kinh"])

add_case(152, "special_populations", "Vắc xin uốn ván (VAT) tiêm cho phụ nữ mang thai vào thời điểm nào?", "MEDICATION_SAFETY_PROFILE",
         ["uốn ván", "vat"], "Thông tư hướng dẫn Tiêm chủng Bộ Y tế",
         ["Lịch tiêm 2 mũi VAT cho thai phụ mang thai lần đầu", "Mũi 1 từ tuần 20 trở đi", "Mũi 2 cách mũi 1 tối thiểu 1 tháng và trước sinh ít nhất 1 tháng"],
         ["Mang thai lần đầu tiêm 2 mũi: Mũi 1 tiêm càng sớm càng tốt từ quý 2 thai kỳ (sau tuần 20), Mũi 2 tiêm cách mũi 1 ít nhất 30 ngày và trước ngày dự sinh tối thiểu 1 tháng"])

add_case(153, "special_populations", "Thuốc chống co giật nào tuyệt đối tránh dùng trong thai kỳ do nguy cơ dị tật cao?", "MEDICATION_SAFETY_PROFILE",
         ["valproate", "depakine"], "DĐVN V & FDA Warning",
         ["Natri Valproate gây dị tật nứt đốt sống khuyết tật ống thần kinh", "Giảm chỉ số IQ của trẻ sau sinh", "Thay thế bằng Lamotrigine hoặc Levetiracetam"],
         ["CHỐNG CHỈ ĐỊNH: Natri Valproate (Depakine) có nguy cơ gây quái thai cao nhất trong các thuốc chống động kinh", "Gây dị tật ống thần kinh (nứt đốt sống), dị tật tim mặt, giảm chỉ số IQ và rối loạn phổ tự kỷ ở trẻ"])

add_case(154, "special_populations", "Magie sulfat dùng trong sản khoa chỉ định và liều phòng co giật tiền sản giật?", "MEDICATION_SAFETY_PROFILE",
         ["magie sulfat"], "Hướng dẫn Sản khoa Bộ Y tế & DĐVN V",
         ["Dự phòng và cắt cơn co giật sản giật", "Liều tấn công 4g truyền tĩnh mạch trong 15 - 20 phút", "Theo dõi phản xạ gân xương bánh chè nhịp thở và lượng nước tiểu"],
         ["Chỉ định hàng đầu để dự phòng và điều trị co giật trong tiền sản giật nặng và sản giật", "Liều tấn công: 4g Magie sulfat truyền tĩnh mạch chậm trong 15 - 20 phút, sau đó duy trì 1g/giờ", "Giám sát: Phản xạ gân xương bánh chè, nhịp thở (>16 lần/phút) và nước tiểu (>30ml/giờ)"])

add_case(155, "special_populations", "Thuốc chống nôn nào an toàn cho phụ nữ ốm nghén 3 tháng đầu thai kỳ?", "MEDICATION_SAFETY_PROFILE",
         ["vitamin b6", "metoclopramide"], "ACOG & Hướng dẫn Sản khoa Bộ Y tế",
         ["Lựa chọn ban đầu kết hợp Vitamin B6 Pyridoxine và Doxylamine", "Metoclopramide dùng khi nôn nhiều", "Tránh mất nước điện giải"],
         ["Lựa chọn bước đầu: Vitamin B6 (Pyridoxine) đơn độc hoặc phối hợp Doxylamine", "Nếu không đáp ứng có thể dùng thêm Metoclopramide hoặc Dimenhydrinat", "Bù nước và điện giải kịp thời"])

add_case(156, "special_populations", "Thuốc kháng nấm Clotrimazole dạng viên đặt âm đạo có an toàn cho thai phụ không?", "MEDICATION_SAFETY_PROFILE",
         ["clotrimazole"], "DĐVN V Trang 440",
         ["Clotrimazole đặt âm đạo an toàn trong thai kỳ", "Tránh dùng viên uống Fluconazole trong 3 tháng đầu", "Đặt thuốc cẩn thận không dùng que đẩy"],
         ["Clotrimazole đặt âm đạo là thuốc lựa chọn hàng đầu điều trị nấm Candida âm đạo cho phụ nữ mang thai", "Thuốc hấp thu tại chỗ không đáng kể", "Tránh dùng viên uống Fluconazole toàn thân trong thai kỳ"])

add_case(157, "special_populations", "Thuốc kháng virus Acyclovir dùng cho phụ nữ mang thai bị Zona hoặc Herpes sinh dục?", "MEDICATION_SAFETY_PROFILE",
         ["acyclovir"], "DĐVN V Trang 85",
         ["Acyclovir phân loại an toàn thai kỳ B", "Chỉ định điều trị Herpes sinh dục và Zona thần kinh thai phụ", "Dự phòng lây truyền sang thai nhi khi sinh"],
         ["Acyclovir được sử dụng an toàn trong thai kỳ cho các trường hợp nhiễm Herpes simplex nguyên phát hoặc tái phát và Zona thần kinh nặng", "Giúp giảm nguy cơ lây truyền virus sang trẻ sơ sinh"])

add_case(158, "special_populations", "Metformin có được sử dụng trong điều trị đái tháo đường thai kỳ không?", "MEDICATION_SAFETY_PROFILE",
         ["metformin"], "Hướng dẫn ĐTĐ Thai kỳ Bộ Y tế",
         ["Insulin là tiêu chuẩn vàng điều trị đái tháo đường thai kỳ", "Metformin có thể dùng khi không dung nạp hoặc từ chối tiêm Insulin", "Metformin qua được nhau thai"],
         ["Insulin vẫn là tiêu chuẩn vàng lựa chọn hàng đầu trong thai kỳ", "Metformin có thể được cân nhắc sử dụng như liệu pháp thay thế khi bệnh nhân không dung nạp hoặc không thể sử dụng Insulin"])

add_case(159, "special_populations", "Thuốc chống trầm cảm nhóm SSRI (như Sertraline) trong thai kỳ?", "MEDICATION_SAFETY_PROFILE",
         ["sertraline"], "DĐVN V & Hội Tâm thần học",
         ["Sertraline được đánh giá an toàn tương đối trong nhóm SSRI", "Tránh Paroxetine nguy cơ dị tật tim mạch", "Theo dõi hội chứng cai thuốc sơ sinh"],
         ["Sertraline là một trong những SSRI được ưu tiên lựa chọn do nguy cơ dị tật bẩm sinh thấp nhất", "Tránh dùng Paroxetine vì có liên quan đến dị tật tim bẩm sinh", "Cần theo dõi hội chứng cai sơ sinh sau sinh"])

add_case(160, "special_populations", "Thuốc ho, hạ sốt dạng thảo dược hoặc siro an toàn cho trẻ sơ sinh và trẻ nhỏ?", "MEDICATION_SAFETY_PROFILE",
         ["siro ho", "paracetamol"], "Hướng dẫn Nhi khoa Bộ Y tế",
         ["Siro ho thảo dược cao lá thường xuân mật ong (trẻ > 1 tuổi)", "Tuyệt đối không dùng mật ong cho trẻ dưới 1 tuổi nguy cơ ngộ độc Botulinum", "Không dùng thuốc giảm ho trung ương Dextromethorphan Codein cho trẻ nhỏ"],
         ["Siro thảo dược (như cao lá thường xuân, quất mật ong)", "LƯU Ý QUAN TRỌNG: Tuyệt đối KHÔNG dùng mật ong cho trẻ dưới 1 tuổi do nguy cơ ngộ độc Clostridium botulinum", "Không dùng thuốc ức chế ho trung ương cho trẻ nhỏ"])

add_case(161, "special_populations", "Kháng sinh dùng cho trẻ sơ sinh nhiễm khuẩn huyết: Lưu ý về Aminoglycosid?", "MEDICATION_SAFETY_PROFILE",
         ["gentamicin", "amikacin"], "Hướng dẫn Điều trị Nhi khoa Bộ Y tế",
         ["Chức năng lọc thận trẻ sơ sinh chưa hoàn thiện", "Kéo dài khoảng cách đưa liều 24 - 36 - 48 giờ", "Phối hợp với Ampicillin"],
         ["Trẻ sơ sinh có tỷ lệ nước trong cơ thể cao và chức năng thận chưa hoàn thiện", "Cần dùng liều theo tuổi thai và tuổi sau sinh, kéo dài khoảng cách đưa liều (24h - 36h)", "Thường phối hợp Ampicillin + Gentamicin"])

add_case(162, "special_populations", "Thuốc điều trị trĩ an toàn cho phụ nữ có thai?", "MEDICATION_SAFETY_PROFILE",
         ["daflon"], "Hướng dẫn Tiêu hóa Sản khoa",
         ["Thuốc trợ tĩnh mạch Daflon Diosmin Hesperidin", "Kem bôi mỡ đặt tại chỗ Proctolog", "Chế độ ăn nhiều chất xơ uống đủ nước"],
         ["Daflon (phân đoạn flavonoid vi hạt tinh chế) có thể sử dụng ngắn hạn an toàn trong thai kỳ", "Dùng thuốc mỡ/viên đặt tại chỗ làm dịu", "Ưu tiên điều trị bảo tồn: tăng cường chất xơ, uống nhiều nước phòng táo bón"])

add_case(163, "special_populations", "Nguyên tắc sử dụng thuốc ở người cao tuổi: Bắt đầu liều thấp tăng dần?", "MEDICATION_SAFETY_PROFILE",
         ["người cao tuổi"], "Hướng dẫn Lão khoa Bộ Y tế",
         ["Nguyên tắc Start low, go slow", "Rà soát tương tác thuốc định kỳ", "Hạn chế đa thuốc Polypharmacy"],
         ["Nguyên tắc vàng: Bắt đầu liều thấp và tăng liều chậm rãi (Start low, go slow)", "Khởi đầu thường bằng 1/3 đến 1/2 liều người lớn", "Thường xuyên rà soát bỏ bớt thuốc không cần thiết để tránh đa dược lý"])

add_case(164, "special_populations", "Tại sao Aspirin chống chỉ định ở trẻ em bị nhiễm virus cúm hoặc thủy đậu?", "MEDICATION_SAFETY_PROFILE",
         ["aspirin"], "DĐVN V Trang 175 & Cảnh báo WHO",
         ["Hội chứng Reye suy gan cấp và phù não tử vong", "Chống chỉ định Aspirin hạ sốt cho trẻ dưới 16 tuổi", "Dùng Paracetamol hoặc Ibuprofen thay thế"],
         ["CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI: Nguy cơ gây Hội chứng Reye - một bệnh lý hiếm gặp nhưng cực kỳ nguy kịch đặc trưng bởi thoái hóa mỡ gan cấp tính và phù não tiến triển nhanh dẫn đến tử vong", "Không dùng Aspirin hạ sốt cho trẻ dưới 16 tuổi"])

add_case(165, "special_populations", "Thuốc an thần gây ngủ nào ít gây nguy cơ té ngã nhất ở người cao tuổi?", "MEDICATION_SAFETY_PROFILE",
         ["melatonin"], "Hướng dẫn Lão khoa & Tiêu chuẩn Beers",
         ["Melatonin đồng vận thụ thể melatonin", "Tránh nhóm Benzodiazepin diazepam clonazepam", "Vệ sinh giấc ngủ không dùng thuốc"],
         ["Ưu tiên các biện pháp vệ sinh giấc ngủ không dùng thuốc", "Nếu dùng thuốc: Melatonin hoặc thuốc đồng vận thụ thể melatonin (Ramelteon) được ưu tiên", "Tránh dùng các Benzodiazepin kéo dài do nguy cơ tích lũy gây té ngã và sa sút nhận thức"])

# ==============================================================================
# NHÓM 6: NGHIỆP VỤ BỆNH VIỆN, CẤP CỨU TT 51, KHO DƯỢC FEFO & CPOE (35 CÂU)
# ==============================================================================
add_case(166, "hospital_protocols", "Phác đồ cấp cứu sốc phản vệ theo Thông tư 51/2017/TT-BYT?", "MEDICATION_SAFETY_PROFILE",
         ["adrenalin", "phản vệ"], "Thông tư 51/2017/TT-BYT",
         ["Phân độ phản vệ từ độ 1 đến độ 4", "Adrenalin tiêm bắp là thuốc thiết yếu duy nhất cứu mạng", "Theo dõi mạch huyết áp SpO2 liên tục"],
         ["Adrenalin là thuốc thiết yếu và quan trọng nhất, phải tiêm bắp ngay lập tức khi phát hiện phản vệ từ độ II trở lên", "Liều người lớn 0.5mg (1/2 ống) tiêm bắp đùi", "Tiếp tục theo dõi và nhắc lại mỗi 3 - 5 phút nếu chưa cải thiện"])

add_case(167, "hospital_protocols", "Quy chế quản lý và bảo quản thuốc gây nghiện theo Thông tư 20/2017/TT-BYT?", "MEDICATION_SAFETY_PROFILE",
         ["morphin", "thuốc gây nghiện"], "Thông tư 20/2017/TT-BYT",
         ["Bảo quản trong tủ sắt có khóa chắc chắn", "Phân công người giữ chìa khóa bằng văn bản", "Sổ theo dõi xuất nhập tồn và hủy vỏ ống"],
         ["Phải bảo quản tại kho hoặc tủ riêng, có khóa chắc chắn; người giữ chìa khóa phải là dược sĩ hoặc điều dưỡng được phân công bằng văn bản", "Lập sổ theo dõi xuất nhập tồn riêng biệt, lưu trữ chứng từ tối thiểu 2 năm sau khi thuốc hết hạn"])

add_case(168, "hospital_protocols", "Quy trình hủy vỏ ống thuốc gây nghiện (Morphin, Fentanyl) sau khi tiêm?", "MEDICATION_SAFETY_PROFILE",
         ["morphin", "hủy vỏ"], "Thông tư 20/2017/TT-BYT",
         ["Hội đồng hủy vỏ thuốc có biên bản chứng kiến", "Đập vỡ hoặc tiêu hủy theo quy chế rác thải y tế", "Ký xác nhận vào sổ nợ vỏ thuốc"],
         ["Sau khi tiêm phải thu hồi toàn bộ vỏ ống, bảo quản tại tủ trực", "Định kỳ thành lập hội đồng kiểm đếm hủy vỏ ống có sự chứng kiến của lãnh đạo khoa, dược sĩ và điều dưỡng", "Lập biên bản hủy vỏ lưu hồ sơ"])

add_case(169, "hospital_protocols", "Quản lý và cấp phát thuốc hướng tâm thần (Diazepam, Phenobarbital) theo Thông tư 20?", "MEDICATION_SAFETY_PROFILE",
         ["diazepam", "hướng tâm thần"], "Thông tư 20/2017/TT-BYT",
         ["Tủ thuốc có khóa riêng biệt", "Sổ theo dõi xuất nhập tồn", "Đơn thuốc hướng tâm thần tối đa 10 ngày (hoặc 30 ngày bệnh mạn tính)"],
         ["Bảo quản trong tủ thuốc riêng có khóa", "Theo dõi xuất nhập tồn chi tiết theo từng người bệnh và số lô hạn dùng", "Lưu đơn thuốc và sổ sách tối thiểu 2 năm"])

add_case(170, "hospital_protocols", "Quy tắc xuất kho dược theo hạn dùng FEFO (First Expired, First Out) theo Thông tư 36/2018?", "QUERY_FEFO_EXPIRY",
         ["fefo", "kho dược"], "Thông tư 36/2018/TT-BYT (GSP)",
         ["Thuốc hết hạn trước phải xuất trước FEFO", "Kiểm soát thuốc cận hạn dưới 60 ngày", "Khu vực biệt trữ thuốc chờ hủy"],
         ["FEFO (First Expired, First Out): Thuốc có hạn dùng ngắn hơn phải được xuất trước", "Thực hiện kiểm tra định kỳ thuốc cận hạn (dưới 60 hoặc 90 ngày) để luân chuyển hoặc xử lý ưu tiên"])

add_case(171, "hospital_protocols", "Kiểm tra danh mục thuốc cận hạn dưới 60 ngày trong kho dược nội viện?", "QUERY_FEFO_EXPIRY",
         ["fefo", "cận hạn"], "Thông tư 36/2018/TT-BYT & Quản lý kho dược",
         ["Báo cáo danh sách lô thuốc cận hạn", "Biệt trữ thuốc hết hạn dùng", "Lập kế hoạch điều chuyển thuốc"],
         ["Hệ thống rà soát toàn bộ lô thuốc trong kho nội trú và tủ trực", "Cảnh báo các mặt hàng có hạn dùng dưới 60 ngày để ưu tiên cấp phát hoặc điều chuyển đơn vị khác"])

add_case(172, "hospital_protocols", "Tiêu chuẩn nhiệt độ bảo quản chuỗi lạnh (Cold Chain) vắc xin theo WHO và Thông tư 36?", "CLINICAL_COLD_CHAIN_TELEMETRY",
         ["chuỗi lạnh", "vắc xin"], "Thông tư 36/2018/TT-BYT & WHO PQS",
         ["Nhiệt độ bảo quản chuẩn 2.0°C đến 8.0°C", "Thiết bị ghi nhiệt độ tự động LogTag", "Chỉ số nhiệt độ động học MKT"],
         ["Dải nhiệt độ chuẩn bắt buộc: từ +2.0°C đến +8.0°C", "Theo dõi và ghi nhiệt độ tối thiểu 2 lần/ngày (sáng và chiều) hoặc giám sát liên tục bằng cảm biến IoT tự động"])

add_case(173, "hospital_protocols", "Quy trình xử trí khi tủ lạnh bảo quản vắc xin mất điện hoặc vượt ngưỡng nhiệt độ?", "CLINICAL_COLD_CHAIN_TELEMETRY",
         ["chuỗi lạnh", "sự cố"], "Quy trình GSP Kho dược & WHO",
         ["Không mở cửa tủ lạnh khi mất điện", "Chuyển vắc xin sang phích vắc xin kèm bình tích lạnh", "Biệt trữ và đánh giá cảm quan chỉ thị đông băng"],
         ["Tuyệt đối không mở cửa tủ để duy trì nhiệt độ", "Nếu mất điện kéo dài quá thời gian an toàn: chuyển vắc xin sang hòm lạnh/phích vắc xin có bình tích lạnh đạt chuẩn", "Ghi biên bản sự cố và kiểm tra chỉ thị nhiệt độ đông băng Shake test"])

add_case(174, "hospital_protocols", "Thẩm định đơn thuốc ngoại trú theo Thông tư 26/2025/TT-BYT và Thông tư 52/2017?", "PRESCRIPTION_AUDIT_REPORT",
         ["thẩm định đơn", "tt 26"], "Thông tư 26/2025/TT-BYT & TT 52/2017/TT-BYT",
         ["Kiểm tra tính hợp lệ hành chính của đơn", "Phù hợp chẩn đoán ICD-10", "Rà soát tương tác chống chỉ định và liều dùng"],
         ["Rà soát thể thức hành chính: Tên bệnh nhân, tuổi, cân nặng (trẻ em), mã ICD-10", "Kiểm tra liều lượng, đường dùng, tương tác thuốc chống chỉ định (QĐ 5948) và cảnh báo dị ứng chéo"])

add_case(175, "hospital_protocols", "Thẩm định đơn thuốc nội trú theo Thông tư 52/2017/TT-BYT?", "PRESCRIPTION_AUDIT_REPORT",
         ["đơn nội trú", "tt 52"], "Thông tư 52/2017/TT-BYT",
         ["Kiểm tra y lệnh dùng thuốc hàng ngày", "Rà soát tương tác thuốc đa dược", "Thời điểm dùng thuốc và đường tiêm truyền"],
         ["Kiểm tra y lệnh thuốc trong bệnh án: Phù hợp chẩn đoán và diễn biến bệnh", "Rà soát chỉ định kháng sinh, thời điểm dùng, tốc độ truyền và tương kỵ dung dịch truyền"])

add_case(176, "hospital_protocols", "Kê đơn điện tử CPOE: Cảnh báo tự động tương tác và dị ứng chéo?", "CPOE_CLARIFICATION",
         ["cpoe", "kê đơn"], "Quy chuẩn Bệnh án Điện tử EMR & CDSS",
         ["Cảnh báo CDSS chặn tương tác mức độ 1", "Cảnh báo dị ứng chéo Penicillin Cephalosporin", "Xác nhận ghi đè Override của bác sĩ"],
         ["Hệ thống CDSS tự động chặn các cặp thuốc chống chỉ định mức độ 1 (theo QĐ 5948)", "Cảnh báo dị ứng chéo dựa trên tiền sử dị ứng đã ghi nhận của người bệnh, yêu cầu bác sĩ giải trình nếu bắt buộc ghi đè"])

add_case(177, "hospital_protocols", "Kê đơn thuốc Morphin ngoại trú cho bệnh nhân ung thư tối đa bao nhiêu ngày?", "CPOE_CLARIFICATION",
         ["morphin", "kê đơn"], "Thông tư 20/2017/TT-BYT & TT 52/2017",
         ["Tối đa không quá 30 ngày chia làm 3 đợt", "Kèm theo giấy cam kết sử dụng thuốc gây nghiện", "Bác sĩ có chứng chỉ hành nghề phù hợp"],
         ["Được kê đơn tối đa không quá 30 ngày cho bệnh nhân ung thư hoặc AIDS giai đoạn cuối", "Mỗi đơn thuốc kê không quá 10 ngày (chia làm 3 đợt kê đơn liên tiếp)", "Người bệnh hoặc thân nhân phải ký bản cam kết sử dụng thuốc gây nghiện"])

add_case(178, "hospital_protocols", "Quy trình đối soát sổ kiểm toán (Audit Trail) bất biến bằng chuỗi HMAC-SHA256?", "CLINICAL_SAFE_ABSTENTION",
         ["kiểm toán", "audit"], "Nghị định 130/2018/NĐ-CP & Luật Giao dịch Điện tử",
         ["Bảo đảm tính toàn vẹn dữ liệu y tế", "Chống sửa đổi chối bỏ trách nhiệm", "Liên kết hàm băm mã hóa giữa các bản ghi"],
         ["Mọi thao tác kê đơn, cấp phát, chỉnh sửa dữ liệu đều được ghi log kèm chữ ký số HMAC-SHA256 liên kết chuỗi khối", "Bảo đảm tính toàn vẹn và chống chối bỏ trách nhiệm theo quy định pháp luật"])

add_case(179, "hospital_protocols", "Giao ban ca trực điều dưỡng: Bàn giao tủ thuốc cấp cứu và cơ số thuốc kiểm soát đặc biệt?", "SHIFT_HANDOVER_RECONCILIATION",
         ["giao ban", "tủ trực"], "Thông tư 22/2011/TT-BYT & Quy chế Bệnh viện",
         ["Kiểm kê số lượng thực tế so với sổ sách", "Kiểm tra niêm phong hộp chống sốc và thuốc gây nghiện", "Ký biên bản bàn giao giữa 2 ca"],
         ["Điều dưỡng ca trước và ca sau trực tiếp cùng kiểm đếm số lượng thuốc gây nghiện, hướng thần và cơ số hộp chống sốc", "Kiểm tra hạn dùng và tính nguyên vẹn của niêm phong", "Ký xác nhận vào sổ bàn giao ca trực"])

add_case(180, "hospital_protocols", "Lập dự trù bù tồn kho tủ trực cấp cứu sau ca trực?", "PROPOSE_RESTOCK_PLAN",
         ["dự trù", "tủ trực"], "Thông tư 22/2011/TT-BYT",
         ["Lập phiếu lĩnh bù cơ số tủ trực", "Căn cứ đơn thuốc và y lệnh thực tế đã dùng", "Trình lãnh đạo khoa phê duyệt"],
         ["Tổng hợp toàn bộ các mặt hàng thuốc và vật tư đã sử dụng trong ca trực căn cứ theo y lệnh hợp lệ", "Lập phiếu dự trù bù đủ cơ số chuẩn của tủ trực trình dược sĩ và lãnh đạo ký duyệt"])

add_case(181, "hospital_protocols", "Phác đồ xử trí sốt cao kèm buồn nôn ở người bệnh nghi ngờ sốt xuất huyết Dengue?", "CLINICAL_FEVER_TRIAGE_PROTOCOL",
         ["sốt cao", "buồn nôn", "dengue"], "Hướng dẫn Chẩn đoán Điều trị Sốt xuất huyết Bộ Y tế",
         ["Ưu tiên Paracetamol viên đạn đặt trực tràng khi nôn ói", "Bù nước điện giải bằng Oresol từng ngụm nhỏ", "TUYỆT ĐỐI KHÔNG dùng Ibuprofen Aspirin"],
         ["Ưu tiên Paracetamol (dạng viên đạn đặt hậu môn 150/250/500mg nếu nôn nhiều), liều 10 - 15 mg/kg cách mỗi 4 - 6 giờ", "Uống dung dịch Oresol từng ngụm nhỏ", "TUYỆT ĐỐI CHỐNG CHỈ ĐỊNH Aspirin và Ibuprofen do nguy cơ gây xuất huyết nặng"])

add_case(182, "hospital_protocols", "Dấu hiệu cảnh báo nguy hiểm trong sốt xuất huyết Dengue cần nhập viện khẩn cấp?", "CLINICAL_FEVER_TRIAGE_PROTOCOL",
         ["dengue", "dấu hiệu cảnh báo"], "Quyết định 2760/QĐ-BYT",
         ["Đau bụng nhiều ở vùng gan", "Nôn ói liên tục không uống được", "Chảy máu niêm mạc nôn ra máu tiểu ra máu li bì bứt rứt"],
         ["Các dấu hiệu cảnh báo nhập viện khẩn cấp: Đau bụng nhiều ở hạ sườn phải (vùng gan), nôn ói liên tục, chảy máu chân răng/mũi/nôn ra máu, li bì vật vã bứt rứt, tiểu ít, tay chân lạnh ẩm, Hematocrit tăng kèm tiểu cầu giảm nhanh"])

add_case(183, "hospital_protocols", "Phác đồ bù dịch tiêu chảy mất nước theo phác đồ B của WHO?", "CLINICAL_AI_CONSULTATION",
         ["tiêu chảy", "bù dịch", "oresol"], "Hướng dẫn Xử trí Tiêu chảy WHO & Bộ Y tế",
         ["Bù Oresol theo cân nặng trong 4 giờ đầu", "Liều Oresol 75 ml/kg trong 4 giờ", "Đánh giá lại tình trạng mất nước sau 4 giờ"],
         ["Phác đồ B áp dụng cho mất nước nhẹ đến vừa: Cho uống dung dịch Oresol với lượng 75 ml/kg trong 4 giờ đầu", "Sau 4 giờ đánh giá lại tình trạng mất nước để quyết định phác đồ tiếp theo"])

add_case(184, "hospital_protocols", "Xử trí cơn tăng huyết áp khẩn cấp (Hypertensive emergency) tại khoa cấp cứu?", "CLINICAL_AI_CONSULTATION",
         ["tăng huyết áp", "khẩn cấp"], "Hướng dẫn Tăng huyết áp Hội Tim mạch VN & BYT",
         ["Huyết áp > 180/120 mmHg kèm tổn thương cơ quan đích cấp tính", "Hạ huyết áp không quá 25% trong giờ đầu", "Dùng thuốc tiêm truyền tĩnh mạch Nicardipine Labetalol Nitroglycerin"],
         ["Phân biệt tăng huyết áp khẩn cấp (có tổn thương cơ quan đích cấp) và khẩn trương", "Mục tiêu: Hạ huyết áp tâm thu không quá 25% trong giờ đầu tiên để tránh thiếu máu não/vành", "Ưu tiên thuốc tiêm truyền tĩnh mạch Nicardipine hoặc Nitroglycerin"])

add_case(185, "hospital_protocols", "Xử trí cấp cứu hạ đường huyết nặng có hôn mê tại buồng bệnh?", "CLINICAL_AI_CONSULTATION",
         ["hạ đường huyết", "cấp cứu"], "Hướng dẫn Cấp cứu Nội khoa Bộ Y tế",
         ["Tiêm tĩnh mạch dung dịch Glucose 20% hoặc 30%", "Liều 40 - 50 ml Glucose ưu trương", "Truyền duy trì Glucose 10% và kiểm tra đường huyết mỗi 15 - 30 phút"],
         ["Ngay lập tức tiêm tĩnh mạch 40 - 50 ml dung dịch Glucose 20% hoặc 30%", "Sau đó truyền tĩnh mạch liên tục Glucose 5% hoặc 10% duy trì", "Kiểm tra lại đường huyết mao mạch sau 15 phút đến khi đạt trên 5.6 mmol/L"])

add_case(186, "hospital_protocols", "Rửa dạ dày cấp cứu ngộ độc thuốc đường uống: Chỉ định và thời gian vàng?", "CLINICAL_AI_CONSULTATION",
         ["rửa dạ dày", "ngộ độc"], "Phác đồ Trung tâm Chống độc Quốc gia",
         ["Thời gian vàng trong vòng 1 - 2 giờ đầu sau uống chất độc", "Bảo vệ đường thở bằng đặt nội khí quản nếu hôn mê", "Chống chỉ định ngộ độc hóa chất ăn mòn acid kiềm"],
         ["Chỉ định có hiệu quả cao nhất trong vòng 1 giờ đầu sau khi uống lượng độc chất đe dọa tính mạng", "Phải đặt nội khí quản có bóng chèn bảo vệ đường thở nếu bệnh nhân hôn mê", "CHỐNG CHỈ ĐỊNH khi ngộ độc acid mạnh, kiềm mạnh hoặc dầu hỏa hydrocacbon"])

add_case(187, "hospital_protocols", "Nguyên tắc sử dụng kháng sinh dự phòng trong phẫu thuật theo Bộ Y tế?", "CLINICAL_AI_CONSULTATION",
         ["kháng sinh dự phòng"], "Quyết định 708/QĐ-BYT",
         ["Tiêm trong vòng 60 phút trước khi rạch da", "Ưu tiên Cephalosporin thế hệ 1 hoặc 2 Cefazolin Cefuroxim", "Thời gian dùng không quá 24 giờ sau mổ"],
         ["Mục tiêu: Đạt nồng độ kháng sinh diệt khuẩn trong mô trước khi rạch da", "Thời điểm tiêm: Trong vòng 30 - 60 phút trước khi rạch da (120 phút với Vancomycin)", "Ưu tiên Cefazolin hoặc Cefuroxim", "Thời gian dùng không quá 24 giờ sau mổ"])

add_case(188, "hospital_protocols", "Giám sát nồng độ thuốc trong máu TDM (Therapeutic Drug Monitoring) cho Vancomycin?", "CLINICAL_AI_CONSULTATION",
         ["vancomycin", "tdm"], "Hướng dẫn TDM Bộ Y tế",
         ["Lấy mẫu máu ngay trước liều thứ 4", "Mục tiêu nồng độ đáy Trough level 15 - 20 mcg/ml nhiễm khuẩn nặng", "Chỉnh liều dựa trên kết quả nồng độ đáy"],
         ["Thời điểm lấy mẫu: Lấy máu đo nồng độ đáy trong vòng 30 phút trước khi truyền liều thứ 4 (trạng thái ổn định)", "Mục tiêu nồng độ đáy: 15 - 20 mcg/ml đối với nhiễm khuẩn nặng (MRSA, viêm phổi, viêm màng não)"])

add_case(189, "hospital_protocols", "Quy trình xử trí tai biến truyền máu cấp tính tại giường bệnh?", "CLINICAL_AI_CONSULTATION",
         ["truyền máu", "tai biến"], "Thông tư 26/2013/TT-BYT Hướng dẫn Hoạt động Truyền máu",
         ["Ngừng truyền máu ngay lập tức giữ đường truyền tĩnh mạch bằng NaCl 0.9%", "Kiểm tra lại thông tin đơn vị máu và hồ sơ người bệnh", "Báo bác sĩ hồi sức và lưu mẫu máu nước tiểu"],
         ["HÀNH ĐỘNG ĐẦU TIÊN: Ngừng truyền máu ngay lập tức nhưng duy trì đường truyền tĩnh mạch bằng dung dịch NaCl 0.9%", "Kiểm tra lại nhãn đơn vị máu và thông tin người nhận", "Báo bác sĩ cấp cứu, kiểm tra sinh hiệu, lấy mẫu máu và túi máu gửi khoa huyết học xét nghiệm"])

add_case(190, "hospital_protocols", "Quy trình báo cáo phản ứng có hại của thuốc (ADR) lên Trung tâm Quốc gia DI & ADR?", "CLINICAL_AI_CONSULTATION",
         ["adr", "báo cáo"], "Quyết định 2147/QĐ-BYT & Cảnh giác Dược",
         ["Lập mẫu báo cáo ADR của Bộ Y tế", "Gửi trong vòng 48 giờ đối với biến cố tử vong hoặc đe dọa tính mạng", "Phân tích mối quan hệ nhân quả giữa thuốc và biến cố"],
         ["Mọi nhân viên y tế đều có trách nhiệm báo cáo biến cố bất lợi nghi do thuốc theo mẫu chuẩn của Bộ Y tế", "Thời hạn gửi báo cáo: Trong vòng 48 giờ đối với ADR nghiêm trọng gây tử vong hoặc đe dọa tính mạng; tối đa 7 ngày đối với các ADR nghiêm trọng khác"])

add_case(191, "hospital_protocols", "Kiểm tra đơn thuốc trùng lặp hoạt chất (Duplicate Therapy) trong phần mềm bệnh viện?", "PRESCRIPTION_AUDIT_REPORT",
         ["trùng lặp hoạt chất"], "Thông tư 26/2025/TT-BYT & Tiêu chuẩn CDSS",
         ["Phát hiện 2 thuốc có cùng hoạt chất hoặc cùng nhóm dược lý", "Ví dụ Paracetamol viên sủi và Paracetamol gói bột", "Cảnh báo nguy cơ quá liều"],
         ["Hệ thống CDSS tự động quét và cảnh báo khi bác sĩ kê đơn 2 thuốc có cùng hoạt chất (ví dụ Efferalgan và Hapacol) hoặc cùng nhóm tác dụng dược lý làm tăng nguy cơ quá liều độc tính"])

add_case(192, "hospital_protocols", "Quy trình dự phòng loét do tỳ đè ở bệnh nhân hôn mê nằm lâu tại khoa Hồi sức?", "CLINICAL_AI_CONSULTATION",
         ["loét tỳ đè", "điều dưỡng"], "Quy trình Chăm sóc Người bệnh Bộ Y tế",
         ["Thay đổi tư thế mỗi 2 giờ một lần", "Sử dụng đệm hơi chống loét", "Giữ da sạch sẽ và khô thoáng"],
         ["Thay đổi tư thế nằm nghiêng/ngửa tối thiểu mỗi 2 giờ một lần", "Sử dụng đệm hơi hoặc đệm nước giảm áp lực", "Vệ sinh da sạch sẽ, khô thoáng, xoa bóp nhẹ nhàng các vùng tỳ đè (xương cùng cụt, gót chân, bả vai)"])

add_case(193, "hospital_protocols", "Hướng dẫn súc miệng sau khi xịt Corticoid (như Seretide, Symbicort) dự phòng nấm miệng?", "MEDICATION_SAFETY_PROFILE",
         ["seretide", "symbicort"], "DĐVN V & Hướng dẫn COPD/Hen GINA",
         ["Súc miệng và nhổ bỏ nước sau khi xịt thuốc", "Dự phòng nấm candida miệng hầu và khản tiếng", "Dùng buồng đệm spacer"],
         ["Bắt buộc súc miệng kỹ bằng nước sạch và nhổ đi (không nuốt) sau mỗi lần hít xịt thuốc", "Mục đích: Loại bỏ thuốc đọng ở khoang miệng hầu, phòng ngừa tác dụng phụ nấm Candida miệng hầu và khản tiếng"])

add_case(194, "hospital_protocols", "Thời hạn bảo quản dung dịch tiêm truyền sau khi pha ở điều kiện phòng bệnh?", "CLINICAL_AI_CONSULTATION",
         ["pha tiêm truyền", "bảo quản"], "Dược thư Quốc gia & Dược Lâm sàng",
         ["Sử dụng ngay sau khi pha trong vòng 24 giờ", "Dung dịch kháng sinh pha xong bảo quản lạnh nếu chưa dùng", "Ghi rõ thời gian pha trên nhãn chai truyền"],
         ["Khuyến cáo sử dụng ngay sau khi pha vô khuẩn", "Thời gian truyền không quá 24 giờ kể từ lúc bắt đầu pha dung dịch truyền", "Phải dán nhãn ghi rõ tên thuốc pha thêm, liều lượng, thời gian bắt đầu pha và tên người pha"])

add_case(195, "hospital_protocols", "Bàn giao thuốc kiểm soát đặc biệt (Gây nghiện, Hướng thần, Tiền chất) giữa hai ca trực?", "SHIFT_HANDOVER_RECONCILIATION",
         ["bàn giao", "kiểm soát đặc biệt"], "Thông tư 20/2017/TT-BYT",
         ["Đối chiếu số lượng thuốc thực tế với y lệnh sổ sách", "Kiểm tra nguyên vẹn ống thuốc và hạn dùng", "Cả 2 điều dưỡng ký tên xác nhận"],
         ["Hai điều dưỡng ca cũ và ca mới cùng mở tủ thuốc kiểm đếm thực tế từng ống thuốc, đối soát với y lệnh đã thực hiện và sổ theo dõi", "Ký ghi rõ họ tên xác nhận số lượng tồn chuyển ca"])

add_case(196, "hospital_protocols", "Soạn nội dung tin nhắn SMS dặn dò cữ uống thuốc cho bệnh nhân xuất viện?", "PRESCRIPTION_ADVICE_CLARIFICATION",
         ["dặn dò", "sms"], "Quy trình Dặn dò Người bệnh",
         ["Chia cữ sáng trưa chiều tối rõ ràng", "Nêu rõ uống trước hay sau ăn", "Số điện thoại liên hệ khi có dấu hiệu bất thường"],
         ["Nội dung tin nhắn ngắn gọn, dễ hiểu: Tên thuốc, liều lượng, số viên mỗi lần, thời điểm uống (sáng/tối, trước/sau ăn), lưu ý đặc biệt và số điện thoại hotline khoa điều trị"])

add_case(197, "hospital_protocols", "Quy trình xuất kho thuốc FEFO ưu tiên lô cận hạn trước áp dụng cho Dược sĩ kho?", "QUERY_FEFO_EXPIRY",
         ["fefo", "dược sĩ kho"], "Thông tư 36/2018/TT-BYT GSP",
         ["Hệ thống phần mềm tự động khóa xuất lô hạn dài nếu còn lô cận hạn", "Kiểm tra cảm quan nhãn mác trước khi xuất", "In phiếu xuất kho FEFO"],
         ["Phần mềm quản lý dược tự động gợi ý xuất lô có hạn dùng ngắn nhất trước", "Dược sĩ kiểm tra đối chiếu số lô hạn dùng trên thực tế với phần mềm trước khi giao thuốc cho các khoa lâm sàng"])

add_case(198, "hospital_protocols", "Kê đơn ngoại trú thuốc giảm đau Paracetamol 500mg cho bệnh nhân đau đầu?", "CPOE_CLARIFICATION",
         ["kê đơn", "paracetamol"], "Thông tư 52/2017 & TT 26/2025/TT-BYT",
         ["Kê số lượng đủ dùng 3 - 5 ngày", "Liều 1 viên mỗi 4 - 6 giờ khi đau", "Hướng dẫn không dùng quá 4 viên một ngày"],
         ["Chẩn đoán ICD-10 phù hợp (R51: Đau đầu), liều 1 viên (500mg) mỗi 4 - 6 giờ khi đau, tối đa 4 viên/ngày, ghi rõ cách dùng và lời dặn không uống cùng rượu bia"])

add_case(199, "hospital_protocols", "Kiểm tra tính hợp lệ của chữ ký số bác sĩ trong đơn thuốc điện tử CPOE?", "CLINICAL_SAFE_ABSTENTION",
         ["chữ ký số", "đơn điện tử"], "Thông tư 27/2021/TT-BYT & NĐ 130/2018/NĐ-CP",
         ["Chứng thư số bác sĩ còn hiệu lực", "Xác thực chữ ký số bằng mã băm toàn vẹn", "Đơn thuốc có mã đơn quốc gia"],
         ["Hệ thống tự động xác thực chứng thư số của bác sĩ kê đơn với cổng chứng thực quốc gia, kiểm tra tính toàn vẹn của tệp đơn thuốc và mã liên thông đơn thuốc điện tử"])

add_case(200, "hospital_protocols", "Xử trí ngộ độc cấp tính thuốc trừ sâu phospho hữu cơ bằng Atropin và PAM?", "CLINICAL_AI_CONSULTATION",
         ["phospho hữu cơ", "atropin", "pam"], "Phác đồ Cấp cứu Chống độc Bộ Y tế",
         ["Hội chứng cường cholinergic tăng tiết co đồng tử co thắt phế quản", "Atropin hóa liều cao tiêm tĩnh mạch", "Thuốc giải độc hồi phục men Cholinesterase Pralidoxime PAM"],
         ["Dấu hiệu ngộ độc: Tăng tiết đờm dãi, co đồng tử đinh ghim, co thắt phế quản, mạch chậm, yếu cơ", "Atropin liều cao tiêm tĩnh mạch nhắc lại đến khi đạt tình trạng Atropin hóa (phổi hết rale, da khô, đồng tử giãn nhẹ)", "Phối hợp thuốc tái hoạt hóa men Cholinesterase: Pralidoxime (PAM) sớm"])

def main():
    target_path = Path("/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/evaluation/clinical_benchmark_200_baseline.json")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(BENCHMARK_CASES, f, ensure_ascii=False, indent=2)
    print(f"Successfully generated {len(BENCHMARK_CASES)} baseline golden benchmark cases to {target_path}")

if __name__ == "__main__":
    main()
