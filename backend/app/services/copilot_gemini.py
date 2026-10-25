import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.debt import DebtRecord
from app.models.equipment import EquipmentTicket
from app.models.coldchain import ColdChainCurrentState

SYSTEM_PROMPT = """Bạn là Trợ Lý Trí Tuệ Nhân Tạo Lâm Sàng (Clinical AI Copilot) chuyên nghiệp, phục vụ tại Bệnh viện và Cơ sở Y tế Việt Nam.
Chuyên môn của bạn:
1. Thông tư 20/2017/TT-BYT & NĐ 54/2017: Quản lý thuốc gây nghiện, hướng thần, bắt buộc thu hồi vỏ ống Morphin.
2. Thông tư 22/2011/TT-BYT: Quy chế Khoa Dược, tủ trực cấp cứu lâm sàng, dự trù Mẫu số 01/TT22.
3. Thông tư 51/2017/TT-BYT: Xử trí sốc phản vệ, Adrenalin 1mg/1ml tiêm bắp ngay lập tức độ II trở lên.
4. Nghị định 98/2021/NĐ-CP & TT 05/2022: Quản lý thiết bị y tế loại D can thiệp sự sống, kiểm định IEC 60601-1.
5. Thông tư 36/2018/TT-BYT (GSP): Quản lý kho FEFO, chuỗi lạnh vắc xin 2.0°C - 8.0°C, nhiệt động học Arrhenius MKT.
6. Nghị định 151/2017/NĐ-CP & NĐ 114/2024: Kiểm kê tài sản công 31/12.

Nguyên tắc phản hồi:
- Ngắn gọn, chuyên nghiệp, chuẩn xác từng thuật ngữ y khoa và căn cứ pháp lý.
- Định dạng Markdown rõ ràng, dùng bullet points, in đậm tên thuốc, liều dùng và văn bản quy phạm.
- Luôn ưu tiên an toàn tính mạng người bệnh."""

async def query_gemini_models(prompt: str, api_key: str) -> str | None:
    models = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
            except Exception:
                continue
    return None

async def ask_backend_gemini_copilot(
    query: str,
    user_role: str,
    user_name: str,
    db: AsyncSession
) -> str | None:
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == "MY_GEMINI_API_KEY" or len(api_key.strip()) < 10:
        return None

    try:
        debt_res = await db.execute(select(DebtRecord))
        debts = debt_res.scalars().all()
        active_debts = len([d for d in debts if d.status == "debt"])
        pending_ampoules = len([d for d in debts if d.item_type == "Thuốc gây nghiện" and not d.ampoule_returned])

        ticket_res = await db.execute(select(EquipmentTicket))
        tickets = ticket_res.scalars().all()
        urgent_tickets = len([t for t in tickets if t.urgency == "urgent" and t.status != "resolved"])

        cc_res = await db.execute(select(ColdChainCurrentState))
        cc = cc_res.scalars().first()
        temp = cc.current_temp if cc else 4.5

        context = (
            f"\n\n[Bối cảnh khoa phòng hiện tại: "
            f"Người dùng: {user_name} ({user_role}), "
            f"Nợ ca đêm: {active_debts} phiếu, "
            f"Vỏ Morphin chưa nộp: {pending_ampoules} vỏ, "
            f"Sự cố TBYT khẩn: {urgent_tickets}, "
            f"Nhiệt độ tủ vắc xin: {temp}°C]"
        )

        return await query_gemini_models(f"{query}{context}", api_key)
    except Exception:
        return None
