"""
Production Verification & Test Loop Script for Clinical Copilot (<=150 LOC).
Polls Render deployment, runs clinical test cases, and asserts zero off-target drift.
"""
import sys
import time
import httpx

PROD_URL = "https://clinical-ward-api.onrender.com/api/v1/copilot/chat"

PRODUCTION_TESTS = [
    {
        "id": "PROD-01",
        "name": "Single DDI: Primolut N",
        "query": "Tôi cần thông tin về tương tác thuốc của Primolut N",
        "must_have": ["cyp3a4", "norethisteron"],
        "forbidden": ["vui lòng nêu tên hai thuốc"]
    },
    {
        "id": "PROD-02",
        "name": "Single DDI: Venclexta",
        "query": "Tôi muốn hỏi về tương tác thuốc của Venclexta",
        "must_have": ["cyp3a4", "venetoclax"],
        "forbidden": ["thông tư 20/2017", "vui lòng nêu tên hai thuốc", "morphin"]
    },
    {
        "id": "PROD-03",
        "name": "Standalone brand: Teglutik",
        "query": "Teglutik",
        "must_have": ["riluzole"],
        "forbidden": ["không tìm thấy"]
    },
    {
        "id": "PROD-04",
        "name": "Pediatric dosing: Paracetamol 15kg",
        "query": "Liều dùng Paracetamol cho trẻ em 15kg",
        "must_have": ["trẻ em"],
        "forbidden": ["liều dùng người lớn: paracetamol\n\ncách dùng: paracetamol thường được dùng"]
    },
    {
        "id": "PROD-05",
        "name": "Contraindication: Propranolol in asthma",
        "query": "Bệnh nhân bị hen phế quản có dùng được Propranolol không?",
        "must_have": ["propranolol", "hen phế quản"],
        "forbidden": ["morphin"]
    },
    {
        "id": "PROD-06",
        "name": "Population inquiry: Hypertension in pregnancy",
        "query": "Thuốc điều trị tăng huyết áp ở phụ nữ có thai",
        "must_have": ["thuốc"],
        "forbidden": ["tăng sức", "sơn tra", "morphin"]
    },
    {
        "id": "PROD-07",
        "name": "Hospital regulation: Ward narcotic cabinet",
        "query": "Quy chế quản lý thuốc gây nghiện tại tủ trực",
        "must_have": ["thông tư"],
        "forbidden": ["claforan"]
    },
    {
        "id": "PROD-08",
        "name": "Pair DDI: Clopidogrel and Omeprazol",
        "query": "Tương tác giữa Clopidogrel và Omeprazol",
        "must_have": ["clopidogrel", "omeprazol"],
        "forbidden": []
    }
]

def execute_production_suite() -> tuple[int, int, list[str]]:
    passed = 0
    failures = []
    with httpx.Client(timeout=35.0) as client:
        for tc in PRODUCTION_TESTS:
            session_id = f"prod_verify_{tc['id']}_{int(time.time())}"
            payload = {
                "query": tc["query"],
                "user_name": "QA_Production_Verifier",
                "user_role": "doctor",
                "session_id": session_id
            }
            try:
                res = client.post(PROD_URL, json=payload)
                if res.status_code != 200:
                    failures.append(f"[{tc['id']}] HTTP {res.status_code}")
                    continue
                reply = res.json().get("reply_text", "").lower()

                case_errors = []
                for kw in tc["must_have"]:
                    if kw.lower() not in reply:
                        case_errors.append(f"Missing required term: '{kw}'")
                for ban in tc["forbidden"]:
                    if ban.lower() in reply:
                        case_errors.append(f"Contains forbidden off-target drift: '{ban}'")

                if case_errors:
                    snippet = reply[:120].replace("\n", " ")
                    failures.append(f"[{tc['id']}] {tc['name']}: {', '.join(case_errors)} | Excerpt: {snippet}...")
                else:
                    passed += 1
            except Exception as e:
                failures.append(f"[{tc['id']}] Exception: {e}")

    return passed, len(PRODUCTION_TESTS), failures

if __name__ == "__main__":
    p, total, errs = execute_production_suite()
    print(f"Production Test Score: {p}/{total} ({(p/total)*100:.1f}%)")
    for e in errs:
        print(f"  ❌ {e}")
    sys.exit(0 if p == total else 1)
