"""
Hệ thống Tri thức Dược Lâm sàng Đa Tầng LightRAG (Dual-Level Knowledge Graph Data)
Căn cứ:
1. LightRAG: Simple and Fast Retrieval-Augmented Generation (HKUDS, arXiv:2410.05779, 40.5k stars).
2. Dược thư Quốc gia Việt Nam (DĐVN V) & Quyết định 5948/QĐ-BYT (Danh mục tương tác thuốc chống chỉ định).
3. Hướng dẫn điều trị KDIGO 2024, ESC/AHA và Dược lý học lâm sàng Bộ Y tế.
"""
from typing import Dict, List, Any

# ==============================================================================
# 1. HỆ THỐNG PHÂN LOẠI DƯỢC LÝ & ATC (HIGH-LEVEL PHARMACOLOGICAL TAXONOMY)
# ==============================================================================

PHARMACOLOGICAL_CLASS_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "STATIN": {
        "name_vi": "Nhóm Statin (Thuốc ức chế men HMG-CoA Reductase hạ lipid máu)",
        "atc_prefix": "C10AA",
        "keywords": ["statin", "simvastatin", "atorvastatin", "rosuvastatin", "pravastatin", "fluvastatin", "lipitor", "zocor", "crestor"],
        "members": ["simvastatin", "atorvastatin", "rosuvastatin", "pravastatin", "fluvastatin"],
        "mechanism": "Ức chế cạnh tranh chọn lọc men HMG-CoA Reductase, giảm tổng hợp Cholesterol tại gan và tăng thụ thể LDL bề mặt.",
        "primary_metabolism": "CYP3A4 (Simvastatin, Atorvastatin); CYP2C9 (Rosuvastatin); Thận/Sulfation (Pravastatin)"
    },
    "MACROLID": {
        "name_vi": "Kháng sinh nhóm Macrolid",
        "atc_prefix": "J01FA",
        "keywords": ["macrolid", "macrolide", "clarithromycin", "erythromycin", "azithromycin", "roxithromycin", "spiramycin", "klacid", "zithromax"],
        "members": ["clarithromycin", "erythromycin", "azithromycin", "roxithromycin", "spiramycin"],
        "mechanism": "Gắn thuận nghịch vào tiểu đơn vị 50S ribosom vi khuẩn, ngăn cản tổng hợp chuỗi polypeptide vi khuẩn.",
        "cyp_inhibition": "Ức chế mạnh enzym gan CYP3A4 và chất vận chuyển P-gp (Clarithromycin, Erythromycin); Azithromycin ít ức chế hơn."
    },
    "ACEI": {
        "name_vi": "Nhóm Ức chế men chuyển (ACE Inhibitors)",
        "atc_prefix": "C09AA",
        "keywords": ["acei", "ức chế men chuyển", "uc che men chuyen", "perindopril", "enalapril", "captopril", "lisinopril", "ramipril", "coversyl", "renitec"],
        "members": ["perindopril", "enalapril", "captopril", "lisinopril", "ramipril"],
        "mechanism": "Ức chế men chuyển Angiotensin I thành Angiotensin II, ngăn thoái giáng Bradykinin gây giãn mạch, giảm hậu gánh và hạ huyết áp.",
        "adverse_effects": "Ho khan dai dẳng (do tích tụ Bradykinin), tăng Kali máu, suy thận cấp khi hẹp động mạch thận hai bên."
    },
    "ARB": {
        "name_vi": "Nhóm Chẹn thụ thể Angiotensin II (ARBs)",
        "atc_prefix": "C09CA",
        "keywords": ["arb", "chẹn thụ thể angiotensin", "chen thu the", "losartan", "telmisartan", "valsartan", "candesartan", "irbesartan", "micardis", "cozaar", "diovan"],
        "members": ["losartan", "telmisartan", "valsartan", "candesartan", "irbesartan"],
        "mechanism": "Chẹn chọn lọc thụ thể AT1 của Angiotensin II tại cơ trơn mạch máu và vỏ thượng thận. Không làm tăng Bradykinin nên không gây ho khan.",
        "adverse_effects": "Tăng Kali máu, hạ huyết áp liều đầu, thận trọng khi ClCr < 30 mL/phút."
    },
    "CCB": {
        "name_vi": "Nhóm Chẹn kênh Calci (Calcium Channel Blockers)",
        "atc_prefix": "C08",
        "keywords": ["ccb", "chẹn kênh calci", "chẹn canxi", "amlodipin", "nifedipin", "felodipin", "diltiazem", "verapamil", "lacidipin", "norvasc", "adalat"],
        "members": ["amlodipin", "nifedipin", "felodipin", "diltiazem", "verapamil", "lacidipin"],
        "mechanism": "Ức chế dòng Calci đi vào tế bào cơ tim và cơ trơn mạch máu, gây giãn tiểu động mạch ngoại vi và hạ huyết áp.",
        "adverse_effects": "Phù ngoại vi (mắt cá chân), bốc hỏa, nhức đầu; rất an toàn cho bệnh nhân suy thận mạn vì thải trừ qua gan."
    },
    "BETA_BLOCKER": {
        "name_vi": "Nhóm Chẹn thụ thể Beta giao cảm (Beta-Blockers)",
        "atc_prefix": "C07",
        "keywords": ["beta blocker", "chẹn beta", "chẹn beta giao cảm", "bisoprolol", "metoprolol", "atenolol", "propranolol", "carvedilol", "nebivolol", "concor", "betaloc"],
        "members": ["bisoprolol", "metoprolol", "atenolol", "propranolol", "carvedilol", "nebivolol"],
        "mechanism": "Chẹn chọn lọc thụ thể Beta-1 tại cơ tim, giảm nhịp tim, giảm sức co bóp cơ tim và giảm giải phóng renin tại thận.",
        "contraindications": "Hen phế quản nặng, co thắt phế quản, bloc nhĩ thất độ II-III, nhịp chậm xoang < 50 chu kỳ/phút."
    },
    "QUINOLON": {
        "name_vi": "Kháng sinh nhóm Fluoroquinolon",
        "atc_prefix": "J01MA",
        "keywords": ["quinolon", "fluoroquinolon", "ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "ciprobay", "tavanic", "avelox"],
        "members": ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"],
        "mechanism": "Ức chế enzyme DNA gyrase (Topoisomerase II) và Topoisomerase IV của vi khuẩn, ngăn chặn sao chép DNA.",
        "adverse_effects": "Kéo dài khoảng QT trên ECG, viêm gân/đứt gân gót Achilles, hạ đường huyết hoặc kích thích TKTW."
    },
    "CEPHALOSPORIN": {
        "name_vi": "Kháng sinh nhóm Cephalosporin (Họ Beta-lactam)",
        "atc_prefix": "J01DB-DE",
        "keywords": ["cephalosporin", "ceftriaxon", "cefuroxim", "cefotaxim", "cefazolin", "ceftazidim", "cefepim", "rocephin", "zinnat"],
        "members": ["ceftriaxon", "cefuroxim", "cefotaxim", "cefazolin", "ceftazidim", "cefepim"],
        "mechanism": "Ức chế tổng hợp thành tế bào vi khuẩn thông qua gắn kết và bất hoạt các protein gắn penicillin (PBPs).",
        "cautions": "Dị ứng chéo với Penicillin (5-10%); Ceftriaxon cấm tiêm truyền đồng thời với dịch truyền chứa Calci."
    },
    "NSAID": {
        "name_vi": "Thuốc chống viêm không steroid (NSAIDs)",
        "atc_prefix": "M01A",
        "keywords": ["nsaid", "chống viêm không steroid", "giam dau nsaid", "ibuprofen", "diclofenac", "meloxicam", "ketorolac", "celecoxib", "naproxen", "piroxicam", "voltaren", "mobic"],
        "members": ["ibuprofen", "diclofenac", "meloxicam", "ketorolac", "celecoxib", "naproxen", "piroxicam", "aspirin"],
        "mechanism": "Ức chế enzyme Cyclooxygenase (COX-1 và COX-2), làm giảm tổng hợp các Prostaglandin gây viêm, đau và bảo vệ dạ dày.",
        "contraindications": "Loét dạ dày tá tràng tiến triển, suy thận nặng ClCr < 30 mL/phút, suy tim nặng, đang dùng thuốc chống đông."
    },
    "OPIOID": {
        "name_vi": "Thuốc giảm đau Opioid (Gây nghiện & Kiểm soát đặc biệt)",
        "atc_prefix": "N02A",
        "keywords": ["opioid", "giam dau gay nghien", "morphin", "fentanyl", "tramadol", "codein", "oxycodon", "pethidin"],
        "members": ["morphin", "fentanyl", "tramadol", "codein", "oxycodon", "pethidin"],
        "mechanism": "Chủ vận chọn lọc trên các thụ thể Mu-opioid tại hệ thần kinh trung ương và tủy sống, ức chế dẫn truyền cảm giác đau.",
        "contraindications": "Suy hô hấp cấp, hen phế quản nặng, tăng áp lực nội sọ, tắc ruột cơ học."
    },
    "BENZODIAZEPIN": {
        "name_vi": "Nhóm Thuốc an thần bình thần Benzodiazepin (GABA-A Agonists)",
        "atc_prefix": "N05BA",
        "keywords": ["benzodiazepin", "bình thần", "an thần", "diazepam", "midazolam", "seduxen", "valium"],
        "members": ["diazepam", "midazolam", "lorazepam", "clonazepam"],
        "mechanism": "Gắn vào thụ thể Benzodiazepin trên phức hợp thụ thể GABA-A, tăng tần số mở kênh Cl-, gây ức chế thần kinh trung ương.",
        "contraindications": "Nhược cơ nặng, suy hô hấp nặng mất bù, ngưng thở khi ngủ."
    },
    "BIGUANID": {
        "name_vi": "Nhóm Biguanid điều trị đái tháo đường",
        "atc_prefix": "A10BA",
        "keywords": ["biguanid", "metformin", "glucophage"],
        "members": ["metformin"],
        "mechanism": "Kích hoạt enzym AMPK, giảm tân tạo glucose tại gan và tăng nhạy cảm insulin ở mô ngoại vi.",
        "contraindications": "Suy thận nặng ClCr < 30 mL/phút hoặc eGFR < 30 mL/phút/1.73m2 (nguy cơ toan Lactic tử vong 50%)."
    },
    "SGLT2I": {
        "name_vi": "Thuốc ức chế kênh đồng vận chuyển Natri-Glucose 2 (SGLT2i)",
        "atc_prefix": "A10BK",
        "keywords": ["sglt2", "sglt2i", "ức chế sglt2", "empagliflozin", "dapagliflozin", "canagliflozin", "jardiance", "forxiga"],
        "members": ["empagliflozin", "dapagliflozin", "canagliflozin"],
        "mechanism": "Ức chế kênh SGLT2 tại ống lượn gần thận, tăng thải glucose và natri qua nước tiểu, bảo vệ thận và giảm suy tim.",
        "cautions": "Nguy cơ toan ceton đái tháo đường euglycemic; không bắt đầu dùng khi eGFR < 20 mL/phút."
    },
    "DPP4I": {
        "name_vi": "Thuốc ức chế enzym Dipeptidyl Peptidase-4 (DPP-4i)",
        "atc_prefix": "A10BH",
        "keywords": ["dpp4", "dpp4i", "linagliptin", "sitagliptin", "vildagliptin", "trajenta", "januvia"],
        "members": ["linagliptin", "sitagliptin", "vildagliptin", "saxagliptin"],
        "mechanism": "Ức chế enzym DPP-4, kéo dài nồng độ hormone Incretin có hoạt tính, kích thích tiết insulin phụ thuộc glucose.",
        "features": "Linagliptin thải trừ 95% qua phân/mật, KHÔNG CẦN chỉnh liều ở bất kỳ mức độ suy thận nào."
    },
    "ANTICOAGULANT": {
        "name_vi": "Thuốc chống đông & Chống kết tập tiểu cầu",
        "atc_prefix": "B01",
        "keywords": ["chống đông", "kháng đông", "chống huyết khối", "warfarin", "aspirin", "clopidogrel", "rivaroxaban", "apixaban", "dabigatran", "heparin", "plavix", "xarelto"],
        "members": ["warfarin", "aspirin", "clopidogrel", "rivaroxaban", "apixaban", "dabigatran", "enoxaparin", "heparin"],
        "mechanism": "Ức chế các yếu tố đông máu hoặc ngăn chặn kết tập tiểu cầu, ngăn ngừa hình thành huyết khối.",
        "adverse_effects": "Nguy cơ xuất huyết nghiêm trọng (tiêu hóa, sọ não); theo dõi chặt chẽ INR hoặc chức năng thận."
    }
}

