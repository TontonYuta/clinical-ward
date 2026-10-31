"""
Clinical Knowledge Graph Layer (LightRAG & MedGraphRAG Pattern)
Biểu diễn quan hệ Dược chất <-> Tương tác DDI (QĐ 5948) <-> Chống chỉ định (<=190 LOC)
"""
import re
from typing import Optional

# 1. Đồ thị tương tác thuốc chống chỉ định (QĐ 5948/QĐ-BYT)
CLINICAL_DDI_GRAPH: dict[str, list[dict]] = {
    "ceftriaxon": [
        {
            "partner": "calci",
            "partner_names": ["calci", "canxi", "ringer lactat", "calcium", "hartmann"],
            "severity": "Chống chỉ định tuyệt đối (QĐ 5948/QĐ-BYT)",
            "mechanism": "Tạo muối Ceftriaxon-Calci kết tủa dạng vi tinh thể không tan trong máu",
            "consequence": "Tắc vi mạch phổi, suy thận cấp, ngừng tim tử vong. Chống chỉ định tuyệt đối ở trẻ sơ sinh <= 28 ngày tuổi."
        }
    ],
    "aceclofenac": [
        {
            "partner": "ketorolac",
            "partner_names": ["ketorolac", "toradol"],
            "severity": "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)",
            "mechanism": "Hiệp đồng ức chế tổng hợp Prostaglandin bảo vệ niêm mạc dạ dày",
            "consequence": "Nguy cơ loét và xuất huyết tiêu hóa ồ ạt đe dọa tính mạng (tăng gấp 5 lần)."
        }
    ],
    "simvastatin": [
        {
            "partner": "clarithromycin",
            "partner_names": ["clarithromycin", "erythromycin", "klacid"],
            "severity": "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)",
            "mechanism": "Kháng sinh Macrolid ức chế mạnh CYP3A4 làm tăng nồng độ Simvastatin gấp 5-10 lần",
            "consequence": "Tiêu cơ vân cấp (Rhabdomyolysis), giải phóng myoglobin gây suy thận cấp vô niệu."
        }
    ],
    "digoxin": [
        {
            "partner": "amiodaron",
            "partner_names": ["amiodaron", "amiodarone", "cordarone"],
            "severity": "Tương tác nghiêm trọng - Giảm liều 50% (QĐ 5948/QĐ-BYT)",
            "mechanism": "Amiodaron ức chế P-glycoprotein làm tăng gấp đôi nồng độ Digoxin huyết tương",
            "consequence": "Ngộ độc Digoxin tim mạch, rung thất kịch phát, bloc nhĩ thất hoàn toàn."
        }
    ],
    "morphin": [
        {
            "partner": "diazepam",
            "partner_names": ["diazepam", "midazolam", "seduxen", "valium"],
            "severity": "Cảnh báo tương tác thần kinh trung ương (FDA Boxed Warning)",
            "mechanism": "Hiệp đồng ức chế thụ thể thần kinh trung ương và hành tủy",
            "consequence": "Ức chế hô hấp nặng, suy hô hấp, hôn mê sâu và tử vong."
        },
        {
            "partner": "paracetamol",
            "partner_names": ["paracetamol", "panadol", "efferalgan", "acetaminophen"],
            "severity": "Phối hợp an toàn & Hiệp đồng giảm đau (Multimodal Analgesia)",
            "mechanism": "Hiệp đồng tác dụng giảm đau đa tầng (bậc thang WHO), tiết kiệm liều Opioid",
            "consequence": "Tăng hiệu quả giảm đau, tiết kiệm 20-30% liều Morphin, giảm ức chế hô hấp. Duy trì paracetamol <= 4g/ngày."
        }
    ],
    "paracetamol": [
        {
            "partner": "morphin",
            "partner_names": ["morphin", "morphine", "moocphin", "morfin"],
            "severity": "Phối hợp an toàn & Hiệp đồng giảm đau (Multimodal Analgesia)",
            "mechanism": "Paracetamol (ức chế tổng hợp Prostaglandin TKTW) + Morphin (chủ vận thụ thể mu-opioid) hiệp đồng tác dụng giảm đau",
            "consequence": "Tăng hiệu quả giảm đau, tiết kiệm 20-30% liều Morphin (Opioid-sparing), giảm nguy cơ ức chế hô hấp và nghiện. Kiểm soát liều trần Paracetamol <= 4g/ngày."
        },
        {
            "partner": "rượu",
            "partner_names": ["rượu", "cồn", "ethanol", "bia"],
            "severity": "Chống chỉ định / Cảnh báo đỏ tổn thương tế bào gan (DĐVN V)",
            "mechanism": "Ethanol cảm ứng enzym CYP2E1 làm tăng tạo chất chuyển hóa độc NAPQI, đồng thời cạn kiệt Glutathion tại gan",
            "consequence": "Hoại tử tế bào gan cấp không hồi phục, suy gan cấp đe dọa tính mạng kể cả ở liều paracetamol thông thường."
        }
    ],
    "clopidogrel": [
        {
            "partner": "omeprazol",
            "partner_names": ["omeprazol", "omeprazole", "esomeprazol", "esomeprazole"],
            "severity": "Chống chỉ định phối hợp (QĐ 5948/QĐ-BYT)",
            "mechanism": "Omeprazol ức chế enzym CYP2C19 ngăn chuyển tiền chất Clopidogrel thành chất có hoạt tính chống kết tập tiểu cầu",
            "consequence": "Giảm hiệu lực chống kết tập tiểu cầu, tăng nguy cơ huyết khối trong stent và tái phát nhồi máu cơ tim cấp."
        }
    ]
}

