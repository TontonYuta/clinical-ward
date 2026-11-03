"""
100 Random Drugs Real Benchmark Test Script (<=200 LOC).
Executes 100 real requests against Clinical Copilot across diverse clinical scenarios.
"""
import os
import sys
import re
import json
import sqlite3
import random
import unicodedata
from fastapi.testclient import TestClient

# Ensure backend in pythonpath
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.main import app

def remove_accents(input_str: str) -> str:
    nfkd = unicodedata.normalize('NFKD', input_str)
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).replace('đ', 'd').replace('Đ', 'D')

def sample_drugs(db_path: str, seed: int = 42) -> tuple[list[str], list[str]]:
    random.seed(seed)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # 50 from monographs (clean inn/title)
    c.execute("SELECT inn FROM clinical_drug_monographs WHERE length(inn) > 3 AND inn NOT LIKE '%+%'")
    mono_drugs = []
    for r in c.fetchall():
        if r[0]:
            clean_name = re.sub(r"\s*\(.*?\)", "", r[0]).strip()
            if len(clean_name) >= 4:
                mono_drugs.append(clean_name)
    mono_drugs = list(dict.fromkeys(mono_drugs))
    mono_sample = random.sample(mono_drugs, min(50, len(mono_drugs)))

    # 50 from DAV (clean brand names)
    c.execute("SELECT brand_name FROM dav_national_drugs WHERE length(brand_name) BETWEEN 4 AND 20 AND brand_name NOT LIKE '%/%' AND brand_name NOT LIKE '%,%' AND brand_name NOT LIKE '%(%'")
    dav_drugs = list(dict.fromkeys(r[0].strip() for r in c.fetchall() if r[0]))
    dav_sample = random.sample(dav_drugs, min(50, len(dav_drugs)))
    conn.close()
    return mono_sample, dav_sample

def build_test_cases(mono_drugs: list[str], dav_drugs: list[str]) -> list[dict]:
    # 100 total drugs
    all_drugs = mono_drugs + dav_drugs
    cases = []

    # Category A: Standalone / Telegraphic (Cases 1-20)
    for i, drug in enumerate(all_drugs[0:20], 1):
        style = i % 4
        if style == 0: prompt = drug
        elif style == 1: prompt = drug.upper()
        elif style == 2: prompt = drug.lower()
        else: prompt = f"{drug} 500mg"
        cases.append({"id": i, "category": "A_STANDALONE", "drug": drug, "prompt": prompt})

    # Category B: Conversational Noise / Filler / Thừa từ (Cases 21-40)
    templates_b = [
        "À bác sĩ cho tôi hỏi chút về thuốc {d} nhé",
        "Dược sĩ ơi xem hộ em thông tin thuốc {d} với ạ",
        "Bác sĩ ơi cho em hỏi thông tin về thuốc {d} được không ạ",
        "Xin chào, tôi muốn tìm hiểu kỹ một chút về thuốc {d} với ạ",
    ]
    for i, drug in enumerate(all_drugs[20:40], 21):
        prompt = templates_b[(i - 21) % len(templates_b)].format(d=drug)
        cases.append({"id": i, "category": "B_CONVERSATIONAL_NOISE", "drug": drug, "prompt": prompt})

    # Category C: Single-Drug Interaction Queries (Cases 41-60)
    templates_c = [
        "Tôi cần thông tin về tương tác thuốc của {d}",
        "Thuốc {d} có kỵ thuốc gì không bác sĩ?",
        "Tương tác thuốc {d}",
        "Cho tôi biết thông tin về tương tác thuốc của {d}",
    ]
    for i, drug in enumerate(all_drugs[40:60], 41):
        prompt = templates_c[(i - 41) % len(templates_c)].format(d=drug)
        cases.append({"id": i, "category": "C_INTERACTION_INQUIRY", "drug": drug, "prompt": prompt})

    # Category D: Specific Clinical Fields (Cases 61-80)
    templates_d = [
        "Chống chỉ định của {d} là gì?",
        "Tác dụng phụ của {d}",
        "Liều dùng của {d}",
        "Thành phần của thuốc {d}",
        "{d} dùng điều trị bệnh gì thế",
    ]
    for i, drug in enumerate(all_drugs[60:80], 61):
        prompt = templates_d[(i - 61) % len(templates_d)].format(d=drug)
        cases.append({"id": i, "category": "D_CLINICAL_FIELD", "drug": drug, "prompt": prompt})

    # Category E: Telegraphic / Thiếu từ / Không dấu (Cases 81-100)
    templates_e = [
        "tuong tac thuoc {d}",
        "thong tin thuoc {d}",
        "chong chi dinh {d}",
        "tac dung phu {d}",
        "lieu dung {d}",
    ]
    for i, drug in enumerate(all_drugs[80:100], 81):
        prompt = templates_e[(i - 81) % len(templates_e)].format(d=remove_accents(drug))
        cases.append({"id": i, "category": "E_NON_ACCENT_OR_TERSE", "drug": drug, "prompt": prompt})

    return cases

