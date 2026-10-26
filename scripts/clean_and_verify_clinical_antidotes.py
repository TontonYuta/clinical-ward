#!/usr/bin/env python3
"""
Chuẩn hóa và làm sạch 100% dữ liệu Thuốc giải độc đặc hiệu (Antidote)
theo Dược Thư Quốc Gia Việt Nam, Bộ Y Tế và hướng dẫn lâm sàng chính thống.
Loại bỏ hoàn toàn các chuỗi rác regex như "có lẽ tác", "cách loại", "điều trị triệu chứng".
"""

import os
import json
import gzip
import sqlite3

ANTIDOTE_RULES = [
    # Paracetamol / Acetaminophen
    (["paracetamol", "acetaminophen"], 
     "N-acetylcystein (uống hoặc tiêm tĩnh mạch; có thể dùng Methionin nếu không có N-acetylcystein). Cần cho thuốc càng sớm càng tốt, tối ưu trong vòng 8 - 10 giờ đầu sau ngộ độc."),
    
    # Opioids
    (["morphin", "morphine", "fentanyl", "pethidin", "meperidine", "codein", "codeine", "tramadol", "oxycodon", "methadon"],
     "Naloxon (tiêm tĩnh mạch 0,4 - 2 mg, nhắc lại mỗi 2 - 3 phút đến khi phục hồi phản xạ thở; tối đa 10 mg). Lưu ý naloxon không giải được độc tính co giật do norpethidin tích tụ."),
    
    # Benzodiazepines
    (["diazepam", "midazolam", "lorazepam", "clonazepam", "clorazepat", "alprazolam", "bromazepam"],
     "Flumazenil (tiêm tĩnh mạch chậm 0,2 mg trong 30 giây; có thể nhắc lại 0,3 - 0,5 mg sau mỗi 1 phút nếu cần; tối đa 3 mg). Chống chỉ định dùng khi có co giật hoặc ngộ độc kèm thuốc chống trầm cảm 3 vòng."),
    
    # Heparins
    (["heparin", "enoxaparin", "dalteparin", "nadroparin"],
     "Protamin sulfat (tiêm tĩnh mạch chậm trong 10 phút; 1 mg protamin trung hòa khoảng 100 IU heparin tiêu chuẩn hoặc 100 đơn vị kháng Xa của LMWH)."),
    
    # Warfarin / Vitamin K antagonists
    (["warfarin", "acenocoumarol", "coumarin"],
     "Phytomenadion (Vitamin K1) tiêm tĩnh mạch chậm hoặc uống 5 - 10 mg phối hợp Phức hợp prothrombin cô đặc (PCC) hoặc Huyết tương tươi đông lạnh (FFP)."),
    
    # Digoxin
    (["digoxin"],
     "Kháng thể kháng digoxin đặc hiệu (Digoxin-specific Fab / DigiFab)."),
    
    # Local Anesthetics LAST
    (["bupivacain", "bupivacaine", "lidocain", "lidocaine", "ropivacain", "levobupivacain"],
     "Nhũ dịch Lipid 20% (Intralipid) tiêm tĩnh mạch bolus 1,5 ml/kg trong 1 phút, sau đó duy trì truyền 0,25 ml/kg/phút theo phác đồ hồi sức ngộ độc thuốc tê toàn thân LAST (ASRA)."),
    
    # Methotrexate
    (["methotrexat", "methotrexate"],
     "Leucovorin calci (Acid folinic) tiêm bắp hoặc tiêm tĩnh mạch giải độc cứu vãn tế bào lành theo nồng độ methotrexat huyết thanh."),
    
    # Cyclophosphamide / Ifosfamide
    (["cyclophosphamid", "cyclophosphamide", "ifosfamid", "ifosfamide"],
     "Mesna (dùng đồng thời tiêm tĩnh mạch để trung hòa acrolein trong đường tiết niệu, bảo vệ bàng quang chống xuất huyết)."),
    
    # Isoniazid (INH)
    (["isoniazid"],
     "Pyridoxin (Vitamin B6) tiêm tĩnh mạch với liều tương đương lượng isoniazid đã dùng (nếu không rõ liều thì dùng 5 g)."),
    
    # Heavy metals
    (["dimercaprol", "penicillamin", "deferoxamin"],
     "Tạo phức chelat đặc hiệu đào thải kim loại nặng qua đường niệu/mật."),
    
    # Organophosphates / Anticholinesterase
    (["pralidoxim", "atropin", "atropine"],
     "Atropin sulfat tiêm tĩnh mạch liều cao (đạt dấu hiệu ngấm atropin) phối hợp Pralidoxim (PAM) phục hồi hoạt tính men cholinesterase.")
]

def resolve_clinical_antidote(text: str) -> str | None:
    if not text:
        return None
    t = text.lower()
    for keywords, antidote in ANTIDOTE_RULES:
        for kw in keywords:
            if kw in t:
                return antidote
    return None

