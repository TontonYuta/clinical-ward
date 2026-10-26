#!/usr/bin/env python3
"""
Migrate and enrich clinical drug knowledge from Dược Thư Quốc Gia into clinical_hospital.db.
- Creates clinical_drug_monographs table
- Adds clinical columns to dav_national_drugs
- Enriches matched drugs with exact clinical data
- Leaves unmatched drugs empty (NULL)
"""

import sqlite3
import json
import re
import time
import os

DB_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/clinical_hospital.db"
JSON_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/dtqg_monographs_extracted.json"

CLINICAL_COLS = [
    ("atc_code", "TEXT"),
    ("drug_class", "TEXT"),
    ("indications", "TEXT"),
    ("contraindications", "TEXT"),
    ("precautions", "TEXT"),
    ("pregnancy_warning", "TEXT"),
    ("adult_dosage", "TEXT"),
    ("pediatric_dosage", "TEXT"),
    ("renal_adjustment", "TEXT"),
    ("hepatic_adjustment", "TEXT"),
    ("adverse_effects", "TEXT"),
    ("drug_interactions", "TEXT"),
    ("overdose_treatment", "TEXT"),
    ("antidote", "TEXT"),
    ("clinical_source", "TEXT"),
    ("clinical_monograph_id", "TEXT")
]

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    return re.sub(r'[\s\-_]+', ' ', text)