def run_benchmark():
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "clinical_hospital.db"))
    mono_drugs, dav_drugs = sample_drugs(db_path, seed=2026)
    cases = build_test_cases(mono_drugs, dav_drugs)

    client = TestClient(app)
    results = []
    print(f"🚀 Running benchmark on {len(cases)} real test cases...")

    for c in cases:
        session_id = f"bench-case-{c['id']}"
        res = client.post("/api/v1/copilot/chat", json={"query": c["prompt"], "session_id": session_id})
        status_code = res.status_code
        data = res.json() if status_code == 200 else {}
        reply = data.get("reply_text", "")
        intent = data.get("intent", "UNKNOWN")
        answer_type = data.get("answer_type", "UNKNOWN")
        source = data.get("source_status", "UNKNOWN")

        # Evaluate clinical validity
        drug_lower = c["drug"].lower()
        drug_unaccent = remove_accents(drug_lower)
        first_token = drug_lower.split()[0]
        stem = drug_unaccent[:min(len(drug_unaccent), 6)]
        reply_lower = reply.lower()
        reply_unaccent = remove_accents(reply_lower)

        has_drug_grounding = (
            (drug_lower in reply_lower)
            or (drug_unaccent in reply_unaccent)
            or (len(first_token) >= 4 and first_token in reply_lower)
            or (len(stem) >= 5 and stem in reply_unaccent)
        )
        is_safe = status_code == 200 and len(reply) > 20 and not reply.startswith("Internal Server Error")
        success = is_safe and (
            has_drug_grounding
            or "chưa có dữ liệu" in reply_lower
            or "chưa đủ căn cứ" in reply_lower
            or "đối chiếu" in reply_lower
            or "hiện chưa tìm thấy" in reply_lower
            or "từ chối" in reply_lower
            or "chưa xác định" in reply_lower
        )

        results.append({
            "id": c["id"],
            "category": c["category"],
            "target_drug": c["drug"],
            "prompt": c["prompt"],
            "status_code": status_code,
            "intent": intent,
            "answer_type": answer_type,
            "source_status": source,
            "has_drug_grounding": has_drug_grounding,
            "success": success,
            "reply_snippet": reply[:300].replace("\n", " ").strip(),
            "full_reply": reply,
        })
        print(f"[{c['id']}/100] {c['category']} | Prompt: '{c['prompt'][:40]}' -> Status: {status_code} | Intent: {intent} | Success: {success}")

    out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "100_random_drugs_results.json"))
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total = len(results)
    passed = sum(1 for r in results if r["success"])
    grounded = sum(1 for r in results if r["has_drug_grounding"])
    print(f"\n✅ BENCHMARK COMPLETE: {passed}/{total} Passed ({passed/total*100:.1f}%), {grounded}/{total} Drug-Grounded ({grounded/total*100:.1f}%)")
    print(f"Saved full results to {out_file}")

if __name__ == "__main__":
    run_benchmark()