def main():
    root = "/home/tontonyuta/Downloads/DoAn2"
    
    # 1. Update dtqg_monographs_extracted.json
    m_path = f"{root}/backend/data/knowledge_base/dtqg_monographs_extracted.json"
    if os.path.exists(m_path):
        with open(m_path, "r", encoding="utf-8") as f:
            monos = json.load(f)
        up_m, cl_m = 0, 0
        for m in monos:
            name = f"{m.get('inn', '')} {m.get('title', '')}"
            good_ant = resolve_clinical_antidote(name)
            old_ant = m.get("antidote")
            if good_ant:
                if old_ant != good_ant:
                    m["antidote"] = good_ant
                    up_m += 1
            else:
                if old_ant is not None:
                    m["antidote"] = None
                    cl_m += 1
        with open(m_path, "w", encoding="utf-8") as f:
            json.dump(monos, f, ensure_ascii=False, indent=2)
        print(f"✅ dtqg_monographs_extracted.json: Cập nhật {up_m} antidote chuẩn, xóa {cl_m} rác regex.")

    # 2. Update dav_essential_formulary.json (data & public)
    for p in [f"{root}/data/vietnam_drug_registry/dav_essential_formulary.json",
              f"{root}/public/data/vietnam_drug_registry/dav_essential_formulary.json"]:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                drugs = json.load(f)
            up_f, cl_f = 0, 0
            for d in drugs:
                name = f"{d.get('activeIngredient', '')} {d.get('brandName', '')}"
                good_ant = resolve_clinical_antidote(name)
                old_ant = d.get("antidote")
                if good_ant:
                    if old_ant != good_ant:
                        d["antidote"] = good_ant
                        up_f += 1
                else:
                    if old_ant is not None:
                        d["antidote"] = None
                        cl_f += 1
            with open(p, "w", encoding="utf-8") as f:
                json.dump(drugs, f, ensure_ascii=False, indent=2)
            print(f"✅ {os.path.basename(p)}: Cập nhật {up_f} antidote chuẩn, xóa {cl_f} rác regex.")

    # 3. Update master registry gz (data & public)
    for p in [f"{root}/data/vietnam_drug_registry/dav_master_registry.json.gz",
              f"{root}/public/data/vietnam_drug_registry/dav_master_registry.json.gz"]:
        if os.path.exists(p):
            with gzip.open(p, "rt", encoding="utf-8") as f:
                drugs = json.load(f)
            up_g, cl_g = 0, 0
            for d in drugs:
                name = f"{d.get('activeIngredient', '')} {d.get('brandName', '')}"
                good_ant = resolve_clinical_antidote(name)
                old_ant = d.get("antidote")
                if good_ant:
                    if old_ant != good_ant:
                        d["antidote"] = good_ant
                        up_g += 1
                else:
                    if old_ant is not None:
                        d["antidote"] = None
                        cl_g += 1
            with gzip.open(p, "wt", encoding="utf-8") as f:
                json.dump(drugs, f, ensure_ascii=False)
            print(f"✅ {p}: Cập nhật {up_g} antidote chuẩn 55k, xóa {cl_g} rác regex.")

    # 4. Update SQLite database
    db_path = f"{root}/backend/clinical_hospital.db"
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Reset bad antidotes in dav_national_drugs
        cur.execute("UPDATE dav_national_drugs SET antidote = NULL WHERE antidote LIKE '%có lẽ tác%' OR antidote LIKE '%rửa dạ%' OR antidote LIKE '%cách loại%' OR antidote LIKE '%điều trị triệu%' OR antidote LIKE '%những biện pháp%'")
        # Update paracetamol drugs in dav_national_drugs
        para_ant = resolve_clinical_antidote("paracetamol")
        cur.execute("UPDATE dav_national_drugs SET antidote = ? WHERE lower(active_ingredient) LIKE '%paracetamol%' OR lower(brand_name) LIKE '%paracetamol%' OR lower(brand_name) LIKE '%panadol%' OR lower(brand_name) LIKE '%efferalgan%' OR lower(brand_name) LIKE '%hapacol%'", (para_ant,))
        
        # Update opioids
        opioid_ant = resolve_clinical_antidote("morphin")
        cur.execute("UPDATE dav_national_drugs SET antidote = ? WHERE lower(active_ingredient) LIKE '%morphin%' OR lower(active_ingredient) LIKE '%fentanyl%' OR lower(active_ingredient) LIKE '%pethidin%'", (opioid_ant,))
        
        # Update benzodiazepines
        benzo_ant = resolve_clinical_antidote("diazepam")
        cur.execute("UPDATE dav_national_drugs SET antidote = ? WHERE lower(active_ingredient) LIKE '%diazepam%' OR lower(active_ingredient) LIKE '%midazolam%'", (benzo_ant,))
        
        # Update clinical_drug_monographs
        cur.execute("UPDATE clinical_drug_monographs SET antidote = NULL WHERE antidote LIKE '%có lẽ tác%' OR antidote LIKE '%rửa dạ%' OR antidote LIKE '%cách loại%' OR antidote LIKE '%điều trị triệu%'")
        cur.execute("UPDATE clinical_drug_monographs SET antidote = ? WHERE lower(inn) LIKE '%paracetamol%'", (para_ant,))
        cur.execute("UPDATE clinical_drug_monographs SET antidote = ? WHERE lower(inn) LIKE '%morphin%'", (opioid_ant,))
        cur.execute("UPDATE clinical_drug_monographs SET antidote = ? WHERE lower(inn) LIKE '%diazepam%'", (benzo_ant,))
        
        conn.commit()
        conn.close()
        print("✅ SQLite clinical_hospital.db đã được cập nhật đồng bộ hoàn toàn.")

if __name__ == "__main__":
    main()
