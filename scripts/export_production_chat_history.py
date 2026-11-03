"""
Export & Analyze Production Chat History from Clinical Copilot (<=100 LOC).
Fetches persistent chat logs from live production API and saves formatted JSON/Markdown.
Defaults to the 5 most recent Q&A interactions.
"""
import sys
import json
import argparse
import httpx
from datetime import datetime

import time

PROD_HISTORY_URL = "https://clinical-ward-api.onrender.com/api/v1/copilot/history"

def fetch_production_chat_history(limit: int = 5, retries: int = 3) -> list[dict]:
    print(f"📡 Đang tải {limit} lượt hội thoại gần nhất từ Production API ({PROD_HISTORY_URL})...")
    for attempt in range(1, retries + 1):
        try:
            with httpx.Client(timeout=35.0) as client:
                res = client.get(f"{PROD_HISTORY_URL}?limit={limit}")
                if res.status_code == 200:
                    data = res.json()
                    print(f"✅ Đã tải thành công {len(data)} lượt tương tác từ Production!")
                    return data
                print(f"❌ Lỗi HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"⚠️ Lần {attempt}/{retries} kết nối timeout ({e}), đang thử lại...")
            time.sleep(3)
    return []

def export_and_report(limit: int = 5):
    logs = fetch_production_chat_history(limit=limit)
    if not logs:
        print("ℹ️ Chưa có bản ghi hội thoại nào trên Production.")
        return

    # Lưu file JSON
    json_path = f"recent_{limit}_qa_logs.json" if limit <= 10 else "production_chat_logs.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
    print(f"💾 Đã lưu dữ liệu thô vào: {json_path}")

    # Tạo báo cáo Markdown
    md_path = f"recent_{limit}_qa_logs.md" if limit <= 10 else "production_chat_logs_summary.md"
    lines = [
        f"# Báo Cáo Lịch Sử {len(logs)} Lần Hỏi Đáp Gần Nhất Trên Production",
        f"**Thời gian trích xuất:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Tổng số lượt:** {len(logs)} lượt\n",
        "| STT | Thời gian | Người dùng | Vai trò | Câu hỏi (Query) | Ý định (Intent) | Trạng thái |",
        "|---|---|---|---|---|---|---|"
    ]
    for idx, r in enumerate(logs, 1):
        ts = str(r.get("created_at", "")).replace("T", " ")[:19]
        q = r.get("query", "").replace("|", "\\|").replace("\n", " ")[:60]
        user = r.get("user_name", "N/A")
        role = r.get("user_role", "N/A")
        intent = r.get("intent", "N/A")
        ans_type = r.get("answer_type", "normal")
        lines.append(f"| {idx} | {ts} | {user} | {role} | {q} | {intent} | {ans_type} |")

    lines.append(f"\n## Chi Tiết {len(logs)} Lần Hỏi Đáp Gần Nhất\n")
    for idx, r in enumerate(logs, 1):
        lines.append(f"### {idx}. [{r.get('intent')}] {r.get('user_name')} ({r.get('user_role')})")
        lines.append(f"**Câu hỏi:** {r.get('query')}")
        lines.append(f"**Phản hồi:**\n```\n{r.get('reply_text', '')}\n```\n")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"📊 Đã tạo báo cáo chi tiết tại: {md_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Xuất log Production.")
    parser.add_argument("--limit", type=int, default=5, help="Số lần hỏi đáp gần nhất cần lưu (mặc định: 5).")
    args = parser.parse_args()
    export_and_report(limit=args.limit)
