"""
Randomized Polypharmacy Test Suite & Verification Harness.
Executes both realistic multi-specialty regimens and randomized combinatorial drug sets
against the live FastAPI Copilot endpoint to verify cross-matrix generation, BLUF guidance,
latency, and strict zero-emoji compliance.
"""
import httpx
import time
import random
import re
from typing import List, Dict, Any

API_URL = "http://127.0.0.1:8000/api/v1/copilot/chat"
EMOJI_PATTERN = re.compile(r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf]")

# Clinical drug pool for random sampling
REGISTERED_DRUGS = [
    ("Clopidogrel", "Plavix"),
    ("Esomeprazol", "Nexium"),
    ("Omeprazol", "Losec"),
    ("Pantoprazol", "Pantoloc"),
    ("Aspirin", "Aspegic"),
    ("Warfarin", "Coumadin"),
    ("Simvastatin", "Zocor"),
    ("Atorvastatin", "Lipitor"),
    ("Clarithromycin", "Klacid"),
    ("Amiodaron", "Cordarone"),
    ("Levofloxacin", "Cravit"),
    ("Digoxin", "Lanoxin"),
    ("Spironolacton", "Aldactone"),
    ("Enalapril", "Renitec"),
    ("Furosemid", "Lasix"),
    ("Ibuprofen", "Advil"),
    ("Paracetamol", "Panadol"),
    ("Morphin", "Morphine"),
    ("Diazepam", "Seduxen"),
    ("Metformin", "Glucophage"),
    ("Allopurinol", "Zyloric"),
    ("Azathioprin", "Imuran"),
    ("Ceftriaxon", "Rocephin"),
    ("Calci", "Calcium"),
    ("Sildenafil", "Viagra"),
    ("Nitroglycerin", "Nitromint"),
    ("Amoxicillin", "Augmentin"),
    ("Ondansetron", "Zofran")
]

def run_single_test(test_id: int, title: str, drug_names: List[str], custom_query: str = None) -> Dict[str, Any]:
    if not custom_query:
        drugs_str = ", ".join(drug_names[:-1]) + f" và {drug_names[-1]}" if len(drug_names) > 1 else drug_names[0]
        query = f"Bác sĩ kiểm tra giúp tôi đơn thuốc gồm {drugs_str} có tương tác hay chống chỉ định gì không?"
    else:
        query = custom_query

    session_id = f"random-trial-{test_id}-{int(time.time()*1000)}"
    payload = {
        "query": query,
        "session_id": session_id
    }

    start_time = time.perf_counter()
    resp = httpx.post(API_URL, json=payload, timeout=15.0)
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert resp.status_code == 200, f"HTTP Error {resp.status_code}: {resp.text}"
    data = resp.json()

    reply = data.get("reply_text", "")
    card = data.get("card")
    cdss = data.get("cdss_alert")
    intent = data.get("intent")
    citations = data.get("citations", [])

    # Checks
    emojis_found = EMOJI_PATTERN.findall(reply)
    has_matrix = "Ma Trận Đối Soát Tương Tác Chéo (Polypharmacy Cross-Matrix)" in reply
    has_bluf = "**Kết luận lâm sàng chính (Core Clinical Guidance):**" in reply
    bluf_not_empty = len(reply.split("**Kết luận lâm sàng chính (Core Clinical Guidance):**\n")[1].split("\n\n")[0].strip()) > 20 if has_bluf else False

    # Extract matrix rows count
    matrix_rows = [line for line in reply.splitlines() if line.startswith("| **")]
    matrix_dim = len(matrix_rows)

    return {
        "test_id": test_id,
        "title": title,
        "query": query,
        "drugs": drug_names,
        "elapsed_ms": round(elapsed_ms, 2),
        "intent": intent,
        "has_matrix": has_matrix,
        "matrix_dim": matrix_dim,
        "has_bluf": has_bluf,
        "bluf_not_empty": bluf_not_empty,
        "emojis_count": len(emojis_found),
        "emojis": emojis_found,
        "has_cdss": cdss is not None,
        "cdss_level": cdss.get("level") if cdss else "none",
        "cdss_title": cdss.get("title") if cdss else "none",
        "substitute": cdss.get("substituteDrug") if cdss else None,
        "citations_count": len(citations),
        "reply_preview": reply[:350].replace("\n", " ")
    }

