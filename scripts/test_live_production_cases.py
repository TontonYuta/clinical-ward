"""
Live Production Verification Script for Clinical Copilot (<=150 LOC).
Sends real HTTP requests to the live Render deployment and validates anti-drift responses.
"""
import sys
import time
import httpx

PROD_URL = "https://clinical-ward-api.onrender.com/api/v1/copilot/chat"

TEST_CASES = [
    {
        "name": "Single DDI inquiry: Primolut N",
        "query": "Tôi cần thông tin về tương tác thuốc của Primolut N",
        "must_have": ["cyp3a4", "norethisteron"],
        "must_not_have": ["vui lòng nêu tên hai thuốc"]
    },
    {
        "name": "Single DDI inquiry: Venclexta",
        "query": "Tôi muốn hỏi về tương tác thuốc của Venclexta",
        "must_have": ["cyp3a4", "venetoclax"],
        "must_not_have": ["thông tư 20/2017", "vui lòng nêu tên hai thuốc"]
    },
    {
        "name": "Standalone brand: Teglutik",
        "query": "Teglutik",
        "must_have": ["riluzole"],
        "must_not_have": ["không tìm thấy"]
    },
    {
        "name": "Pediatric Paracetamol dosing",
        "query": "Liều dùng Paracetamol cho trẻ em 15kg",
        "must_have": ["trẻ em"],
        "must_not_have": ["liều dùng người lớn: paracetamol\n\ncách dùng: paracetamol thường được dùng"]
    },
    {
        "name": "Contraindication: Propranolol in asthma",
        "query": "Bệnh nhân bị hen phế quản có dùng được Propranolol không?",
        "must_have": ["propranolol", "hen phế quản"],
        "must_not_have": ["morphin"]
    },
    {
        "name": "Clinical population: Hypertension in pregnancy",
        "query": "Thuốc điều trị tăng huyết áp ở phụ nữ có thai",
        "must_have": ["thuốc"],
        "must_not_have": ["tăng sức", "sơn tra", "morphin"]
    },
    {
        "name": "Hospital regulation: Ward narcotic cabinet",
        "query": "Quy chế quản lý thuốc gây nghiện tại tủ trực",
        "must_have": ["thông tư"],
        "must_not_have": ["claforan"]
    },
    {
        "name": "Pair DDI: Clopidogrel and Omeprazol",
        "query": "Tương tác giữa Clopidogrel và Omeprazol",
        "must_have": ["clopidogrel", "omeprazol"],
        "must_not_have": []
    }
]

def run_tests():
    print(f"🏥 BẮT ĐẦU KIỂM THỬ TRỰC TIẾP TRÊN PRODUCTION API: {PROD_URL}")
    print("=" * 70)
    passed = 0
    with httpx.Client(timeout=30.0) as client:
        for idx, tc in enumerate(TEST_CASES, 1):
            session_id = f"test_prod_{idx}_{int(time.time())}"
            payload = {
                "query": tc["query"],
                "user_name": "Dr_Test_Automation",
                "user_role": "doctor",
                "session_id": session_id
            }
            try:
                res = client.post(PROD_URL, json=payload)
                if res.status_code != 200:
                    print(f"❌ [{idx}] {tc['name']}: HTTP {res.status_code}")
                    continue
                data = res.json()
                reply = data.get("reply_text", "").lower()

                failed_reasons = []
                for kw in tc["must_have"]:
                    if kw.lower() not in reply:
                        failed_reasons.append(f"Missing required keyword: '{kw}'")
                for ban in tc["must_not_have"]:
                    if ban.lower() in reply:
                        failed_reasons.append(f"Contains forbidden off-target content: '{ban}'")

                if failed_reasons:
                    print(f"❌ [{idx}] {tc['name']}: FAILED")
                    for r in failed_reasons:
                        print(f"    - {r}")
                    print(f"    - Reply excerpt: {reply[:150]}...")
                else:
                    passed += 1
                    print(f"✅ [{idx}] {tc['name']}: PASSED (Intent: {data.get('intent')})")
            except Exception as e:
                print(f"❌ [{idx}] {tc['name']}: Exception: {e}")

    print("=" * 70)
    print(f"📊 KẾT QUẢ KIỂM THỬ PRODUCTION: {passed}/{len(TEST_CASES)} PASSED ({(passed/len(TEST_CASES))*100:.1f}%)")
    return passed == len(TEST_CASES)

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