# ==============================================================================
# 2. MA TRẬN TƯƠNG TÁC NHÓM DƯỢC LÝ CẤP VĨ MÔ (HIGH-LEVEL CLASS INTERACTIONS)
# ==============================================================================

CLASS_INTERACTION_GRAPH: List[Dict[str, Any]] = [
    {
        "class_a": "MACROLID",
        "class_b": "STATIN",
        "severity": "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)",
        "mechanism": "Kháng sinh Macrolid (Clarithromycin, Erythromycin) ức chế mạnh CYP3A4, làm tăng nồng độ Statin chuyển hóa qua enzym này lên 5-10 lần.",
        "consequence": "Tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu gây suy thận cấp vô niệu nguy kịch tính mạng.",
        "management": "Tạm ngừng Statin trong đợt điều trị Macrolid ngắn ngày (5-7 ngày); hoặc lựa chọn kháng sinh nhóm khác (Beta-lactam, Quinolon); hoặc nếu bắt buộc hạ mỡ máu thì đổi sang Statin không qua CYP3A4 (Rosuvastatin, Pravastatin)."
    },
    {
        "class_a": "ACEI",
        "class_b": "ARB",
        "severity": "Chống chỉ định phối hợp kép RAAS (QĐ 5948/QĐ-BYT & ESC/AHA)",
        "mechanism": "Ức chế kép hệ Renin-Angiotensin-Aldosteron không làm tăng lợi ích tim mạch mà làm tăng độc tính thận.",
        "consequence": "Tụt huyết áp nặng, suy thận cấp và tăng Kali máu ác tính ngừng tim.",
        "management": "Tuyệt đối không phối hợp đồng thời 1 thuốc ACEI với 1 thuốc ARB. Chọn 1 trong 2 nhóm."
    },
    {
        "class_a": "NSAID",
        "class_b": "ANTICOAGULANT",
        "severity": "Chống chỉ định phối hợp thường quy (QĐ 5948/QĐ-BYT)",
        "mechanism": "Hiệp đồng tổn thương niêm mạc đường tiêu hóa và ức chế đông máu toàn thân.",
        "consequence": "Xuất huyết tiêu hóa ồ ạt, thủng dạ dày tá tràng, xuất huyết nội tạng khó cầm.",
        "management": "Ưu tiên giảm đau bằng Paracetamol (<= 3g/ngày) hoặc Opioid nhẹ. Nếu bắt buộc dùng NSAID ngắn ngày, bắt buộc bọc thêm PPI liều cao (Esomeprazol, Pantoprazol)."
    },
    {
        "class_a": "OPIOID",
        "class_b": "BENZODIAZEPIN",
        "severity": "Cảnh báo tương tác thần kinh trung ương (FDA Boxed Warning)",
        "mechanism": "Hiệp đồng ức chế thụ thể thần kinh trung ương và trung tâm hô hấp tại hành não.",
        "consequence": "Ức chế hô hấp nặng nề, suy hô hấp, hôn mê sâu và tử vong.",
        "management": "Hạn chế tối đa kê đơn đồng thời. Nếu cần an thần trong hồi sức cấp cứu, phải theo dõi SpO2 liên tục, có sẵn bóng thở và thuốc giải độc đặc hiệu Naloxon/Flumazenil."
    },
    {
        "class_a": "QUINOLON",
        "class_b": "MACROLID",
        "severity": "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)",
        "mechanism": "Hiệp đồng cộng dồn kéo dài khoảng QT trên điện tâm đồ (ức chế kênh Kali hERG).",
        "consequence": "Nguy cơ xoắn đỉnh (Torsades de Pointes), rung thất và đột tử do tim mạch.",
        "management": "Tránh dùng cùng lúc hai kháng sinh kéo dài khoảng QT. Theo dõi điện tâm đồ QTc nếu bệnh nhân có nguy cơ cao."
    }
]

