"""
 Dữ liệu đồ thị tương tác thuốc dẫn xuất từ QĐ 5948/QĐ-BYT; từng quy tắc phải đối chiếu nguồn trước khi dùng lâm sàng (<=195 LOC)
"""

def _create_ddi(partner: str, partner_names: list[str], severity: str, mechanism: str, consequence: str) -> dict:
    return {"partner": partner, "partner_names": partner_names, "severity": severity, "mechanism": mechanism, "consequence": consequence}

CLINICAL_DDI_GRAPH: dict[str, list[dict]] = {
    "ceftriaxon": [
        _create_ddi("calci", ["calci", "canxi", "ringer lactat", "calcium", "hartmann"], "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)", "Tạo muối Ceftriaxon-Calci kết tủa dạng vi tinh thể không tan trong máu", "Tắc vi mạch phổi, suy thận cấp, ngừng tim tử vong. Cấm tiêm truyền ở trẻ sơ sinh <= 28 ngày tuổi.")
    ],
    "nitroglycerin": [
        _create_ddi("sildenafil", ["sildenafil", "tadalafil", "vardenafil", "viagra", "cialis"], "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)", "Hiệp đồng tăng cGMP nội bào tại cơ trơn mạch máu, gây giãn cơ trơn tiểu động mạch và tĩnh mạch ồ ạt", "Tụt huyết áp kịch phát, nhồi máu cơ tim, trụy mạch tử vong. Cách ly tối thiểu 24-48 giờ.")
    ],
    "sildenafil": [
        _create_ddi("nitroglycerin", ["nitroglycerin", "isosorbid", "nitrat", "mononitrat", "dinitrat", "nicorandil"], "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)", "Hiệp đồng làm tăng nồng độ cGMP gây giãn mạch toàn thân dữ dội", "Tụt huyết áp trụy mạch đe dọa tính mạng.")
    ],
    "simvastatin": [
        _create_ddi("clarithromycin", ["clarithromycin", "erythromycin", "klacid", "itraconazol", "ketoconazol"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Kháng sinh Macrolid / Kháng nấm Azole ức chế mạnh CYP3A4 làm tăng nồng độ Statin gấp 5-10 lần", "Tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu gây suy thận cấp vô niệu.")
    ],
    "clopidogrel": [
        _create_ddi("omeprazol", ["omeprazol", "omeprazole", "esomeprazol", "esomeprazole"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Omeprazol ức chế CYP2C19 ngăn chuyển tiền chất Clopidogrel thành chất có hoạt tính chống ngưng tập tiểu cầu", "Giảm hiệu lực bảo vệ tim mạch, tăng nguy cơ huyết khối stent và tái phát nhồi máu cơ tim.")
    ],
    "aceclofenac": [
        _create_ddi("ketorolac", ["ketorolac", "toradol"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Hiệp đồng ức chế tổng hợp Prostaglandin bảo vệ niêm mạc dạ dày", "Nguy cơ loét thủng và xuất huyết tiêu hóa ồ ạt đe dọa tính mạng (tăng gấp 5 lần).")
    ],
    "ketorolac": [
        _create_ddi("aceclofenac", ["aceclofenac", "ibuprofen", "diclofenac", "meloxicam", "piroxicam"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Hiệp đồng ức chế tổng hợp Prostaglandin bảo vệ niêm mạc dạ dày", "Xuất huyết tiêu hóa ồ ạt đe dọa tính mạng.")
    ],
    "methotrexat": [
        _create_ddi("nsaid", ["ibuprofen", "diclofenac", "naproxen", "ketoprofen", "aspirin"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "NSAID giảm lưu lượng máu qua thận và cạnh tranh bài tiết qua ống thận với Methotrexat", "Tích lũy nồng độ Methotrexat gây độc tủy xương cấp, suy tủy, mất bạch cầu hạt, loét trợt tiêu hóa.")
    ],
    "amiodaron": [
        _create_ddi("colchicin", ["colchicin", "colchicine"], "Chống chỉ định ở người suy gan/thận (QĐ 5948/QĐ-BYT)", "Amiodaron ức chế P-glycoprotein làm giảm thải trừ Colchicin qua ruột và thận", "Ngộ độc Colchicin cấp: tiêu chảy xuất huyết, tiêu cơ vân, suy đa tạng tử vong."),
        _create_ddi("digoxin", ["digoxin"], "Tương tác nghiêm trọng - Giảm liều 50% (QĐ 5948/QĐ-BYT)", "Amiodaron ức chế P-glycoprotein làm tăng gấp đôi nồng độ Digoxin huyết tương", "Ngộ độc Digoxin tim mạch, rung thất kịch phát, bloc nhĩ thất hoàn toàn."),
        _create_ddi("moxifloxacin", ["moxifloxacin", "levofloxacin", "erythromycin", "domperidon", "haloperidol", "ondansetron"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Hiệp đồng kéo dài khoảng QT trên điện tâm đồ", "Nguy cơ xoắn đỉnh (Torsades de Pointes), rung thất và ngừng tim đột ngột.")
    ],
    "ciprofloxacin": [
        _create_ddi("theophyllin", ["theophyllin", "theophylline"], "Chống chỉ định / Nguy cơ cao (QĐ 5948/QĐ-BYT)", "Quinolon ức chế enzym CYP1A2 tại gan làm giảm chuyển hóa Theophyllin", "Ngộ độc Theophyllin cấp tính: Loạn nhịp thất kịch phát, co giật toàn thể kháng trị, tử vong."),
        _create_ddi("antacid", ["antacid", "nhôm", "magnesi", "sắt", "canxi", "sucralfat"], "Tương tác hấp thu (QĐ 5948/QĐ-BYT)", "Tạo phức chelate không tan với cation đa hóa trị Al3+, Mg2+, Fe2+, Ca2+", "Giảm hấp thu kháng sinh 50-90%, thất bại điều trị nhiễm khuẩn. Uống cách xa ít nhất 2 giờ.")
    ],
    "theophyllin": [
        _create_ddi("ciprofloxacin", ["ciprofloxacin", "levofloxacin"], "Chống chỉ định / Nguy cơ cao (QĐ 5948/QĐ-BYT)", "Quinolon ức chế enzym CYP1A2 làm chậm thanh thải Theophyllin", "Ngộ độc Theophyllin cấp, co giật và loạn nhịp thất nguy hiểm.")
    ],
    "tramadol": [
        _create_ddi("linezolid", ["linezolid", "moclobemid", "selegilin", "maoi", "fluoxetin", "sertralin"], "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)", "Hiệp đồng ức chế tái hấp thu và ngăn giáng hóa Serotonin tại synap thần kinh", "Hội chứng Serotonin ác tính (rung giật cơ, sốt cao ác tính, co giật, trụy hô hấp tử vong).")
    ],
    "morphin": [
        _create_ddi("diazepam", ["diazepam", "midazolam", "seduxen", "valium"], "Cảnh báo tương tác thần kinh trung ương (FDA Boxed Warning)", "Hiệp đồng ức chế thụ thể thần kinh trung ương và hành tủy", "Ức chế hô hấp nặng, suy hô hấp, hôn mê sâu và tử vong."),
        _create_ddi("paracetamol", ["paracetamol", "panadol", "efferalgan", "acetaminophen"], "Phối hợp an toàn & Hiệp đồng giảm đau (Multimodal Analgesia)", "Hiệp đồng tác dụng giảm đau đa tầng (bậc thang WHO), tiết kiệm liều Opioid", "Tăng hiệu quả giảm đau, tiết kiệm 20-30% liều Morphin, giảm ức chế hô hấp. Duy trì paracetamol <= 4g/ngày.")
    ],
    "paracetamol": [
        _create_ddi("morphin", ["morphin", "morphine", "moocphin", "morfin"], "Phối hợp an toàn & Hiệp đồng giảm đau (Multimodal Analgesia)", "Paracetamol + Morphin hiệp đồng tác dụng giảm đau đa mô thức", "Tăng hiệu quả giảm đau, tiết kiệm 20-30% liều Morphin. Giữ liều Paracetamol <= 4g/ngày."),
        _create_ddi("rượu", ["rượu", "cồn", "ethanol", "bia"], "Chống chỉ định / Cảnh báo đỏ tổn thương gan (DĐVN V)", "Ethanol cảm ứng enzym CYP2E1 làm tăng tạo chất chuyển hóa độc NAPQI, cạn kiệt Glutathion", "Hoại tử tế bào gan cấp không hồi phục, suy gan cấp đe dọa tính mạng.")
    ],
    "warfarin": [
        _create_ddi("miconazol", ["miconazol", "miconazole", "fluconazol", "fluconazole", "voriconazol"], "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)", "Kháng nấm Azole ức chế mạnh CYP2C9 ngăn cản chuyển hóa S-warfarin", "Tăng vọt INR, xuất huyết nội tạng dữ dội (não, tiêu hóa, đái máu) đe dọa tính mạng."),
        _create_ddi("aspirin", ["aspirin", "ibuprofen", "diclofenac", "meloxicam", "ketorolac", "nsaid"], "Chống chỉ định phối hợp thường quy (QĐ 5948/QĐ-BYT)", "NSAID ức chế ngưng tập tiểu cầu và trợt loét niêm mạc dạ dày kết hợp tác dụng chống đông", "Xuất huyết tiêu hóa ồ ạt, chảy máu khó cầm.")
    ],
    "allopurinol": [
        _create_ddi("azathioprin", ["azathioprin", "azathioprine", "mercaptopurin", "6-mp", "imuran"], "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)", "Allopurinol ức chế Xanthine Oxidase ngăn chặn bất hoạt Azathioprin/6-MP", "Tích lũy nồng độ gây suy tủy xương toàn thể ác tính, mất bạch cầu hạt, nhiễm trùng tử vong.")
    ],
    "metformin": [
        _create_ddi("thuốc cản quang iod", ["cản quang", "iod", "iopamidol", "iohexol", "iodixanol", "chụp ct", "thuốc cản quang"], "Chống chỉ định tạm thời khi suy thận (QĐ 5948/QĐ-BYT)", "Thuốc cản quang gây suy thận cấp làm tích lũy Metformin", "Nhiễm toan lactic (Lactic Acidosis) nặng nề tử vong 50%. Tạm ngừng 48h trước và sau chụp.")
    ],
    "kali clorid": [
        _create_ddi("spironolacton", ["spironolacton", "aldactone", "enalapril", "perindopril", "losartan", "captopril"], "Nguy cơ tăng Kali máu ác tính (QĐ 5948/QĐ-BYT)", "Thuốc ức chế RAAS làm giảm bài tiết Aldosteron kết hợp bổ sung Kali ngoại sinh", "Tăng kali máu ác tính (>6.5 mmol/L), rối loạn dẫn truyền tim, ngừng tim tâm trương.")
    ],
    "vancomycin": [
        _create_ddi("gentamicin", ["gentamicin", "amikacin", "tobramycin", "furosemid", "lasix"], "Tăng cường độc tính thận và tai (QĐ 5948/QĐ-BYT)", "Hiệp đồng phá hủy tế bào ống thận và hủy hoại tế bào lông tiền đình ốc tai", "Suy thận cấp hoại tử ống thận và điếc thần kinh giác quan không hồi phục.")
    ],
    "adrenalin": [
        _create_ddi("propranolol", ["propranolol", "timolol", "sotalol"], "Nguy cơ tăng huyết áp kịch phát (QĐ 5948/QĐ-BYT)", "Ức chế giãn mạch beta-2 để lại tác dụng co mạch alpha-1 đơn độc", "Cơn tăng huyết áp kịch phát, xuất huyết não và nhịp tim chậm phản xạ nguy kịch.")
    ]
}

CLINICAL_CONTRAINDICATION_GRAPH: dict[str, dict] = {
    "paracetamol": {
        "organ_risks": ["suy gan nặng", "nghiện rượu", "thiếu hụt g6pd"],
        "max_dose": "4000 mg/ngày (người lớn); 3000 mg/ngày (nghiện rượu/nhẹ cân)",
        "renal_rule": "ClCr < 10 mL/phút: nới khoảng cách liều tối thiểu 8 giờ.",
        "antidote": "N-acetylcystein (uống hoặc truyền tĩnh mạch)"
    },
    "ceftriaxon": {
        "organ_risks": ["dị ứng cephalosporin", "vàng da sơ sinh", "đang truyền calci"],
        "max_dose": "4 g/ngày (nhiễm khuẩn nặng)",
        "renal_rule": "Suy cả gan và thận: tối đa 2 g/ngày",
        "antidote": "Xử trí phản vệ theo Thông tư 51/2017/TT-BYT (Adrenalin)"
    },
    "morphin": {
        "organ_risks": ["suy hô hấp nặng", "hen phế quản cấp", "tăng áp lực nội sọ", "tắc ruột"],
        "max_dose": "Chỉnh liều theo dung nạp; theo dõi sát nhịp thở (ngừng nếu nhịp thở < 10 lần/phút)",
        "renal_rule": "Thận trọng suy thận mạn vì tích lũy chất chuyển hóa Morphin-6-glucuronid gây độc",
        "antidote": "Naloxon 0.4mg - 2mg tiêm tĩnh mạch"
    },
    "diazepam": {
        "organ_risks": ["nhược cơ nặng", "suy hô hấp mất bù", "suy gan nặng", "glôcôm góc đóng"],
        "max_dose": "30 mg/đợt cấp co giật (tiêm TM không quá 5 mg/phút)",
        "renal_rule": "Chỉnh liều ở người suy gan/thận nặng",
        "antidote": "Flumazenil 0.2mg tiêm tĩnh mạch chậm"
    },
    "adrenalin": {
        "organ_risks": ["CẤM TUYỆT ĐỐI tiêm tĩnh mạch trực tiếp dung dịch chưa pha loãng"],
        "max_dose": "0.5 mg (1/2 ống) tiêm bắp mỗi 3-5 phút ở người lớn bị phản vệ Độ II trở lên",
        "renal_rule": "Không chống chỉ định tuyệt đối trong cấp cứu phản vệ nguy kịch (TT 51/2017)",
        "antidote": "Thuốc chẹn alpha / Thuốc giãn mạch nếu quá liều"
    },
    "warfarin": {
        "organ_risks": ["đang xuất huyết cấp", "loét dạ dày tiến triển", "nguy cơ chảy máu cao", "tai biến mạch máu não"],
        "max_dose": "Chỉnh liều theo đích INR (thường mục tiêu 2.0 - 3.0)",
        "renal_rule": "Chỉnh liều và theo dõi sát INR ở người suy gan thận",
        "antidote": "Vitamin K1 (Phytomenadion) và huyết tương tươi đông lạnh"
    },
    "metformin": {
        "organ_risks": ["nhiễm toan chuyển hóa", "suy tim mất bù", "suy hô hấp", "nghiện rượu"],
        "max_dose": "2000 - 2550 mg/ngày chia nhiều lần",
        "renal_rule": "Chống chỉ định tuyệt đối nếu eGFR < 30 mL/phút; giảm liều 50% nếu eGFR 30-44 mL/phút.",
        "antidote": "Lọc máu thẩm tách (Hemodialysis) thải trừ Metformin và điều chỉnh toan kiềm"
    }
}
