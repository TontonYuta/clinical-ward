"""
Trích xuất và nạp Chuyên luận lâm sàng Dược thư Quốc gia (<=200 LOC)
"""
import os
import re
import json
import gzip
import sqlite3
from app.services.active_ingredient_normalizer import extract_candidate_inns, clean_key

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
        pharmacodynamics TEXT,
        pharmacokinetics TEXT,
        indications TEXT,
        contraindications TEXT,
        precautions TEXT,
        pregnancy_warning TEXT,
        lactation_warning TEXT,
        adverse_effects TEXT,
        adr_management TEXT,
        adult_dosage TEXT,
        pediatric_dosage TEXT,
        renal_adjustment TEXT,
        hepatic_adjustment TEXT,
        drug_interactions TEXT,
        incompatibilities TEXT,
        storage_stability TEXT,
        overdose_treatment TEXT,
        antidote TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    # Bổ sung các cột mới nếu đã tạo bảng trước đó
    cursor.execute("PRAGMA table_info(clinical_drug_monographs)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    for col in ("pharmacodynamics", "pharmacokinetics", "adr_management", "incompatibilities", "storage_stability", "lactation_warning"):
        if col not in existing_cols:
            cursor.execute(f"ALTER TABLE clinical_drug_monographs ADD COLUMN {col} TEXT")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_inn ON clinical_drug_monographs(inn)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_atc ON clinical_drug_monographs(atc_code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_clinical_monograph_id ON dav_national_drugs(clinical_monograph_id)")

    # Bỏ qua nếu chuyên luận đã được nạp đầy đủ (ngăn ngừa cold-start và OOM trên Render)
    cursor.execute("SELECT count(*) FROM clinical_drug_monographs WHERE pharmacodynamics IS NOT NULL AND length(pharmacodynamics) > 20")
    existing_rich_count = cursor.fetchone()[0]
    if existing_rich_count >= 650:
        return existing_rich_count

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
                m.get("dosage_forms"), m.get("pharmacodynamics"), m.get("pharmacokinetics"),
                m.get("indications"), m.get("contraindications"),
                m.get("precautions"), m.get("pregnancy_warning"), m.get("lactation_warning"),
                m.get("adverse_effects"), m.get("adr_management"),
                m.get("adult_dosage"), m.get("pediatric_dosage"), m.get("renal_adjustment"),
                m.get("hepatic_adjustment"), m.get("drug_interactions"),
                m.get("incompatibilities"), m.get("storage_stability"),
                m.get("overdose_treatment"), m.get("antidote"),
                src_val
            ))
        cursor.execute("BEGIN TRANSACTION")
        cursor.executemany("""
        INSERT OR REPLACE INTO clinical_drug_monographs
        (id, inn, title, atc_code, drug_class, dosage_forms, pharmacodynamics, pharmacokinetics, indications, contraindications, precautions, pregnancy_warning, lactation_warning, adverse_effects, adr_management, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, drug_interactions, incompatibilities, storage_stability, overdose_treatment, antidote, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()
        # Đồng bộ các stub cũ trong clinical_drug_monographs với chuyên luận đầy đủ
        clinical_cols = [
            'atc_code', 'drug_class', 'dosage_forms', 'pharmacodynamics', 'pharmacokinetics',
            'indications', 'contraindications', 'precautions', 'pregnancy_warning', 'lactation_warning',
            'adverse_effects', 'adr_management', 'adult_dosage', 'pediatric_dosage',
            'renal_adjustment', 'hepatic_adjustment', 'drug_interactions', 'incompatibilities',
            'storage_stability', 'overdose_treatment', 'antidote', 'source'
        ]
        # Xây dựng map từ candidate INN -> chuyên luận giàu dữ liệu nhất
        cursor.execute(f"SELECT id, inn, title, {', '.join(clinical_cols)} FROM clinical_drug_monographs WHERE pharmacodynamics IS NOT NULL AND length(pharmacodynamics) > 20")
        rich_monos = cursor.fetchall()
        rich_map = {}
        for r in rich_monos:
            minn = r[1]
            mtitle = r[2]
            cands = extract_candidate_inns(minn or '') + extract_candidate_inns(mtitle or '')
            for cand in cands:
                k = clean_key(cand)
                if k:
                    cur_score = len(r[6] or '') + len(r[8] or '')
                    if k not in rich_map:
                        rich_map[k] = r
                    else:
                        existing_score = len(rich_map[k][6] or '') + len(rich_map[k][8] or '')
                        if cur_score > existing_score:
                            rich_map[k] = r

        stubs = cursor.execute("SELECT id, inn, title FROM clinical_drug_monographs WHERE pharmacodynamics IS NULL OR length(pharmacodynamics) <= 20").fetchall()
        for sid, sinn, stitle in stubs:
            best_row = None
            for text in (sinn, stitle):
                if not text:
                    continue
                for cand in extract_candidate_inns(text):
                    k = clean_key(cand)
                    if k in rich_map:
                        best_row = rich_map[k]
                        break
                if best_row:
                    break
            if best_row:
                vals = list(best_row[3:])
                set_clause = ', '.join([f"{col} = COALESCE(?, {col})" for col in clinical_cols])
                cursor.execute(f"UPDATE clinical_drug_monographs SET {set_clause} WHERE id = ?", (*vals, sid))
        conn.commit()

        # 1. Liên kết Monograph bằng Active Ingredient Normalizer (bóc tách muối, nồng độ, từ đồng nghĩa INN)
        cursor.execute("SELECT id, inn, title FROM clinical_drug_monographs ORDER BY length(coalesce(pharmacodynamics, '')) + length(coalesce(indications, '')) + length(coalesce(adult_dosage, '')) DESC")
        monos_for_link = cursor.fetchall()
        mono_by_key = {}
        for mid, minn, mtitle in monos_for_link:
            if minn:
                k = clean_key(minn)
                if k and k not in mono_by_key:
                    mono_by_key[k] = mid
                for part in re.findall(r"\((.*?)\)", minn):
                    pk = clean_key(part)
                    if pk and pk not in mono_by_key:
                        mono_by_key[pk] = mid
            if mtitle:
                k = clean_key(mtitle)
                if k and k not in mono_by_key:
                    mono_by_key[k] = mid

        cursor.execute("SELECT id, active_ingredient, brand_name FROM dav_national_drugs WHERE clinical_monograph_id IS NULL")
        drugs_to_link = cursor.fetchall()

        link_updates = []
        for did, act, brnd in drugs_to_link:
            chosen_id = None
            if act:
                candidates = extract_candidate_inns(act)
                for cand in candidates:
                    k = clean_key(cand)
                    if k in mono_by_key:
                        chosen_id = mono_by_key[k]
                        break
            if not chosen_id and brnd:
                k_brnd = clean_key(brnd)
                if k_brnd in mono_by_key:
                    chosen_id = mono_by_key[k_brnd]
            if chosen_id:
                link_updates.append((chosen_id, did))

        if link_updates:
            cursor.executemany("UPDATE dav_national_drugs SET clinical_monograph_id = ? WHERE id = ?", link_updates)
            conn.commit()

        # 2. Cập nhật nhẹ các trường chỉ mục danh mục (ATC, nhóm dược lý, nguồn trích dẫn)
        # Các trường văn bản lớn (Dược lực, Dược động, Liều dùng, ADR...) được enrich động tức thì qua clinical_monograph_id
        # nhằm bảo toàn dung lượng SQLite < 80MB và ngăn chặn OOM / tràn ổ đĩa trên Render Free Tier.
        cursor.execute("""
            UPDATE dav_national_drugs
            SET
                atc_code = COALESCE(NULLIF(dav_national_drugs.atc_code, ''), (SELECT atc_code FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                drug_class = COALESCE(NULLIF(dav_national_drugs.drug_class, ''), (SELECT drug_class FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id)),
                clinical_source = COALESCE(NULLIF(dav_national_drugs.clinical_source, ''), (SELECT source FROM clinical_drug_monographs WHERE id = dav_national_drugs.clinical_monograph_id))
            WHERE clinical_monograph_id IS NOT NULL AND (atc_code IS NULL OR atc_code = '' OR drug_class IS NULL OR drug_class = '')
        """)
        conn.commit()
        print(f"✅ Đã nạp {len(rows)} chuyên luận Dược Thư 2015 vào clinical_drug_monographs!")
        return len(rows)
    except Exception as e:
        print(f"Lỗi khi nạp chuyên luận Dược Thư: {e}")
        return 0
