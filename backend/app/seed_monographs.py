"""
Trích xuất và nạp Chuyên luận lâm sàng Dược thư Quốc gia (<=200 LOC)
"""
import os
import re
import json
import gzip
import sqlite3

def sanitize_title(title: str | None, inn: str) -> str:
    if not title or not title.strip():
        return inn.upper()
    t = title.strip()
    bad = ("quá trình", "điều trị", "tham khảo", "huyết thanh", "bảo hiểm", "chứa", "creatinin", "mẫn cảm")
    return inn.upper() if t.endswith(".") or any(b in t.lower() for b in bad) or len(t.split()) > 6 else t

def find_monographs_source() -> str | None:
    candidates = (
        "/app/data/knowledge_base/dtqg_monographs_extracted.json",
        "data/knowledge_base/dtqg_monographs_extracted.json",
        "backend/data/knowledge_base/dtqg_monographs_extracted.json",
        "../data/knowledge_base/dtqg_monographs_extracted.json",
        "../../backend/data/knowledge_base/dtqg_monographs_extracted.json",
    )
    for c in candidates:
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def seed_clinical_monographs(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clinical_drug_monographs (
        id TEXT PRIMARY KEY,
        inn TEXT NOT NULL,
        title TEXT,
        atc_code TEXT,
        drug_class TEXT,
        dosage_forms TEXT,
        indications TEXT,
        contraindications TEXT,
        precautions TEXT,
        pregnancy_warning TEXT,
        adverse_effects TEXT,
        adult_dosage TEXT,
        pediatric_dosage TEXT,
        renal_adjustment TEXT,
        hepatic_adjustment TEXT,
        drug_interactions TEXT,
        overdose_treatment TEXT,
        antidote TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_inn ON clinical_drug_monographs(inn)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_atc ON clinical_drug_monographs(atc_code)")

    src = find_monographs_source()
    if not src:
        print("⚠️ Không tìm thấy dtqg_monographs_extracted.json")
        cursor.execute("SELECT COUNT(*) FROM clinical_drug_monographs")
        return cursor.fetchone()[0]

    try:
        with open(src, "r", encoding="utf-8") as f:
            monos = json.load(f)
        registry_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vietnam_drug_registry/dav_essential_formulary.json"))
        registry_items = []
        if registry_path and os.path.exists(registry_path):
            with open(registry_path, "r", encoding="utf-8") as f:
                registry_items = json.load(f)

        monographs_by_id = {m.get("id"): m for m in monos if m.get("id")}
        for item in registry_items:
            monograph_id = item.get("clinicalMonographId") or item.get("clinical_monograph_id")
            if not monograph_id or monograph_id in monographs_by_id:
                continue
            monographs_by_id[monograph_id] = {
                "id": monograph_id,
                "inn": item.get("activeIngredient", ""),
                "title": item.get("brandName", ""),
                "atc_code": item.get("atcCode") or item.get("atc_code"),
                "drug_class": item.get("drugClass") or item.get("drug_class"),
                "dosage_forms": item.get("dosageForm") or item.get("dosage_form"),
                "indications": item.get("indications"),
                "contraindications": item.get("contraindications"),
                "precautions": item.get("precautions"),
                "pregnancy_warning": item.get("pregnancyWarning") or item.get("pregnancy_warning"),
                "adverse_effects": item.get("adverseEffects") or item.get("adverse_effects"),
                "adult_dosage": item.get("adultDosage") or item.get("adult_dosage"),
                "pediatric_dosage": item.get("pediatricDosage") or item.get("pediatric_dosage"),
                "renal_adjustment": item.get("renalAdjustment") or item.get("renal_adjustment"),
                "hepatic_adjustment": item.get("hepaticAdjustment") or item.get("hepatic_adjustment"),
                "drug_interactions": item.get("drugInteractions") or item.get("drug_interactions"),
                "overdose_treatment": item.get("overdoseTreatment") or item.get("overdose_treatment"),
                "antidote": item.get("antidote"),
                "source": item.get("clinicalSource") or item.get("clinical_source"),
            }
        monos_dict = {m.get("id"): m for m in monos if m.get("id")}
        monos_dict.update(monographs_by_id)
        monos = list(monos_dict.values()) + [m for m in monos if not m.get("id")]
        rows = []
        for idx, m in enumerate(monos, 1):
            inn = m.get("inn", "")
            m_id = m.get("id") or f"DTQG-{idx:04d}-{re.sub(r'[^a-zA-Z0-9]', '', inn)[:20]}"
            src_val = m.get("source") or ""
            if "Trang " not in src_val and m.get("start_page"):
                src_val = f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {m.get('start_page')}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
            elif not src_val:
                src_val = "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
            rows.append((
                m_id, inn, sanitize_title(m.get("title"), inn), m.get("atc_code"), m.get("drug_class"),
                m.get("dosage_forms"), m.get("indications"), m.get("contraindications"),
                m.get("precautions"), m.get("pregnancy_warning"), m.get("adverse_effects"),
                m.get("adult_dosage"), m.get("pediatric_dosage"), m.get("renal_adjustment"),
                m.get("hepatic_adjustment"), m.get("drug_interactions"), m.get("overdose_treatment"),
                m.get("antidote"),
                src_val
            ))
        cursor.execute("BEGIN TRANSACTION")
        cursor.executemany("""
        INSERT OR REPLACE INTO clinical_drug_monographs
        (id, inn, title, atc_code, drug_class, dosage_forms, indications, contraindications, precautions, pregnancy_warning, adverse_effects, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, drug_interactions, overdose_treatment, antidote, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()
        # Đồng bộ các stub cũ với chuyên luận đầy đủ DTQG-0XXX
        stubs = cursor.execute("SELECT id, inn FROM clinical_drug_monographs WHERE id LIKE 'DTQG-2015-%' OR id LIKE 'DTQG-2022-%'").fetchall()
        clinical_cols = ['atc_code', 'drug_class', 'dosage_forms', 'indications', 'contraindications', 'precautions', 'pregnancy_warning', 'adverse_effects', 'adult_dosage', 'pediatric_dosage', 'renal_adjustment', 'hepatic_adjustment', 'drug_interactions', 'overdose_treatment', 'antidote', 'source']
        for stub_id, inn in stubs:
            clean_inn = re.sub(r'\(.*?\)', '', inn).strip()
            matches = cursor.execute("SELECT id, length(coalesce(indications,'')) + length(coalesce(adult_dosage,'')) FROM clinical_drug_monographs WHERE id LIKE 'DTQG-0%' AND lower(inn) LIKE ?", (f"%{clean_inn.lower()}%",)).fetchall()
            if matches:
                best_mid = max(matches, key=lambda x: x[1])[0]
                best_data = cursor.execute(f"SELECT {', '.join(clinical_cols)} FROM clinical_drug_monographs WHERE id = ?", (best_mid,)).fetchone()
                set_clause = ', '.join([f"{c} = COALESCE(?, {c})" for c in clinical_cols])
                cursor.execute(f"UPDATE clinical_drug_monographs SET {set_clause} WHERE id = ?", (*best_data, stub_id))
        conn.commit()

        # 1. Liên kết Monograph cực nhanh bằng đối soát bộ nhớ O(1)
        cursor.execute("SELECT id, inn, title FROM clinical_drug_monographs ORDER BY length(coalesce(indications, '')) + length(coalesce(adult_dosage, '')) DESC")
        monos_for_link = cursor.fetchall()
        mono_by_inn = {}
        for mid, minn, mtitle in monos_for_link:
            if minn:
                k = re.sub(r"\(.*?\)", "", minn).strip().lower()
                if k and k not in mono_by_inn:
                    mono_by_inn[k] = mid
            if mtitle:
                k = mtitle.strip().lower()
                if k and k not in mono_by_inn:
                    mono_by_inn[k] = mid

        cursor.execute("SELECT id, active_ingredient, brand_name FROM dav_national_drugs WHERE clinical_monograph_id IS NULL")
        drugs_to_link = cursor.fetchall()

        link_updates = []
        for did, act, brnd in drugs_to_link:
            chosen_id = None
            if act:
                clean_act = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị).*$", "", act.split(";")[0].split("+")[0], flags=re.IGNORECASE).strip().lower()
                clean_act = re.sub(r"\(.*?\)", "", clean_act).strip()
                if clean_act in mono_by_inn:
                    chosen_id = mono_by_inn[clean_act]
            if not chosen_id and brnd:
                clean_brnd = brnd.strip().lower()
                if clean_brnd in mono_by_inn:
                    chosen_id = mono_by_inn[clean_brnd]
            if chosen_id:
                link_updates.append((chosen_id, did))

        if link_updates:
            cursor.executemany("UPDATE dav_national_drugs SET clinical_monograph_id = ? WHERE id = ?", link_updates)
            conn.commit()

        # 2. Cập nhật đồng loạt các trường lâm sàng từ chuyên luận (Batch Update)
        cursor.execute("""
            UPDATE dav_national_drugs
            SET
                atc_code = COALESCE(NULLIF(dav_national_drugs.atc_code, ''), (SELECT atc_code FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                drug_class = COALESCE(NULLIF(dav_national_drugs.drug_class, ''), (SELECT drug_class FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                indications = COALESCE(NULLIF(dav_national_drugs.indications, ''), (SELECT indications FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                contraindications = COALESCE(NULLIF(dav_national_drugs.contraindications, ''), (SELECT contraindications FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                precautions = COALESCE(NULLIF(dav_national_drugs.precautions, ''), (SELECT precautions FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                pregnancy_warning = COALESCE(NULLIF(dav_national_drugs.pregnancy_warning, ''), (SELECT pregnancy_warning FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                adult_dosage = COALESCE(NULLIF(dav_national_drugs.adult_dosage, ''), (SELECT adult_dosage FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                pediatric_dosage = COALESCE(NULLIF(dav_national_drugs.pediatric_dosage, ''), (SELECT pediatric_dosage FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                renal_adjustment = COALESCE(NULLIF(dav_national_drugs.renal_adjustment, ''), (SELECT renal_adjustment FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                hepatic_adjustment = COALESCE(NULLIF(dav_national_drugs.hepatic_adjustment, ''), (SELECT hepatic_adjustment FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                adverse_effects = COALESCE(NULLIF(dav_national_drugs.adverse_effects, ''), (SELECT adverse_effects FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                drug_interactions = COALESCE(NULLIF(dav_national_drugs.drug_interactions, ''), (SELECT drug_interactions FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                overdose_treatment = COALESCE(NULLIF(dav_national_drugs.overdose_treatment, ''), (SELECT overdose_treatment FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                antidote = COALESCE(NULLIF(dav_national_drugs.antidote, ''), (SELECT antidote FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                clinical_source = COALESCE(NULLIF(dav_national_drugs.clinical_source, ''), (SELECT source FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id))
            WHERE clinical_monograph_id IS NOT NULL
        """)
        conn.commit()
        print(f"✅ Đã nạp {len(rows)} chuyên luận Dược Thư 2015 vào clinical_drug_monographs!")
        return len(rows)
    except Exception as e:
        print(f"Lỗi khi nạp chuyên luận Dược Thư: {e}")
        return 0