# 2. Đồ thị chống chỉ định bệnh nền & suy tạng
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
        "organ_risks": ["nhược cơ nặng (myasthenia gravis)", "suy hô hấp mất bù", "suy gan nặng", "glôcôm góc đóng"],
        "max_dose": "30 mg/đợt cấp co giật (tiêm TM không quá 5 mg/phút)",
        "renal_rule": "Chỉnh liều ở người suy gan/thận nặng",
        "antidote": "Flumazenil 0.2mg tiêm tĩnh mạch chậm"
    },
    "adrenalin": {
        "organ_risks": ["CẤM TUYỆT ĐỐI tiêm tĩnh mạch trực tiếp dung dịch chưa pha loãng"],
        "max_dose": "0.5 mg (1/2 ống) tiêm bắp mỗi 3-5 phút ở người lớn bị phản vệ Độ II trở lên",
        "renal_rule": "Không chống chỉ định tuyệt đối trong cấp cứu phản vệ nguy kịch (TT 51/2017)",
        "antidote": "Thuốc chẹn alpha / Thuốc giãn mạch nếu quá liều"
    }
}

def expand_clinical_graph(query: str, patient_info: Optional[dict] = None) -> dict:
    lower_query = query.lower()
    matched_inns: list[str] = []
    active_ddi_alerts: list[dict] = []
    contra_warnings: list[str] = []
    kg_entities: list[str] = []

    # Nhận diện hoạt chất trong câu query
    all_known_inns = set(list(CLINICAL_DDI_GRAPH.keys()) + list(CLINICAL_CONTRAINDICATION_GRAPH.keys()))
    for inn in all_known_inns:
        if inn in lower_query:
            matched_inns.append(inn)
            kg_entities.append(f"INN:{inn.upper()}")

    # 1. Quét tương tác thuốc DDI từ câu truy vấn
    for inn in matched_inns:
        ddi_list = CLINICAL_DDI_GRAPH.get(inn, [])
        for ddi in ddi_list:
            if any(p in lower_query for p in ddi["partner_names"]):
                active_ddi_alerts.append({
                    "drug_a": inn.capitalize(),
                    "drug_b": ddi["partner"].capitalize(),
                    "severity": ddi["severity"],
                    "mechanism": ddi["mechanism"],
                    "consequence": ddi["consequence"]
                })
                kg_entities.append(f"DDI:{inn.upper()}<->{ddi['partner'].upper()}")

    # 2. Quét chống chỉ định & cảnh báo cơ quan
    for inn in matched_inns:
        contra = CLINICAL_CONTRAINDICATION_GRAPH.get(inn)
        if contra:
            for r in contra["organ_risks"]:
                if r in lower_query:
                    contra_warnings.append(f"CẢNH BÁO {inn.upper()}: Nguy cơ cao khi có {r}.")
                    kg_entities.append(f"RISK:{inn.upper()}+{r}")

    # 3. Kết nối bệnh nền nếu có patient_info
    if patient_info:
        egfr = patient_info.get("egfr")
        allergies = [a.lower() for a in patient_info.get("allergies", [])]
        for inn in matched_inns:
            contra = CLINICAL_CONTRAINDICATION_GRAPH.get(inn)
            # Khớp trực tiếp hoặc khớp chéo qua nhóm dược lý (VD: dị ứng cephalosporin -> ceftriaxon)
            is_allergic = any(a in inn or inn in a for a in allergies)
            if not is_allergic and contra:
                is_allergic = any(any(a in r for a in allergies) for r in contra.get("organ_risks", []))

            if is_allergic:
                contra_warnings.append(f"BÁO ĐỘNG ĐỎ: Bệnh nhân có tiền sử dị ứng với {inn.upper()}!")
                kg_entities.append(f"PATIENT_ALLERGY:{inn.upper()}")
            if egfr is not None and egfr < 30:
                if contra and contra.get("renal_rule"):
                    contra_warnings.append(f"HIỆU CHỈNH THẬN (eGFR={egfr}): {contra['renal_rule']}")
                    kg_entities.append(f"RENAL_RISK:{inn.upper()}")

    return {
        "matched_inns": matched_inns,
        "active_ddi_alerts": active_ddi_alerts,
        "contra_warnings": contra_warnings,
        "kg_entities": kg_entities
    }
