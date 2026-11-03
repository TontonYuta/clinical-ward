"""
Export & Analyze Production Chat History from Clinical Copilot (<=100 LOC).
Fetches persistent chat logs from live production API and saves formatted JSON/Markdown.
"""
import sys
import json
import httpx
from datetime import datetime

PROD_HISTORY_URL = "https://clinical-ward-api.onrender.com/api/v1/copilot/history"

def fetch_production_chat_history(limit: int = 500) -> list[dict]:
    print(f"📡 Đang tải lịch sử hội thoại từ Production API ({PROD_HISTORY_URL})...")
    with httpx.Client(timeout=30.0) as client:
        res = client.get(f"{PROD_HISTORY_URL}?limit={limit}")
        if res.status_code != 200:
            print(f"❌ Lỗi HTTP {res.status_code}: {res.text}")
            return []
        data = res.json()
        print(f"✅ Đã tải thành công {len(data)} lượt tương tác thực tế từ Production!")
        return data

def export_and_report():
    logs = fetch_production_chat_history()
    if not logs:
        print("ℹ️ Chưa có bản ghi hội thoại nào trên Production (hoặc container vừa khởi động lại).")
        return

    # Save raw JSON
    json_path = "production_chat_logs.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
    print(f"💾 Đã lưu dữ liệu thô vào: {json_path}")

    # Generate summary report
    md_path = "production_chat_logs_summary.md"
    lines = [
        "# Báo Cáo Lịch Sử Tương Tác Người Dùng Thực Tế Trên Production",
        f"**Thời gian trích xuất:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Tổng số lượt tương tác:** {len(logs)} lượt\n",
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

    lines.append("\n## Chi Tiết Các Câu Hỏi Lâm Sàng Thực Tế\n")
    for idx, r in enumerate(logs, 1):
        lines.append(f"### {idx}. [{r.get('intent')}] {r.get('user_name')} ({r.get('user_role')})")
        lines.append(f"**Câu hỏi:** {r.get('query')}")
        lines.append(f"**Phản hồi:**\n```\n{r.get('reply_text', '')[:400]}...\n```\n")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"📊 Đã tạo báo cáo phân tích chi tiết tại: {md_path}")

if __name__ == "__main__":
    export_and_report()