def main():
    t0 = time.time()
    print("Connecting to database:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Create clinical_drug_monographs table
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
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_inn ON clinical_drug_monographs(inn);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_atc ON clinical_drug_monographs(atc_code);")

    # 2. Load JSON monographs
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        monographs = json.load(f)
    print(f"Loaded {len(monographs)} monographs from {JSON_PATH}")

    # Insert / Replace into clinical_drug_monographs
    for idx, m in enumerate(monographs, 1):
        m_id = f"DTQG-{idx:04d}-{re.sub(r'[^a-zA-Z0-9]', '', m['inn'])[:20]}"
        m["id"] = m_id
        cursor.execute("""
        INSERT OR REPLACE INTO clinical_drug_monographs (
            id, inn, title, atc_code, drug_class, dosage_forms, indications,
            contraindications, precautions, pregnancy_warning, adverse_effects,
            adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment,
            drug_interactions, overdose_treatment, antidote, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            m_id, m["inn"], m.get("title"), m.get("atc_code"), m.get("drug_class"),
            m.get("dosage_forms"), m.get("indications"), m.get("contraindications"),
            m.get("precautions"), m.get("pregnancy_warning"), m.get("adverse_effects"),
            m.get("adult_dosage"), m.get("pediatric_dosage"), m.get("renal_adjustment"),
            m.get("hepatic_adjustment"), m.get("drug_interactions"), m.get("overdose_treatment"),
            m.get("antidote"), m.get("source")
        ))
    conn.commit()

    # 3. Add clinical columns to dav_national_drugs if missing
    existing_cols = [c[1] for c in cursor.execute("PRAGMA table_info(dav_national_drugs);").fetchall()]
    for col_name, col_type in CLINICAL_COLS:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE dav_national_drugs ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name} ({col_type}) to dav_national_drugs.")
    conn.commit()

    # 4. Build comprehensive lookup index for active ingredient matching
    lookup_map = {}
    for m in monographs:
        inn = m["inn"].strip()
        title = m.get("title") or ""
        
        # Primary INN
        clean_inn = normalize_text(inn)
        if len(clean_inn) >= 3:
            lookup_map[clean_inn] = m
            
        # Title clean
        clean_title = normalize_text(title)
        clean_title = re.sub(r'[\(\)]', ' ', clean_title)
        for part in clean_title.split():
            if len(part) >= 4 and not part.isdigit():
                lookup_map[part] = m
                
        # Extract synonyms in parentheses e.g. (Aspirin), (Vitamin C)
        alt_names = re.findall(r'\(([^\)]+)\)', title)
        for alt in alt_names:
            c_alt = normalize_text(alt)
            if len(c_alt) >= 3:
                lookup_map[c_alt] = m

        # Acid X <-> X acid
        if clean_inn.endswith(' acid'):
            base = clean_inn[:-5].strip()
            lookup_map[f"acid {base}"] = m
            lookup_map[f"axit {base}"] = m
            lookup_map[base] = m
        elif clean_inn.startswith('acid '):
            base = clean_inn[5:].strip()
            lookup_map[f"{base} acid"] = m
            lookup_map[base] = m

        # Spelling variations (-in <-> -ine, -ol <-> -ole, -id <-> -ide)
        variations = []
        for word in [clean_inn]:
            if word.endswith('in'):
                variations.append(word + 'e')
            elif word.endswith('ine'):
                variations.append(word[:-1])
            if word.endswith('ol'):
                variations.append(word + 'e')
            elif word.endswith('ole'):
                variations.append(word[:-1])
            if word.endswith('id'):
                variations.append(word + 'e')
            elif word.endswith('ide'):
                variations.append(word[:-1])
        for v in variations:
            if len(v) >= 4:
                lookup_map[v] = m

    # Sort keys by length descending to match longest specific term first
    sorted_keys = sorted([k for k in lookup_map.keys() if len(k) >= 4], key=len, reverse=True)
    patt = re.compile(r'\b(?:' + '|'.join(re.escape(k) for k in sorted_keys) + r')\b', re.IGNORECASE)
    print(f"Compiled lookup pattern with {len(sorted_keys)} keys.")

    # 5. Fetch all drugs and update matched ones
    rows = cursor.execute("SELECT id, active_ingredient FROM dav_national_drugs").fetchall()
    total_drugs = len(rows)
    print(f"Analyzing and enriching {total_drugs:,} drugs in dav_national_drugs...")

    updates = []
    matched_count = 0
    unmatched_count = 0

    for drug_id, raw_ing in rows:
        ing = (raw_ing or "").strip().lower()
        if not ing or ing in ['--', '-', 'n/a']:
            unmatched_count += 1
            continue
            
        m = patt.search(ing)
        if m:
            matched_key = m.group(0).lower()
            mono = lookup_map.get(matched_key)
            if mono:
                updates.append((
                    mono.get("atc_code"),
                    mono.get("drug_class"),
                    mono.get("indications"),
                    mono.get("contraindications"),
                    mono.get("precautions"),
                    mono.get("pregnancy_warning"),
                    mono.get("adult_dosage"),
                    mono.get("pediatric_dosage"),
                    mono.get("renal_adjustment"),
                    mono.get("hepatic_adjustment"),
                    mono.get("adverse_effects"),
                    mono.get("drug_interactions"),
                    mono.get("overdose_treatment"),
                    mono.get("antidote"),
                    mono.get("source"),
                    mono.get("id"),
                    drug_id
                ))
                matched_count += 1
                continue
        unmatched_count += 1

    print(f"Matched {matched_count:,} drugs. Executing batch update in DB...")
    cursor.executemany("""
    UPDATE dav_national_drugs SET
        atc_code = ?,
        drug_class = ?,
        indications = ?,
        contraindications = ?,
        precautions = ?,
        pregnancy_warning = ?,
        adult_dosage = ?,
        pediatric_dosage = ?,
        renal_adjustment = ?,
        hepatic_adjustment = ?,
        adverse_effects = ?,
        drug_interactions = ?,
        overdose_treatment = ?,
        antidote = ?,
        clinical_source = ?,
        clinical_monograph_id = ?
    WHERE id = ?;
    """, updates)
    conn.commit()

    # Create indexes on clinical fields
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_drugs_atc ON dav_national_drugs(atc_code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_drugs_mono_id ON dav_national_drugs(clinical_monograph_id);")
    conn.commit()
    conn.close()

    elapsed = time.time() - t0
    print("="*60)
    print("ENRICHMENT SUMMARY")
    print("="*60)
    print(f"Total drugs in DB: {total_drugs:,}")
    print(f"Enriched with Clinical Dược Thư data: {matched_count:,} ({matched_count/total_drugs*100:.2f}%)")
    print(f"Left empty / NULL (chưa có thông tin): {unmatched_count:,} ({unmatched_count/total_drugs*100:.2f}%)")
    print(f"Total time elapsed: {elapsed:.2f}s")

if __name__ == "__main__":
    main()