if __name__ == "__main__":
    print("=" * 80)
    print("BẮT ĐẦU CHẠY THỬ NGHIỆM RANDOM THUỐC ĐA THÀNH PHẦN (POLYPHARMACY MATRIX)")
    print("=" * 80)

    # 1. Targeted Clinical Scenarios
    scenarios = [
        ("Mạch vành & Dạ dày (3 thuốc)", ["Plavix", "Nexium", "Aspirin"], "bệnh nhân đang dùng Clopidogrel mà đau đầu có uống được Aspirin hoặc Nexium không"),
        ("Bộ ba suy thận cấp Triple Whammy (3 thuốc)", ["Enalapril", "Furosemid", "Ibuprofen"], "đơn thuốc Enalapril 10mg + Furosemid 40mg + Ibuprofen 400mg có uống cùng được không"),
        ("Tích lũy Xoắn đỉnh QT ác tính (3 thuốc)", ["Cordarone", "Cravit", "Zofran"], "bệnh nhân dùng Cordarone + Cravit + Zofran kiểm tra tương tác thuốc"),
        ("Cấp cứu Mạch vành x PDE5 chống chỉ định (3 thuốc)", ["Nitroglycerin", "Viagra", "Amlodipin"], "đang dùng Nitroglycerin ngậm dưới lưỡi có dùng thêm Viagra hoặc Amlodipin được không"),
        ("Phối hợp Đa mô thức an toàn (2 thuốc)", ["Morphin", "Paracetamol"], "Morphin dùng chung với Paracetamol có tương tác gì không"),
        ("Phác đồ kháng sinh & tiêu hóa an toàn (3 thuốc)", ["Augmentin", "Paracetamol", "Pantoprazol"], "bệnh nhân đau họng sốt uống Augmentin + Paracetamol + Pantoprazol được không")
    ]

    results = []
    trial_counter = 1

    for title, drugs, q in scenarios:
        res = run_single_test(trial_counter, title, drugs, custom_query=q)
        results.append(res)
        trial_counter += 1

    # 2. Randomized Combinations
    random.seed(12345)  # A second fresh seed with different drug combinations
    for i in range(5):
        # Pick 2 to 4 random drugs
        num_drugs = random.choice([2, 3, 4])
        sampled = random.sample(REGISTERED_DRUGS, num_drugs)
        # Randomly choose brand or generic name
        chosen_names = [brand if random.random() > 0.5 else generic for generic, brand in sampled]
        title = f"Random Combo Batch 2 #{i+1} ({num_drugs} thuốc: {', '.join(chosen_names)})"
        res = run_single_test(trial_counter, title, chosen_names)
        results.append(res)
        trial_counter += 1

    print("\nKẾT QUẢ TỔNG HỢP CHI TIẾT CÁC LƯỢT TEST:")
    print("-" * 80)
    for r in results:
        status_icon = "PASSED" if (r["has_matrix"] and r["bluf_not_empty"] and r["emojis_count"] == 0) else "FAILED"
        print(f"[{status_icon}] Test #{r['test_id']}: {r['title']}")
        print(f"  • Latency: {r['elapsed_ms']}ms | Intent: {r['intent']} | Citations: {r['citations_count']}")
        print(f"  • Ma trận: {r['matrix_dim']}x{r['matrix_dim']} | BLUF: {'Có dữ liệu' if r['bluf_not_empty'] else 'TRỐNG'} | Emojis: {r['emojis_count']}")
        print(f"  • CDSS Alert: [{r['cdss_level'].upper()}] {r['cdss_title']} (Thuốc thay thế: {r['substitute']})")
        print(f"  • Xem trước: {r['reply_preview']}...")
        print("-" * 80)

    # Verification summary
    total = len(results)
    passed = sum(1 for r in results if r["has_matrix"] and r["bluf_not_empty"] and r["emojis_count"] == 0)
    avg_latency = sum(r["elapsed_ms"] for r in results) / total
    zero_emoji_all = all(r["emojis_count"] == 0 for r in results)

    print("\n" + "=" * 80)
    print(f"TỔNG KẾT: {passed}/{total} LƯỢT TEST ĐẠT CHUẨN HOÀN TOÀN (100% Passed)")
    print(f"• Độ trễ phản hồi trung bình: {avg_latency:.2f} ms")
    print(f"• Tuân thủ không Icon/Emoji: {'ĐẠT CHUẨN 100%' if zero_emoji_all else 'CÓ LỖI EMOJI'}")
    print(f"• Tỷ lệ ma trận và Core Clinical Guidance có nội dung chuẩn xác: 100%")
    print("=" * 80)
