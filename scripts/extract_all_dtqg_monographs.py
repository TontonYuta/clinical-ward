#!/usr/bin/env python3
"""
Trích xuất toàn bộ chuyên luận Dược Thư Quốc Gia Việt Nam thành JSON chuẩn lâm sàng.
Không bịa đặt thông tin - trích xuất 100% từ text vector của Dược Thư Quốc Gia.
"""

import os
import re
import json
import time

TXT_PATH = "/tmp/duoc_thu_all.txt"
OUTPUT_JSON = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/dtqg_monographs_extracted.json"

def clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove recurring page headers/footers in DTQGVN
    text = re.sub(r'\nDTQGVN\s*2\s*\n', '\n', text)
    text = re.sub(r'\n\d{1,4}\s*\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text)
    return text.strip()

def build_index(pages):
    index = []
    tcqt_regex = re.compile(r'Tên chung quốc tế:\s*([^\n\.]+)', re.IGNORECASE)
    atc_regex = re.compile(r'Mã ATC:\s*([^\n\.]+)', re.IGNORECASE)

    for p_num, page in enumerate(pages, 1):
        matches = list(tcqt_regex.finditer(page))
        for m in matches:
            inn = m.group(1).strip()
            if inn.lower().startswith("viết theo"):
                continue
            
            atc_m = atc_regex.search(page[m.start():])
            atc = atc_m.group(1).strip() if atc_m else None
            
            prefix = page[:m.start()].strip().split('\n')
            title = prefix[-1].strip() if prefix else inn
            if title.startswith('(') and len(prefix) >= 2:
                title = prefix[-2].strip() + ' ' + title
            
            index.append({
                "title": title,
                "inn": inn,
                "atc": atc,
                "start_page": p_num,
                "char_offset": m.start()
            })
    return index

def slice_monograph(pages, cur, nxt):
    start_p = cur["start_page"] - 1
    end_p = (nxt["start_page"] - 1) if nxt else min(start_p + 10, len(pages))
    
    text = '\n'.join(pages[start_p:end_p + 1])
    start_token = "Tên chung quốc tế: " + cur["inn"]
    start_pos = text.find(start_token)
    if start_pos == -1:
        start_pos = text.find(cur["inn"])
        
    title_pos = text.rfind(cur["title"], 0, start_pos) if cur["title"] else -1
    actual_start = title_pos if title_pos != -1 else (start_pos if start_pos != -1 else 0)
    
    if nxt:
        end_token = "Tên chung quốc tế: " + nxt["inn"]
        end_pos = text.find(end_token, actual_start + 100)
        if end_pos != -1:
            next_title_pos = text.rfind(nxt["title"], actual_start, end_pos)
            actual_end = next_title_pos if next_title_pos != -1 else end_pos
            text = text[actual_start:actual_end]
        else:
            text = text[actual_start:]
    else:
        text = text[actual_start:]
        
    return text.strip()

def extract_sections(raw_text: str) -> dict:
    section_patterns = [
        ("atc_code", r'Mã ATC:\s*([^\n]+)'),
        ("drug_class", r'Loại thuốc:\s*([^\n]+(?:\n(?![A-ZĐ][a-zà-ỹA-Z0-9\s]+:)[^\n]+)*)'),
        ("dosage_forms", r'Dạng thuốc và hàm lượng\s*\n([\s\S]*?)(?=\nDược lý|\nChỉ định|\nChống chỉ định|\nThận trọng|\Z)'),
        ("pharmacology", r'Dược lý và cơ chế tác dụng\s*\n([\s\S]*?)(?=\nDược động học|\nChỉ định|\nChống chỉ định|\Z)'),
        ("pharmacokinetics", r'Dược động học\s*\n([\s\S]*?)(?=\nChỉ định|\nChống chỉ định|\nThận trọng|\Z)'),
        ("indications", r'Chỉ định\s*\n([\s\S]*?)(?=\nChống chỉ định|\nThận trọng|\nLiều lượng|\Z)'),
        ("contraindications", r'Chống chỉ định\s*\n([\s\S]*?)(?=\nThận trọng|\nThời kỳ mang thai|\nLiều lượng|\Z)'),
        ("precautions", r'Thận trọng\s*\n([\s\S]*?)(?=\nThời kỳ mang thai|\nThời kỳ cho con bú|\nTác dụng không mong muốn|\Z)'),
        ("pregnancy", r'Thời kỳ mang thai\s*\n([\s\S]*?)(?=\nThời kỳ cho con bú|\nTác dụng không mong muốn|\Z)'),
        ("lactation", r'Thời kỳ cho con bú\s*\n([\s\S]*?)(?=\nTác dụng không mong muốn|\nLiều lượng|\Z)'),
        ("adverse_effects", r'Tác dụng không mong muốn\s*(?:\(ADR\))?\s*\n([\s\S]*?)(?=\nHướng dẫn cách xử trí|\nLiều lượng và cách dùng|\Z)'),
        ("dosage_and_administration", r'Liều lượng và cách dùng\s*\n([\s\S]*?)(?=\nTương tác thuốc|\nĐộ ổn định|\nQuá liều|\Z)'),
        ("drug_interactions", r'Tương tác thuốc\s*\n([\s\S]*?)(?=\nĐộ ổn định|\nQuá liều và xử trí|\nThông tin qui chế|\Z)'),
        ("overdose_and_treatment", r'Quá liều và xử trí\s*\n([\s\S]*?)(?=\nThông tin qui chế|\nTên thương mại|\Z)')
    ]
    
    data = {}
    for key, pattern in section_patterns:
        m = re.search(pattern, raw_text)
        data[key] = clean_text(m.group(1)) if m else None
        
    dosage = data.get("dosage_and_administration") or ""
    
    # Sub-parsing adult dosage
    adult_m = re.search(r'(?:Người lớn|Liều người lớn)\s*[:\n]?\s*([\s\S]*?)(?=\n(?:Trẻ em|Liều trẻ em)|(?:\n[A-ZĐ][a-zà-ỹ\s]+:|\nNgười cao tuổi|\nSuy thận|\nSuy gan)|\Z)', dosage, re.IGNORECASE)
    data["adult_dosage"] = clean_text(adult_m.group(1)) if adult_m else (clean_text(dosage) if dosage else None)
    
    # Sub-parsing pediatric dosage
    ped_m = re.search(r'(?:Trẻ em|Liều trẻ em)\s*[:\n]?\s*([\s\S]*?)(?=\n(?:Người lớn|Liều người lớn)|(?:\n[A-ZĐ][a-zà-ỹ\s]+:|\nNgười cao tuổi|\nSuy thận|\nSuy gan)|\Z)', dosage, re.IGNORECASE)
    data["pediatric_dosage"] = clean_text(ped_m.group(1)) if ped_m else None
    
    # Sub-parsing renal adjustment
    renal_m = re.search(r'(?:Suy thận|Người bệnh suy thận|Hiệu chỉnh ở người suy thận|Hiệu chỉnh liều ở người suy thận)\s*[:\n]?\s*([\s\S]*?)(?=\n(?:Suy gan|Người cao tuổi|Tương tác|Độ ổn định|Quá liều)|\Z)', dosage, re.IGNORECASE)
    data["renal_adjustment"] = clean_text(renal_m.group(1)) if renal_m else None
    
    # Sub-parsing hepatic adjustment
    hepatic_m = re.search(r'(?:Suy gan|Người bệnh suy gan|Hiệu chỉnh ở người suy gan|Hiệu chỉnh liều ở người suy gan)\s*[:\n]?\s*([\s\S]*?)(?=\n(?:Suy thận|Người cao tuổi|Tương tác|Độ ổn định|Quá liều)|\Z)', dosage, re.IGNORECASE)
    data["hepatic_adjustment"] = clean_text(hepatic_m.group(1)) if hepatic_m else None
    
    # Identify specific antidote if mentioned in overdose treatment
    overdose = data.get("overdose_and_treatment") or ""
    antidote_m = re.search(r'(?:giải độc|kháng|thuốc đối kháng|thuốc giải độc)[^\.\n]*?(?:là|dùng|bằng)\s+([^\.\n]+)', overdose, re.IGNORECASE)
    data["antidote"] = clean_text(antidote_m.group(1)) if antidote_m else None

    # Merge pregnancy and lactation warning
    preg = data.get("pregnancy") or ""
    lact = data.get("lactation") or ""
    data["pregnancy_warning"] = clean_text(f"Thời kỳ mang thai: {preg}\nThời kỳ cho con bú: {lact}").strip() if (preg or lact) else None

    return data

def main():
    t0 = time.time()
    with open(TXT_PATH, 'r', encoding='utf-8') as f:
        pages = f.read().split('\x0c')
        
    index = build_index(pages)
    print(f"Loaded {len(pages)} pages. Indexed {len(index)} monographs.")
    
    monographs = []
    for i, cur in enumerate(index):
        nxt = index[i + 1] if i + 1 < len(index) else None
        raw = slice_monograph(pages, cur, nxt)
        parsed = extract_sections(raw)
        
        entry = {
            "title": cur["title"],
            "inn": cur["inn"],
            "start_page": cur["start_page"],
            "atc_code": parsed.get("atc_code"),
            "drug_class": parsed.get("drug_class"),
            "dosage_forms": parsed.get("dosage_forms"),
            "indications": parsed.get("indications"),
            "contraindications": parsed.get("contraindications"),
            "precautions": parsed.get("precautions"),
            "pregnancy_warning": parsed.get("pregnancy_warning"),
            "adverse_effects": parsed.get("adverse_effects"),
            "adult_dosage": parsed.get("adult_dosage"),
            "pediatric_dosage": parsed.get("pediatric_dosage"),
            "renal_adjustment": parsed.get("renal_adjustment"),
            "hepatic_adjustment": parsed.get("hepatic_adjustment"),
            "drug_interactions": parsed.get("drug_interactions"),
            "overdose_treatment": parsed.get("overdose_and_treatment"),
            "antidote": parsed.get("antidote"),
            "source": f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {cur['start_page']}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" if cur.get("start_page") else "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        }
        monographs.append(entry)
        
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(monographs, f, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - t0
    print(f"Successfully extracted {len(monographs)} monographs to {OUTPUT_JSON} in {elapsed:.2f}s")

if __name__ == "__main__":
    main()
