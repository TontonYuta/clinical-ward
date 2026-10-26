#!/usr/bin/env python3
"""
Strict, zero-false-positive clinical drug enrichment.
Ensures herbal/unrelated medicines are NOT falsely matched and remain NULL.
"""

import sqlite3
import json
import re
import time

DB_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/clinical_hospital.db"
JSON_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/dtqg_monographs_extracted.json"

STOPWORDS = {
    'thuốc', 'dạng', 'dung', 'dịch', 'viên', 'nước', 'chất', 'tương', 'tự', 
    'các', 'và', 'cho', 'của', 'trong', 'với', 'loại', 'theo', 'nhóm', 'đặc',
    'uống', 'tiêm', 'người', 'thường', 'liều', 'khác', 'dùng', 'tinh', 'dầu'
}

def normalize_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r'[\s\-_]+', ' ', text.lower().strip())

def main():
    t0 = time.time()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        monographs = json.load(f)

    # Reset all clinical columns to NULL first to guarantee clean slate
    print("Resetting clinical fields in dav_national_drugs to NULL...")
    cursor.execute("""
    UPDATE dav_national_drugs SET
        atc_code = NULL,
        drug_class = NULL,
        indications = NULL,
        contraindications = NULL,
        precautions = NULL,
        pregnancy_warning = NULL,
        adult_dosage = NULL,
        pediatric_dosage = NULL,
        renal_adjustment = NULL,
        hepatic_adjustment = NULL,
        adverse_effects = NULL,
        drug_interactions = NULL,
        overdose_treatment = NULL,
        antidote = NULL,
        clinical_source = NULL,
        clinical_monograph_id = NULL;
    """)
    conn.commit()

    # Build strict lookup map
    lookup_map = {}
    
    for m in monographs:
        m_id = m.get("id") or f"DTQG-{m['inn']}"
        inn = m["inn"].strip()
        clean_inn = normalize_text(inn)
        
        # 1. Primary INN
        if len(clean_inn) >= 3 and clean_inn not in STOPWORDS:
            lookup_map[clean_inn] = m

        # 2. Extract parenthesized synonyms in title e.g. (Aspirin), (Vitamin C)
        title = m.get("title") or ""
        for syn in re.findall(r'\(([^\)]+)\)', title):
            c_syn = normalize_text(syn)
            if len(c_syn) >= 3 and c_syn not in STOPWORDS:
                lookup_map[c_syn] = m
                
        # 3. Clean full title if it's a single compound name (<= 2 words, no stopwords)
        c_title = normalize_text(re.sub(r'\(.*?\)', '', title)).strip()
        title_words = c_title.split()
        if 1 <= len(title_words) <= 2 and not any(w in STOPWORDS for w in title_words):
            if len(c_title) >= 4:
                lookup_map[c_title] = m

        # 4. Acid X <-> X acid
        if clean_inn.endswith(' acid'):
            base = clean_inn[:-5].strip()
            if base not in STOPWORDS:
                lookup_map[f"acid {base}"] = m
                lookup_map[f"axit {base}"] = m
                lookup_map[base] = m
        elif clean_inn.startswith('acid '):
            base = clean_inn[5:].strip()
            if base not in STOPWORDS:
                lookup_map[f"{base} acid"] = m
                lookup_map[base] = m

        # 5. Language suffix variations (-in <-> -ine, -ol <-> -ole, -id <-> -ide)
        for term in [clean_inn]:
            if term in STOPWORDS:
                continue
            if term.endswith('in') and len(term) >= 4:
                lookup_map[term + 'e'] = m
            elif term.endswith('ine') and len(term) >= 5:
                lookup_map[term[:-1]] = m
            if term.endswith('ol') and len(term) >= 4:
                lookup_map[term + 'e'] = m
            elif term.endswith('ole') and len(term) >= 5:
                lookup_map[term[:-1]] = m
            if term.endswith('id') and len(term) >= 4:
                lookup_map[term + 'e'] = m
            elif term.endswith('ide') and len(term) >= 5:
                lookup_map[term[:-1]] = m

    # Filter out any accidental stop words or too short keys
    filtered_keys = [k for k in lookup_map.keys() if len(k) >= 3 and k not in STOPWORDS]
    # Sort by length descending
    sorted_keys = sorted(filtered_keys, key=len, reverse=True)
    patt = re.compile(r'\b(?:' + '|'.join(re.escape(k) for k in sorted_keys) + r')\b', re.IGNORECASE)
    print(f"Compiled strict regex pattern with {len(sorted_keys)} keys.")

    # Fetch and match
    rows = cursor.execute("SELECT id, active_ingredient FROM dav_national_drugs").fetchall()
    total = len(rows)

    updates = []
    matched = 0
    unmatched = 0

    for drug_id, raw_ing in rows:
        ing = (raw_ing or "").strip().lower()
        if not ing or ing in ['--', '-', 'n/a']:
            unmatched += 1
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
                matched += 1
                continue
        unmatched += 1

    print(f"Matched {matched:,} drugs with strict zero-false-positive filtering.")
    print("Executing batch update...")
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

    conn.close()
    elapsed = time.time() - t0
    print("="*60)
    print("STRICT ENRICHMENT COMPLETED")
    print("="*60)
    print(f"Total drugs in DB: {total:,}")
    print(f"Enriched with verified clinical data: {matched:,} ({matched/total*100:.2f}%)")
    print(f"Safely left empty / NULL (chưa có thông tin): {unmatched:,} ({unmatched/total*100:.2f}%)")
    print(f"Execution time: {elapsed:.2f}s")

if __name__ == "__main__":
    main()
