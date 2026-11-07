import pytest
import random
import string
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.drug_resolver import DrugEntityResolver

client = TestClient(app)
resolver = DrugEntityResolver()

# Bộ mẫu các thuốc kinh điển trong CSDL Dược Quốc Gia & BHYT TT 20
BASE_DRUG_CASES = [
    {"name": "Nexium", "active": "Esomeprazole", "conc": "40mg", "expected_atc": "A02BC05"},
    {"name": "Panadol", "active": "Paracetamol", "conc": "500mg", "expected_atc": "N02BE01"},
    {"name": "Glucophage", "active": "Metformin", "conc": "850mg", "expected_atc": "A10BA02"},
    {"name": "Amlor", "active": "Amlodipine", "conc": "5mg", "expected_atc": "C08CA01"},
    {"name": "Lipitor", "active": "Atorvastatin", "conc": "20mg", "expected_atc": "C10AA05"},
    {"name": "Augmentin", "active": "Amoxicillin", "conc": "1g", "expected_atc": "J01CR02"},
    {"name": "Voltaren", "active": "Diclofenac", "conc": "50mg", "expected_atc": "M01AB05"},
    {"name": "Medrol", "active": "Methylprednisolon", "conc": "16mg", "expected_atc": "H02AB04"},
]

def introduce_random_typo(text: str) -> str:
    """Tạo lỗi gõ sai ngẫu nhiên 1 ký tự (omission, substitution, duplication)."""
    if len(text) <= 3:
        return text
    action = random.choice(["dup", "sub", "swap"])
    idx = random.randint(1, len(text) - 2)
    chars = list(text)
    if action == "dup":
        chars.insert(idx, chars[idx])
    elif action == "sub":
        chars[idx] = random.choice("abcdefghijklmnopqrstuvwxyz")
    elif action == "swap":
        chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
    return "".join(chars)

def generate_randomized_prescription_string(seed_val: int) -> tuple[str, dict]:
    """Sinh chuỗi mô tả dòng thuốc ngẫu nhiên với STT, số lượng, liều dùng."""
    random.seed(seed_val)
    drug = random.choice(BASE_DRUG_CASES)
    
    # Random format: Dùng tên biệt dược hoặc hoạt chất hoặc cả hai
    use_format = random.choice(["brand_only", "brand_paren_active", "active_only", "typo_brand"])
    if use_format == "brand_only":
        base_str = f"{drug['name']} {drug['conc']}"
    elif use_format == "brand_paren_active":
        base_str = f"{drug['name']} {drug['conc']} ({drug['active']})"
    elif use_format == "active_only":
        base_str = f"{drug['active']} {drug['conc']}"
    else:
        typo_name = introduce_random_typo(drug['name'])
        base_str = f"{typo_name} {drug['conc']}"

    # Random noise: STT
    stt_prefix = random.choice(["", f"{random.randint(1, 20)}. ", f"[{random.randint(1, 20)}] ", f"Thuốc {random.randint(1, 10)}: "])
    # Random noise: Đơn vị / số lượng
    qty_suffix = random.choice([
        "",
        f" x {random.randint(10, 60)} viên",
        f" SL: {random.randint(5, 30)} gói",
        f" - {random.randint(10, 30)} viên nén"
    ])
    # Random noise: Chỉ dẫn
    instruction = random.choice([
        "",
        " uống sáng 1 viên sau ăn",
        " ngày 2 lần mỗi lần 1 viên",
        " uống trước bữa ăn 30 phút"
    ])

    raw_text = f"{stt_prefix}{base_str}{qty_suffix}{instruction}".strip()
    return raw_text, drug

def test_randomized_single_drug_resolution():
    """Kiểm thử độ chính xác của Entity Resolver trên 25 ca ngẫu nhiên có nhiễu."""
    # Warmup
    resolver.resolve_drug("warmup Aspirin 100mg")
    
    passed = 0
    total = 25
    for i in range(total):
        raw_query, drug = generate_randomized_prescription_string(seed_val=i * 137 + 42)
        t0 = time.time()
        res = resolver.resolve_drug(raw_query)
        latency_ms = (time.time() - t0) * 1000

        # Kiểm tra tính chất cơ bản (Property assertions)
        assert 0.0 <= res.confidence_score <= 1.0, f"Confidence score out of range: {res.confidence_score}"
        assert res.match_status in ["HIGH", "MEDIUM", "LOW", "UNRESOLVED"]
        assert latency_ms < 80.0, f"Latency too slow: {latency_ms:.2f}ms"

        # Đánh giá độ chính xác phân giải
        matched_atc = None
        if res.matched_bhyt:
            matched_atc = res.matched_bhyt.atc_code
        elif res.matched_dav:
            matched_atc = res.matched_dav.atc_code

        assert matched_atc is not None, f"Không phân giải được ATC cho: {raw_query}"
        # Phải khớp tiền tố ATC ít nhất 3 ký tự (ví dụ A02, N02, A10, C08, C10, J01)
        assert matched_atc.startswith(drug["expected_atc"][:3]), (
            f"ATC sai lệch! Input: '{raw_query}', Kỳ vọng tiền tố: {drug['expected_atc']}, Nhận được: {matched_atc}"
        )
        passed += 1

    assert passed == total

def test_randomized_batch_resolution_api():
    """Kiểm thử API batch-resolve-drugs trên mảng ngẫu nhiên 10 thuốc."""
    batch_inputs = []
    expected_drugs = []
    for i in range(10):
        raw_query, drug = generate_randomized_prescription_string(seed_val=1000 + i * 31)
        batch_inputs.append(raw_query)
        expected_drugs.append(drug)

    t0 = time.time()
    response = client.post("/api/v1/bhyt/batch-resolve-drugs", json={"raw_drugs": batch_inputs})
    latency_ms = (time.time() - t0) * 1000

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10
    assert data["resolved_count"] >= 9  # Tối thiểu 90% giải quyết thành công ở mức HIGH/MEDIUM
    assert latency_ms < 500.0, f"Batch API too slow: {latency_ms:.2f}ms"

    for idx, res in enumerate(data["results"]):
        assert res["match_status"] in ["HIGH", "MEDIUM"]
        assert res["confidence_score"] >= 0.70

def test_gibberish_and_empty_inputs_graceful():
    """Đảm bảo hệ thống không sập khi gặp input rác hoặc chuỗi trống."""
    # Chuỗi trống
    res_empty = client.post("/api/v1/bhyt/resolve-drug", json={"raw_query": ""})
    assert res_empty.status_code == 200
    assert res_empty.json()["match_status"] == "UNRESOLVED"
    assert res_empty.json()["confidence_score"] == 0.0

    # Chuỗi ký tự ngẫu nhiên hoàn toàn
    gibberish = "zzqqxx_abc12345_random_nonsense_text"
    res_gibberish = client.post("/api/v1/bhyt/resolve-drug", json={"raw_query": gibberish})
    assert res_gibberish.status_code == 200
    assert res_gibberish.json()["match_status"] in ["LOW", "UNRESOLVED"]
    assert res_gibberish.json()["confidence_score"] < 0.60
