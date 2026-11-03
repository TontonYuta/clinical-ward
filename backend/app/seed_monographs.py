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
        monos = list(monos) + [m for m in monographs_by_id.values() if m.get("id")]
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

        cursor.execute("""
            UPDATE dav_national_drugs
            SET clinical_monograph_id = (
                SELECT m.id FROM clinical_drug_monographs m
                WHERE lower(dav_national_drugs.active_ingredient) LIKE lower(m.inn) || '%'
                   OR lower(dav_national_drugs.brand_name) = lower(m.inn)
                ORDER BY length(coalesce(m.indications, '')) + length(coalesce(m.adult_dosage, '')) DESC
                LIMIT 1
            )
            WHERE clinical_monograph_id IS NULL
              AND EXISTS (
                SELECT 1 FROM clinical_drug_monographs m
                WHERE lower(dav_national_drugs.active_ingredient) LIKE lower(m.inn) || '%'
                   OR lower(dav_national_drugs.brand_name) = lower(m.inn)
            )
        """)
        conn.commit()
        active_ids = {row[0] for row in cursor.execute("SELECT id FROM clinical_drug_monographs")}
        for drug in cursor.execute("SELECT id, clinical_monograph_id FROM dav_national_drugs").fetchall():
            drug_id, monograph_id = drug
            if monograph_id not in active_ids:
                continue
            monograph = cursor.execute(
                "SELECT atc_code, drug_class, indications, contraindications, precautions, pregnancy_warning, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, adverse_effects, drug_interactions, overdose_treatment, antidote, source FROM clinical_drug_monographs WHERE id = ?",
                (monograph_id,),
            ).fetchone()
            if not monograph:
                continue
            fields = ("atc_code", "drug_class", "indications", "contraindications", "precautions", "pregnancy_warning", "adult_dosage", "pediatric_dosage", "renal_adjustment", "hepatic_adjustment", "adverse_effects", "drug_interactions", "overdose_treatment", "antidote", "clinical_source")
            updates = {name: value for name, value in zip(fields, monograph) if value}
            if updates:
                assignment = ", ".join(f"{name} = COALESCE(NULLIF({name}, ''), ?)" for name in updates)
                cursor.execute(f"UPDATE dav_national_drugs SET {assignment} WHERE id = ?", (*updates.values(), drug_id))
        conn.commit()
        print(f"✅ Đã nạp {len(rows)} chuyên luận Dược Thư 2015 vào clinical_drug_monographs!")
        return len(rows)
    except Exception as e:
        print(f"Lỗi khi nạp chuyên luận Dược Thư: {e}")
        return 0
