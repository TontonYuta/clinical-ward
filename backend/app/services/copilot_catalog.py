MEDICATION_CATALOG = [
    {"name": "Morphin sulfat 10mg/1ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["morphin", "moocphin", "morfin", "morphine"]},
    {"name": "Fentanyl 0.1mg/2ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["fentanyl", "fentanin"]},
    {"name": "Diazepam 10mg/2ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["diazepam", "seduxen"]},
    {"name": "Midazolam 5mg/ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["midazolam", "mida"]},
    {"name": "Adrenalin 1mg/1ml (Epinephrin)", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["adrenalin", "adre", "adr", "epinephrine", "epinephrin"]},
    {"name": "Noradrenalin 4mg/4ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["noradrenalin", "norepinephrine", "vận mạch"]},
    {"name": "Atropin sulfat 0.25mg/ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["atropin", "nhịp chậm"]},
    {"name": "Cordarone 150mg/3ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["cordarone", "amiodarone", "chống loạn nhịp"]},
    {"name": "Kháng sinh Ceftriaxone 1g", "type": "Thuốc cấp cứu", "unit": "lọ", "keywords": ["ceftriaxone", "kháng sinh ceftriaxone"]},
    {"name": "Kháng sinh Meropenem 1g (Meronem)", "type": "Thuốc cấp cứu", "unit": "lọ", "keywords": ["meropenem", "meronem"]},
    {"name": "Nhũ dịch Lipid 20% Lipofundin 100ml", "type": "Thuốc cấp cứu", "unit": "chai", "keywords": ["lipid", "lipofundin", "giải độc thuốc tê"]},
    {"name": "Kali Clorid 10% (KCl 10ml)", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["kali", "kcl", "kali clorid"]},
    {"name": "Vắc xin phòng dại Verorab 0.5ml", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["verorab", "dại"]},
    {"name": "Huyết thanh kháng uốn ván SAT 1500 UI", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["sat", "uốn ván", "kháng uốn ván"]},
    {"name": "Vắc xin Viêm gan B Engerix-B", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["engerix", "viêm gan b"]},
    {"name": "Dây truyền dịch có bầu đếm giọt", "type": "Vật tư tiêu hao", "unit": "bộ", "keywords": ["dây truyền", "dây truyền dịch", "bầu đếm giọt"]},
    {"name": "Chỉ phẫu thuật Catgut 3/0", "type": "Vật tư tiêu hao", "unit": "hộp", "keywords": ["catgut", "chỉ phẫu thuật", "chỉ khâu"]},
    {"name": "Bơm tiêm 5ml Vinahankook tiệt trùng", "type": "Vật tư tiêu hao", "unit": "cái", "keywords": ["bơm tiêm 5ml", "bơm tiêm", "kim tiêm"]},
    {"name": "Catheter tĩnh mạch trung tâm 3 nòng CVC", "type": "Vật tư tiêu hao", "unit": "bộ", "keywords": ["cvc", "catheter", "tĩnh mạch trung tâm"]},
    {"name": "Kim luồn tĩnh mạch ngoại vi 20G", "type": "Vật tư tiêu hao", "unit": "cái", "keywords": ["kim luồn", "kim luồn 20g"]}
]

DEVICE_CATALOG = [
    {"name": "Máy thở Puritan Bennett 840 (PB840)", "model": "PB840 Ventilator - Medtronic", "serial": "PB840-VN-2021-998", "risk": "D", "aliases": ["pb840", "pb 840", "puritan bennett", "bennett", "máy thở"]},
    {"name": "Máy sốc tim Zoll R Series", "model": "Zoll R Series ALS Defibrillator", "serial": "ZOLL-R-8831", "risk": "D", "aliases": ["zoll", "sốc tim", "máy sốc tim", "phá rung"]},
    {"name": "Hệ thống lọc máu liên tục CRRT Prismaflex", "model": "Prismaflex v8.0 - Baxter", "serial": "PRISMA-VN-2022-014", "risk": "D", "aliases": ["crrt", "lọc máu", "prismaflex"]},
    {"name": "Máy theo dõi bệnh nhân Philips MP50", "model": "IntelliVue MP50 Monitor", "serial": "PHI-MP50-4102", "risk": "C", "aliases": ["mp50", "mp 50", "monitor", "philips"]},
    {"name": "Bơm tiêm điện B.Braun Perfusor Space", "model": "Perfusor Space - B.Braun", "serial": "BBR-PERF-9921", "risk": "C", "aliases": ["bơm tiêm điện", "perfusor", "b.braun", "bbraun"]},
    {"name": "Máy thở Maquet Servo-i Universal", "model": "Servo-i - Getinge", "serial": "MAQ-SERVOI-3104", "risk": "D", "aliases": ["servo-i", "servo i", "maquet"]},
    {"name": "Máy phá rung tim Philips HeartStart XL", "model": "HeartStart XL M4735A", "serial": "PHI-HSXL-7712", "risk": "D", "aliases": ["heartstart", "heartstart xl", "phá rung"]},
    {"name": "Máy đo khí máu Radiometer ABL90 FLEX", "model": "ABL90 FLEX - Radiometer", "serial": "RAD-ABL90-5541", "risk": "C", "aliases": ["abl90", "abl 90", "khí máu", "máy khí máu", "radiometer"]},
    {"name": "Bình làm ẩm thở máy Fisher & Paykel MR850", "model": "MR850 Humidifier", "serial": "FP-MR850-8802", "risk": "C", "aliases": ["mr850", "bình làm ẩm"]},
    {"name": "Máy điện tim 12 cần Nihon Kohden", "model": "Cardiofax M ECG-1250K", "serial": "NK-ECG12-1089", "risk": "B", "aliases": ["ecg", "điện tim", "nihon kohden"]}
]

import re

def find_matched_med(lower_text: str):
    is_electric = "bơm tiêm điện" in lower_text
    # 1. Fast check against base curated items for backward compatibility
    for m in MEDICATION_CATALOG:
        if "Bơm tiêm" in m["name"] and is_electric:
            continue
        for k in m["keywords"]:
            if k == "bơm tiêm" and is_electric:
                continue
            if k in lower_text:
                return m

    # 2. Dynamic check via DrugLexicalMatcher (55,000 DAV drugs & DĐVN V monographs)
    try:
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        matcher = get_drug_lexical_matcher()
        meds = matcher.extract_medications(lower_text)
        if meds:
            primary_drug = meds[0]
            name_clean = primary_drug.title()
            drug_type = "Thuốc điều trị chuyên khoa"
            unit = "viên"

            from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
            reg_entry = DRUG_REGISTRY.get(primary_drug.lower())
            if reg_entry:
                name_clean = reg_entry.get("display", name_clean)
                classes = reg_entry.get("classes", [])
                if any("OPIOID" in c for c in classes):
                    drug_type = "Thuốc gây nghiện"
                    unit = "ống"
                elif any("SEDATIVE" in c or "BENZODIAZEPINE" in c for c in classes):
                    drug_type = "Thuốc hướng thần"
                    unit = "ống"
                elif any("CEPHALOSPORIN" in c or "ANTIBIOTIC" in c for c in classes):
                    drug_type = "Kháng sinh"
                    unit = "lọ"
            elif any(w in lower_text for w in ("lọ", "ống", "tiêm", "truyền")):
                unit = "lọ" if "lọ" in lower_text else "ống"
            elif "chai" in lower_text:
                unit = "chai"
            elif "gói" in lower_text:
                unit = "gói"

            return {
                "name": name_clean,
                "type": drug_type,
                "unit": unit,
                "keywords": [primary_drug.lower(), name_clean.lower()]
            }

        # Check SĐK code format
        sdk = matcher.extract_sdk(lower_text)
        if sdk:
            return {
                "name": f"Dược phẩm SĐK {sdk}",
                "type": "Thuốc điều trị chuyên khoa",
                "unit": "viên",
                "keywords": [sdk.lower()]
            }
    except Exception:
        pass

    return None

def find_matched_eq(lower_text: str):
    for d in DEVICE_CATALOG:
        for alias in d["aliases"]:
            if alias in lower_text:
                return d

    # Dynamic generalized equipment recognition for hospital devices
    equipment_patterns = [
        (r"\bmáy thở\b", "Máy thở Hồi sức Cấp cứu", "Ventilator System", "D"),
        (r"\bmáy sốc tim\b|\bphá rung\b", "Máy sốc tim & Phá rung", "Biphasic Defibrillator", "D"),
        (r"\bmáy lọc máu\b|\bcrrt\b", "Hệ thống lọc máu liên tục", "Continuous Hemodiafiltration", "D"),
        (r"\bbơm tiêm điện\b|\bperfusor\b", "Bơm tiêm điện chính xác", "Precision Syringe Pump", "C"),
        (r"\bmáy truyền dịch\b|\binfusomat\b", "Máy truyền dịch tự động", "Volumetric Infusion Pump", "C"),
        (r"\bmonitor\b|\bmáy theo dõi\b", "Máy theo dõi bệnh nhân đa thông số", "Multi-parameter Patient Monitor", "C"),
        (r"\bmáy đo khí máu\b|\bkhí máu\b", "Máy phân tích khí máu động mạch", "Blood Gas Analyzer", "C"),
        (r"\bmáy điện tim\b|\becg\b", "Máy ghi điện tim đa kênh", "Electrocardiograph (ECG)", "B"),
        (r"\bmáy hút dịch\b", "Máy hút dịch áp lực âm", "Suction Unit", "B"),
    ]
    for pattern, name, model, risk in equipment_patterns:
        if re.search(pattern, lower_text):
            dev_hash = abs(hash(lower_text)) % 9000 + 1000
            return {
                "name": name,
                "model": model,
                "serial": f"EQ-AUTO-{dev_hash}",
                "risk": risk,
                "aliases": [name.lower()]
            }
    return None