# ==============================================================================
# 3. MA TRẬN BỆNH CẢNH & NGUY CƠ TỔN THƯƠNG TẠNG (ORGAN & CONDITION RISKS)
# ==============================================================================

ORGAN_CONDITION_HIERARCHY: Dict[str, Dict[str, Any]] = {
    "RENAL_IMPAIRMENT": {
        "title": "Suy thận mạn / Giảm mức lọc cầu thận (CKD / eGFR / ClCr)",
        "keywords": ["suy thận", "thận", "clcr", "egfr", "chức năng thận", "creatinin", "lọc máu", "chạy thận"],
        "critical_rules": [
            "ClCr < 30 mL/phút: Chống chỉ định Metformin (nguy cơ toan Lactic tử vong 50%). Đổi sang Insulin hoặc Linagliptin.",
            "ClCr < 30 mL/phút: Tránh dùng NSAID (nguy cơ suy thận cấp hoại tử ống thận tiến triển).",
            "ClCr < 50 mL/phút: Kháng sinh Ciprofloxacin, Levofloxacin phải giảm liều 50% hoặc giãn khoảng cách liều.",
            "ClCr < 30 mL/phút: Nhóm CCB (Amlodipin) là lựa chọn hạ huyết áp an toàn nhất không cần chỉnh liều thận."
        ]
    },
    "HEPATIC_IMPAIRMENT": {
        "title": "Suy gan nặng / Xơ gan mất bù / Viêm gan tiến triển",
        "keywords": ["suy gan", "men gan", "xơ gan", "viêm gan", "gan"],
        "critical_rules": [
            "Chống chỉ định Paracetamol liều cao ở người suy gan nặng; người viêm gan nhẹ/vừa giới hạn tối đa 2 - 3g/ngày và tuyệt đối không uống rượu.",
            "Tránh dùng Statin khi men gan AST/ALT tăng > 3 lần giới hạn trên bình thường.",
            "Benzodiazepin và Morphin tích lũy kéo dài do giảm chuyển hóa qua gan, nguy cơ hôn mê gan (Encephalopathy)."
        ]
    },
    "PREGNANCY": {
        "title": "Phụ nữ mang thai & Thời kỳ cho con bú",
        "keywords": ["mang thai", "thai kỳ", "có bầu", "cho con bú", "thai nhi"],
        "critical_rules": [
            "Chống chỉ định tuyệt đối nhóm ACEI và ARB trong thai kỳ (đặc biệt 3 tháng giữa và 3 tháng cuối do gây quái thai, suy thận thai nhi, thiểu ối).",
            "Chống chỉ định NSAID trong 3 tháng cuối thai kỳ (nguy cơ đóng sớm ống động mạch và vô niệu thai nhi).",
            "Thuốc hạ huyết áp an toàn hàng đầu trong thai kỳ: Methyldopa, Labetalol, Nifedipin phóng thích kéo dài.",
            "Thuốc hạ sốt giảm đau an toàn hàng đầu: Paracetamol (ở liều điều trị thấp nhất có hiệu quả)."
        ]
    },
    "PEPTIC_ULCER": {
        "title": "Loét dạ dày tá tràng / Xuất huyết tiêu hóa",
        "keywords": ["loét dạ dày", "dạ dày", "xuất huyết tiêu hóa", "chảy máu dạ dày", "viêm loét"],
        "critical_rules": [
            "Chống chỉ định tuyệt đối NSAID và Corticoid liều cao khi đang có loét tiến triển.",
            "Nếu bắt buộc dùng thuốc chống huyết khối (Aspirin, Clopidogrel), phải phối hợp kèm PPI (Esomeprazol, Pantoprazol) để dự phòng xuất huyết."
        ]
    }
}

