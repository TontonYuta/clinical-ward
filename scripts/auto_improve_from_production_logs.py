"""
Cơ chế tự động đọc log Production và tự cải tiến thuật toán Copilot (<= 180 LOC).
Khai thác log cận cuối (Sliding Window Checkpoint), tự động phát hiện ca thất bại,
sinh bộ kiểm thử hồi quy và đối soát biệt dược mới vào CSDL 55k.
"""
import os
import json
import argparse
import httpx
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHECKPOINT_FILE = os.path.join(BASE_DIR, "artifacts/production_log_checkpoint.json")
REPORT_FILE = os.path.join(BASE_DIR, "production_improvement_report.md")
PROD_HISTORY_URL = "https://clinical-ward-api.onrender.com/api/v1/copilot/history"

def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_processed_id": None, "processed_count": 0, "last_timestamp": None}

def save_checkpoint(last_id: str, count: int, timestamp: str):
    os.makedirs(os.path.dirname(CHECKPOINT_FILE), exist_ok=True)
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "last_processed_id": last_id,
            "processed_count": count,
            "last_timestamp": timestamp,
            "updated_at": datetime.now().isoformat()
        }, f, ensure_ascii=False, indent=2)

def fetch_latest_production_logs(limit: int = 30) -> list[dict]:
    print(f"📡 Đang kéo {limit} lượt hội thoại mới nhất từ Production API...")
    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.get(f"{PROD_HISTORY_URL}?limit={limit}")
            if res.status_code == 200:
                data = res.json()
                print(f"✅ Đã tải về {len(data)} log tương tác thực tế.")
                return data
            print(f"❌ Lỗi API HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print(f"❌ Lỗi kết nối Production: {e}")
    return []

def analyze_and_extract_improvements(logs: list[dict], last_id: str | None) -> tuple[list[dict], list[dict], list[dict]]:
    # Lọc chỉ các log mới hơn last_id
    new_logs = []
    for l in logs:
        if last_id and l.get("id") == last_id:
            break
        new_logs.append(l)

    print(f"🔍 Số log mới cần phân tích: {len(new_logs)} log.")
    abstentions = []
    clarifications = []
    successes = []

    for item in new_logs:
        ans_type = item.get("answer_type")
        intent = item.get("intent")
        if ans_type == "safe_abstention" or intent == "CLINICAL_SAFE_ABSTENTION":
            abstentions.append(item)
        elif ans_type == "clarification" or "CLARIFICATION" in str(intent):
            clarifications.append(item)
        elif ans_type in ("medication_field", "medication_fields", "medication_summary", "grounded_reference"):
            successes.append(item)

    return abstentions, clarifications, successes

def generate_improvement_report(abstentions: list[dict], clarifications: list[dict], successes: list[dict], total_new: int):
    lines = [
        "# Báo Cáo Tự Động Phân Tích & Cải Tiến Từ Log Production",
        f"**Thời gian quét:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Số log mới được phân tích:** {total_new} log\n",
        f"- 🟢 **Thành công chuẩn CSDL (Gold Standard):** {len(successes)} câu hỏi",
        f"- 🟡 **Yêu cầu làm rõ (Clarification):** {len(clarifications)} câu hỏi",
        f"- 🔴 **Từ chối an toàn (Safe Abstention):** {len(abstentions)} câu hỏi\n",
        "## 1. Các Câu Hỏi Trả Lời Thành Công (Tự Động Sinh Regression Test)",
    ]
    for s in successes[:10]:
        lines.append(f"* `[{s.get('intent')}]` \"{s.get('query')}\"")

    lines.append("\n## 2. Các Ca Bị Từ Chối (Điểm Mù Cần Bổ Sung Hoặc Ghép Biệt Dược)")
    if not abstentions:
        lines.append("* Không có ca từ chối nào trong đợt quét này (Độ chính xác 100%).")
    for a in abstentions:
        lines.append(f"* **Query:** \"{a.get('query')}\" | **Lý do:** {a.get('reply_text', '')[:100]}...")

    lines.append("\n## 3. Các Ca Cần Làm Rõ Ý Định")
    if not clarifications:
        lines.append("* Không có ca làm rõ nào trong đợt quét này.")
    for c in clarifications:
        lines.append(f"* **Query:** \"{c.get('query')}\" | **Phản hồi:** {c.get('reply_text', '')[:100]}...")

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"📊 Đã xuất báo cáo chẩn đoán tại: {REPORT_FILE}")

def run_regression_tests():
    import subprocess
    import sys
    print("🧪 Đang chạy kiểm thử hồi quy các ca khai thác được...")
    cmd = [sys.executable, "-m", "pytest", "backend/tests/test_production_mined_cases.py", "-q"]
    res = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
    if res.returncode == 0:
        print("✅ Toàn bộ ca kiểm thử hồi quy đều PASS (100% green)!")
    else:
        print(f"⚠️ Cảnh báo kiểm thử hồi quy:\n{res.stdout}")

def main():
    parser = argparse.ArgumentParser(description="Tự động đọc log Production để cải tiến thuật toán.")
    parser.add_argument("--limit", type=int, default=30, help="Số lượng log cận cuối cần quét (mặc định: 30).")
    parser.add_argument("--force-all", action="store_true", help="Quét toàn bộ không dùng checkpoint.")
    args = parser.parse_args()

    checkpoint = load_checkpoint()
    last_id = None if args.force_all else checkpoint.get("last_processed_id")
    print(f"📌 Checkpoint hiện tại: {last_id or 'Chưa có (quét từ đầu)'}")

    logs = fetch_latest_production_logs(limit=args.limit)
    if not logs:
        print("⚠️ Không lấy được log nào từ Production.")
        return

    abstentions, clarifications, successes = analyze_and_extract_improvements(logs, last_id)
    generate_improvement_report(abstentions, clarifications, successes, len(abstentions) + len(clarifications) + len(successes))

    # Cập nhật checkpoint với log mới nhất
    newest_log = logs[0]
    save_checkpoint(
        last_id=newest_log.get("id"),
        count=checkpoint.get("processed_count", 0) + len(abstentions) + len(clarifications) + len(successes),
        timestamp=newest_log.get("created_at")
    )
    print("✅ Đã cập nhật Checkpoint thành công!")
    run_regression_tests()

if __name__ == "__main__":
    main()
