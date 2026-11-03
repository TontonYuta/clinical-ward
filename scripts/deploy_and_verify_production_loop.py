"""
Continuous Production Verification & Test Loop Script (<=160 LOC).
Monitors Render deployment and validates anti-drift clinical responses.
"""
import sys
import time
import argparse
import httpx

BASE_URL = "https://clinical-ward-api.onrender.com"
PROD_URL = f"{BASE_URL}/api/v1/copilot/chat"
HEALTH_URL = f"{BASE_URL}/health"

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
    },
    {
        "id": "PROD-09",
        "name": "Unaccented Single DDI: tuong tac thuoc venclexta",
        "query": "tuong tac thuoc venclexta",
        "must_have": ["cyp3a4"],
        "forbidden": ["thông tư 20/2017"]
    },
    {
        "id": "PROD-10",
        "name": "Unaccented Contraindication: chong chi dinh venclexta",
        "query": "chong chi dinh venclexta",
        "must_have": ["cyp3a", "chống chỉ định"],
        "forbidden": ["chưa có dữ liệu"]
    },
    {
        "id": "PROD-11",
        "name": "Ward Emergency Cabinet: TT 22/2011",
        "query": "Quy định về tủ trực cấp cứu tại khoa lâm sàng",
        "must_have": ["22/2011", "tủ trực"],
        "forbidden": ["claforan"]
    },
    {
        "id": "PROD-12",
        "name": "Vaccine Cold Chain: TT 36/2018",
        "query": "Nhiệt độ bảo quản vắc xin trong tủ lạnh chuyên dụng",
        "must_have": ["36/2018", "2", "8"],
        "forbidden": ["tăng sức"]
    }
]

def wait_for_deployment(expected_commit: str | None, max_wait: int = 540) -> bool:
    start_time = time.time()
    target_short = expected_commit[:7].lower() if expected_commit else None
    print(f"⏳ Monitoring Render deployment (target commit: {target_short or 'any-live'}, max wait: {max_wait}s)...")
    while time.time() - start_time < max_wait:
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(HEALTH_URL)
                if res.status_code == 200:
                    data = res.json()
                    live_commit = str(data.get("commit", "")).lower()
                    if not target_short or live_commit.startswith(target_short) or target_short in live_commit:
                        print(f"✅ Deployment is live! Active commit: {live_commit or 'healthy'} (elapsed: {int(time.time() - start_time)}s)")
                        return True
                    print(f"   [Polling] Live commit: {live_commit[:7]} != Target: {target_short} ({int(time.time() - start_time)}s)")
                else:
                    print(f"   [Polling] Render returned status {res.status_code} ({int(time.time() - start_time)}s)")
        except Exception as e:
            print(f"   [Polling] Connection retry ({e.__class__.__name__}) ({int(time.time() - start_time)}s)")
        time.sleep(15)
    print(f"⚠️ Deployment polling timeout reached after {max_wait}s.")
    return False

def execute_production_suite() -> tuple[int, int, list[str]]:
    passed = 0
    failures = []
    with httpx.Client(timeout=35.0) as client:
        for tc in PRODUCTION_TESTS:
            session_id = f"prod_{tc['id']}_{int(time.time())}"
            payload = {"query": tc["query"], "user_name": "QA_Loop_Verifier", "user_role": "doctor", "session_id": session_id}
            try:
                res = client.post(PROD_URL, json=payload)
                if res.status_code != 200:
                    failures.append(f"[{tc['id']}] HTTP {res.status_code}")
                    continue
                reply = res.json().get("reply_text", "").lower()
                case_errors = [f"Missing '{kw}'" for kw in tc["must_have"] if kw.lower() not in reply]
                case_errors += [f"Forbidden '{ban}'" for ban in tc["forbidden"] if ban.lower() in reply]
                if case_errors:
                    snippet = reply[:100].replace("\n", " ")
                    failures.append(f"[{tc['id']}] {tc['name']}: {', '.join(case_errors)} | Snippet: {snippet}...")
                else:
                    passed += 1
            except Exception as e:
                failures.append(f"[{tc['id']}] Exception: {e}")
    return passed, len(PRODUCTION_TESTS), failures

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-commit", default=None, help="Target git commit SHA to wait for")
    parser.add_argument("--max-wait", type=int, default=0, help="Max wait seconds for deployment")
    args = parser.parse_args()

    if args.max_wait > 0:
        wait_for_deployment(args.expected_commit, args.max_wait)

    p, total, errs = execute_production_suite()
    print(f"\n📊 Production Verification Score: {p}/{total} ({(p/total)*100:.1f}%)")
    for e in errs:
        print(f"  ❌ {e}")
    sys.exit(0 if p == total else 1)