# ==============================================================================
# 4. BẢNG KHUYẾN CÁO THAY THẾ AN TOÀN (THERAPEUTIC SUBSTITUTIONS)
# ==============================================================================

THERAPEUTIC_ALTERNATIVE_MAP: Dict[str, Dict[str, Any]] = {
    "ACEI_COUGH": {
        "trigger": [
            "ho khan", "ho do acei", "ho coversyl", "ho enalapril", "dị ứng acei", "đổi coversyl",
            ("ho", "coversyl"), ("ho", "acei"), ("ho", "enalapril"), ("ho", "perindopril")
        ],
        "target_class": "ACEI",
        "alternative_class": "ARB (Chẹn thụ thể Angiotensin II: Losartan, Telmisartan, Valsartan)",
        "recommendation": "Khi bệnh nhân bị ho khan dai dẳng do tích tụ Bradykinin từ nhóm ACEI, khuyến cáo chuyển sang nhóm ARB (như Losartan 50mg, Telmisartan 40mg hoặc Valsartan 80mg). Nhóm ARB duy trì trọn vẹn hiệu quả hạ áp và bảo vệ thận/tim mạch nhưng không làm tăng Bradykinin, triệt tiêu hoàn toàn tác dụng phụ ho khan."
    },
    "RENAL_HYPERTENSION": {
        "trigger": [
            "suy thận hạ huyết áp", "huyết áp suy thận", "thuốc huyết áp suy thận", "suy thận tăng huyết áp",
            ("suy thận", "huyết áp"), ("huyết áp", "clcr"), ("tăng huyết áp", "suy thận")
        ],
        "target_class": "HYPERTENSION_IN_CKD",
        "alternative_class": "CCB (Amlodipin) hoặc ARB chỉnh liều",
        "recommendation": "Ở bệnh nhân tăng huyết áp có bệnh thận mạn (CKD):\n1. Giai đoạn nhẹ-vừa (ClCr >= 30 mL/phút): Nhóm ACEI hoặc ARB là lựa chọn ưu tiên hàng đầu để giảm protein niệu và bảo vệ thận.\n2. Giai đoạn nặng (ClCr < 30 mL/phút): Nhóm Chẹn kênh Calci (CCB như Amlodipin 5-10mg) là giải pháp an toàn nhất do thải trừ chủ yếu qua gan, không làm suy giảm GFR cấp tính và không gây tăng Kali máu."
    },
    "RENAL_DIABETES": {
        "trigger": [
            "suy thận tiểu đường", "đái tháo đường suy thận", "metformin suy thận", "clcr 25 metformin", "suy thận đái tháo đường",
            ("metformin", "suy thận"), ("metformin", "clcr"), ("đái tháo đường", "suy thận"), ("tiểu đường", "suy thận")
        ],
        "target_class": "BIGUANID",
        "alternative_class": "DPP-4i (Linagliptin) hoặc Insulin",
        "recommendation": "Khi bệnh nhân đái tháo đường có ClCr < 30 mL/phút, bắt buộc ngừng Metformin do nguy cơ nhiễm toan Lactic. Lựa chọn thay thế an toàn hàng đầu:\n1. Thuốc ức chế DPP-4: Linagliptin (Trajenta 5mg) uống 1 viên/ngày, KHÔNG CẦN chỉnh liều ở mọi mức độ suy thận vì thải trừ 95% qua mật/phân.\n2. Insulin phác đồ cá thể hóa theo mức đường huyết."
    },
    "NSAID_CONTRAINDICATION": {
        "trigger": [
            "thay thế nsaid", "loét dạ dày đau khớp", "suy thận giảm đau", "chống chỉ định nsaid",
            ("loét dạ dày", "nsaid"), ("suy thận", "nsaid"), ("chống chỉ định", "nsaid")
        ],
        "target_class": "NSAID",
        "alternative_class": "Paracetamol hoặc Paracetamol + Opioid nhẹ",
        "recommendation": "Khi có chống chỉ định với nhóm NSAID (loét dạ dày, suy thận, hoặc đang dùng thuốc chống đông máu):\n1. Giảm đau nhẹ - vừa: Paracetamol uống 500mg - 1000mg mỗi 4-6 giờ (tối đa 3g/ngày nếu dùng dài ngày).\n2. Giảm đau vừa - nặng: Phối hợp Paracetamol + Codein hoặc Paracetamol + Tramadol (Ultracet) để hiệp đồng giảm đau đa mô thức mà không gây tổn thương niêm mạc dạ dày hay co thắt mạch thận."
    }
}
