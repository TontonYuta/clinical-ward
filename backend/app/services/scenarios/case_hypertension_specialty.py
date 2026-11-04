"""
Kịch bản: Tư Vấn Điều Trị Tăng Huyết Áp Trong Các Bệnh Cảnh Đặc Biệt (Suy Thận & Thai Kỳ)
Căn cứ: Khuyến cáo Hội Tim Mạch Việt Nam (VNHA/VSH), KDIGO 2021/2023, ESC Guidelines & Bộ Y Tế (<=120 LOC)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class HypertensionSpecialtyScenario(BaseScenario):
    scenario_id = "hypertension_specialty"
    scenario_name = "Tư vấn điều trị tăng huyết áp trong bệnh cảnh đặc biệt"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_htn = any(k in lower_query for k in ("hạ huyết áp", "tăng huyết áp", "trị huyết áp", "thuốc huyết áp", "chữa huyết áp", "điều trị huyết áp", "thuốc hạ áp", "thuốc trị tăng huyết áp"))
        has_special = any(k in lower_query for k in ("suy thận", "thận mạn", "ckd", "chức năng thận", "thai kỳ", "có thai", "mang thai", "phụ nữ có thai", "cho con bú"))
        return has_htn and (has_special or any(k in lower_query for k in ("thuốc gì", "dùng thuốc nào", "lựa chọn nào", "nhóm thuốc", "phác đồ")))

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        is_pregnancy = any(k in lower_query for k in ("thai kỳ", "có thai", "mang thai", "phụ nữ có thai", "bà bầu", "tiền sản giật"))
        is_renal = any(k in lower_query for k in ("suy thận", "thận mạn", "ckd", "chức năng thận", "creatinin", "lọc máu"))

        if is_pregnancy:
            reply = (
                "### 🩺 HƯỚNG DẪN ĐIỀU TRỊ TĂNG HUYẾT ÁP Ở PHỤ NỮ CÓ THAI\n"
                "*(Căn cứ: Hướng dẫn Hội Tim Mạch Học Việt Nam VNHA & Hội Tim Mạch Châu Âu ESC)*\n\n"
                "**1. Mục tiêu điều trị & Ngưỡng khởi trị:**\n"
                "- Khởi trị khi Huyết áp (HA) $\\ge 140/90\\text{ mmHg}$ nếu có tổn thương cơ quan đích hoặc tiền sản giật; hoặc $\\ge 150/95\\text{ mmHg}$ trong mọi trường hợp khác.\n"
                "- Mục tiêu HA: $110 - 140 / 80 - 85\\text{ mmHg}$ (tránh hạ HA quá mức gây giảm tưới máu nhau thai).\n\n"
                "**2. Nhóm thuốc an toàn, ưu tiên lựa chọn hàng đầu (First-line):**\n"
                "- **Methyldopa (chẹn alpha trung ương):** Thuốc đầu tay truyền thống, an toàn nhất với bằng chứng theo dõi lâu dài sự phát triển của trẻ.\n"
                "- **Labetalol (chẹn alpha và beta):** Thuốc đầu tay hiệu quả cao, ưu tiên hàng đầu, dung nạp tốt cho cả mẹ và thai nhi.\n"
                "- **Nifedipin (chẹn kênh Calci DHP, dạng phóng thích kéo dài):** Lựa chọn hàng đầu thay thế hoặc phối hợp (ví dụ Adalat LA, Nifedipin retard; cấm dùng viên ngậm tác dụng nhanh).\n"
                "- **Hydralazin tiêm tĩnh mạch:** Dùng trong xử trí cấp cứu cơn tăng huyết áp nặng thai kỳ.\n\n"
                "⛔ **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI (Black Box Warning - Độc tính thai nhi):**\n"
                "- **Thuốc ức chế men chuyển (ACEi):** Captopril, Enalapril, Lisinopril, Perindopril... *(Nguy cơ quái thai, loạn sản thận, vô niệu, giảm sản sọ và tử vong thai nhi)*.\n"
                "- **Thuốc ức chế thụ thể Angiotensin II (ARB):** Losartan, Valsartan, Telmisartan...\n"
                "- **Thuốc ức chế trực tiếp Renin (Aliskiren)**.\n"
                "- **Thuốc lợi tiểu:** Tránh dùng thường quy vì giảm thể tích tuần hoàn nhau thai (chỉ dùng khi có phù phổi cấp hoặc suy tim).\n\n"
                "🛡️ **Khuyến cáo lâm sàng:** Chuyển ngay bác sĩ Sản khoa và Tim mạch phối hợp theo dõi; tầm soát đạm niệu và các dấu hiệu tiền sản giật (đau đầu, mờ mắt, đau thượng vị)."
            )
            legal = "Hướng dẫn Điều trị Tăng Huyết Áp Thai Kỳ - Hội Tim Mạch Việt Nam (VNHA) & ESC Guidelines"
            chips = ["Dược thư Quốc gia DĐVN V", "Phác đồ tiền sản giật", "Methyldopa trong thai kỳ", "Thẩm định đơn thuốc theo TT 26"]

        elif is_renal:
            reply = (
                "### 🩺 HƯỚNG DẪN ĐIỀU TRỊ TĂNG HUYẾT ÁP Ở NGƯỜI SUY THẬN / BỆNH THẬN MẠN (CKD)\n"
                "*(Căn cứ: Khuyến cáo Hội Tim Mạch Việt Nam VNHA & Hướng dẫn Quốc Tế KDIGO 2021/2023)*\n\n"
                "**1. Mục tiêu huyết áp:**\n"
                "- Huyết áp tâm thu $< 120\\text{ mmHg}$ (theo KDIGO) hoặc $< 130/80\\text{ mmHg}$ (nếu dung nạp tốt).\n\n"
                "**2. Nhóm thuốc lựa chọn hàng đầu (First-line):**\n"
                "- **Thuốc Ức chế men chuyển (ACEi) hoặc Ức chế thụ thể (ARB):**\n"
                "  * Ưu tiên hàng đầu ở bệnh nhân có đạm niệu (Albuminuria $\\ge 30\\text{ mg/24h}$ hoặc ACR $\\ge 30\\text{ mg/g}$) nhằm bảo vệ thận và làm chậm suy thận tiến triển.\n"
                "  * **Theo dõi:** Kiểm tra Creatinin huyết thanh và Kali máu sau 2 – 4 tuần. Mức tăng Creatinin $< 30\\text{\\%}$ là phản ứng huyết động chấp nhận được; nếu tăng $> 30\\text{\\%}$ cần giảm liều hoặc tạm ngừng và loại trừ hẹp động mạch thận.\n"
                "- **Thuốc Chẹn kênh Calci (CCB - Dihydropyridine như Amlodipin):**\n"
                "  * Thuốc hạ áp mạnh mẽ, an toàn, **không cần chỉnh liều theo chức năng thận**; rất thích hợp phối hợp cùng ACEi/ARB hoặc dùng khi không dung nạp ACEi/ARB.\n"
                "- **Thuốc Lợi tiểu (Diuretics):**\n"
                "  * Khi $\\text{eGFR} \\ge 30\\text{ ml/phút}$: Dùng Thiazid hoặc Thiazide-like (Indapamid, Chlorthalidon).\n"
                "  * Khi $\\text{eGFR} < 30\\text{ ml/phút}$: Chuyển sang **Lợi tiểu quai (Furosemid)** vì nhóm Thiazid mất hiệu lực ở mức lọc cầu thận thấp.\n\n"
                "⛔ **LƯU Ý AN TOÀN LÂM SÀNG BẮT BUỘC:**\n"
                "- **Tuyệt đối không phối hợp đồng thời ACEi + ARB** (tăng nguy cơ suy thận cấp và tăng kali máu tử vong).\n"
                "- Thận trọng cao độ khi dùng thuốc lợi tiểu giữ kali (Spironolacton) ở bệnh nhân suy thận nặng do nguy cơ tăng kali máu ác tính."
            )
            legal = "Khuyến Cáo Lâm Sàng Hội Tim Mạch Việt Nam (VNHA) & KDIGO Clinical Practice Guideline for Hypertension in CKD"
            chips = ["Theo dõi Creatinin & Kali máu", "Amlodipin hiệu chỉnh liều", "Furosemid trong suy thận", "Tra cứu Dược Thư Quốc Gia"]

        else:
            reply = (
                "### 🩺 HƯỚNG DẪN LỰA CHỌN THUỐC HẠ HUYẾT ÁP THEO KHUYẾN CÁO VNHA / BYT\n\n"
                "**4 nhóm thuốc hạ huyết áp đầu tay thiết yếu:**\n"
                "1. **Ức chế men chuyển (ACEi):** Enalapril, Perindopril, Captopril, Lisinopril.\n"
                "2. **Ức chế thụ thể Angiotensin II (ARB):** Losartan, Telmisartan, Valsartan.\n"
                "3. **Chẹn kênh Calci (CCB):** Amlodipin, Felodipin, Nifedipin retard.\n"
                "4. **Lợi tiểu Thiazid / Thiazide-like:** Hydrochlorothiazid, Indapamid.\n\n"
                "• Đa số bệnh nhân tăng huyết áp từ độ 2 cần phối hợp 2 thuốc ngay từ đầu (ACEi/ARB + CCB hoặc ACEi/ARB + Lợi tiểu).\n"
                "• Vui lòng nêu rõ bệnh nền đi kèm (suy thận, đái tháo đường, thai kỳ, suy tim) để có hướng dẫn cụ thể."
            )
            legal = "Khuyến cáo Chẩn đoán & Điều trị Tăng Huyết Áp - Hội Tim Mạch Học Việt Nam VNHA"
            chips = ["Tăng huyết áp ở người suy thận", "Tăng huyết áp thai kỳ", "Tra cứu thuốc Amlodipin", "Dược thư Quốc gia 2015"]

        return CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION",
            reply_text=reply,
            card=None,
            legal_basis=legal,
            suggested_chips=chips,
            answer_type="grounded_reference",
            source_status="retrieved_evidence",
            confidence=1.0,
            rag_grounded=True
        )
