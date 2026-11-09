"""Hệ thống Suy Luận Lâm Sàng Nhi Khoa & Hiệu Chỉnh Liều Dược Thư (Clinical Demographic Slot-Reasoning Engine).

Tuân thủ:
- Dược thư Quốc gia Việt Nam (DĐVN V, QĐ 2033/QĐ-BYT).
- Hướng dẫn Kê đơn Nhi khoa Quốc gia & BNF for Children.
- Phong cách Y khoa Thụy Sĩ (Swiss Medical / UpToDate): Không emoji, cấu trúc rõ ràng, lập luận theo slot độ tuổi/thể trọng.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Optional, Tuple


def _remove_accents(input_str: str) -> str:
    nfkd = unicodedata.normalize("NFKD", input_str)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def extract_demographic_slots(query: str) -> Dict[str, Any]:
    """Trích xuất các slot nhân khẩu học và lâm sàng từ câu truy vấn (Tuổi, Cân nặng, Đường dùng)."""
    q_lower = query.casefold()
    slots: Dict[str, Any] = {
        "age_years": None,
        "age_months": None,
        "age_weeks": None,
        "weight_kg": None,
        "is_neonate": False,
        "is_pediatric": False,
        "route_preference": None,
    }

    # 1. Phát hiện sơ sinh / thiếu tháng
    if any(k in q_lower for k in ["so sinh", "sơ sinh", "thieu thang", "thiếu tháng", "non thang", "non tháng", "neonate", "preterm"]):
        slots["is_neonate"] = True
        slots["is_pediatric"] = True

    # Kiểm tra loại trừ: Nếu câu hỏi về thai kỳ (mang thai 3 tháng, 3 tháng đầu, tuổi thai...)
    is_pregnancy_context = bool(
        re.search(r'(?:thai|mang thai|có thai|bà bầu|mẹ bầu).{0,20}\d+\s*tháng|\d+\s*tháng\s*(?:đầu|giữa|cuối|tuổi thai|thai kỳ)', q_lower)
    )

    # 2. Bóc tách tuổi theo tháng (chỉ bóc tách khi có tiền tố trẻ em hoặc hậu tố "tháng tuổi", không bẫy thai kỳ)
    if not is_pregnancy_context:
        m_month = re.search(r'(?:(?:bé|trẻ|cháu|em bé|bệnh nhi|con)\s*(\d+)\s*(?:tháng|tháng tuổi|thang|thang tuoi|mo\b))|(?:(\d+)\s*(?:tháng tuổi|thang tuoi))', q_lower)
        if m_month:
            try:
                m_str = m_month.group(1) or m_month.group(2)
                if m_str:
                    months = int(m_str)
                    slots["age_months"] = months
                    slots["is_pediatric"] = True
                    if months >= 12:
                        slots["age_years"] = round(months / 12, 1)
            except ValueError:
                pass

    # 3. Bóc tách tuổi theo năm
    m_year = re.search(r'(?:bé|trẻ|cháu|em bé|bệnh nhi|trẻ em)?\s*(\d+(?:[.,]\d+)?)\s*(?:tuổi|tuoi|yo\b|t\b)', q_lower)
    if m_year:
        try:
            val_str = m_year.group(1).replace(",", ".")
            years = float(val_str)
            slots["age_years"] = years
            if years < 18:
                slots["is_pediatric"] = True
        except ValueError:
            pass

    # Từ khóa chữ: "mười hai tuổi", "mười tuổi", "ba tuổi", v.v.
    word_to_num = {
        "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5, "sáu": 6,
        "bảy": 7, "tám": 8, "chín": 9, "mười": 10, "mười một": 11,
        "mười hai": 12, "mười ba": 13, "mười bốn": 14, "mười lăm": 15,
        "mười sáu": 16, "mười bảy": 17, "mười tám": 18
    }
    for w, num in word_to_num.items():
        if f"{w} tuổi" in q_lower or f"{w} tuoi" in q_lower:
            slots["age_years"] = float(num)
            if num < 18:
                slots["is_pediatric"] = True
            break

    # 4. Bóc tách cân nặng (kg)
    m_weight = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:kg|cân|can|ký|ky|kí|ki)\b', q_lower)
    if m_weight:
        try:
            w_str = m_weight.group(1).replace(",", ".")
            slots["weight_kg"] = float(w_str)
        except ValueError:
            pass

    # 5. Bóc tách đường dùng ưu tiên
    if any(k in q_lower for k in ["uống", "uong", "siro", "si-rô", "viên", "cốm", "com", "gói", "goi", "oral"]):
        slots["route_preference"] = "oral"
    elif any(k in q_lower for k in ["đặt", "dat", "nhét", "nhet", "hậu môn", "hau mon", "trực tràng", "truc trang", "rectal"]):
        slots["route_preference"] = "rectal"
    elif any(k in q_lower for k in ["tiêm", "tiem", "truyền", "truyen", "tĩnh mạch", "tinh mach", "iv", "im"]):
        slots["route_preference"] = "iv"

    # Nhận diện chung câu hỏi nhi khoa
    if any(k in q_lower for k in ["trẻ em", "tre em", "trẻ", "tre", "bé", "be", "cháu", "chau", "nhi khoa", "bệnh nhi", "pediatric"]):
        slots["is_pediatric"] = True

    return slots


def is_pediatric_query(query: str) -> bool:
    """Kiểm tra câu hỏi có liên quan đến đối tượng trẻ em / nhi khoa hay không."""
    slots = extract_demographic_slots(query)
    return bool(slots["is_pediatric"] or slots["is_neonate"] or slots["age_years"] is not None or slots["age_months"] is not None)


def _reason_paracetamol_dosage(query: str, slots: Dict[str, Any], weight_kg: Optional[float] = None) -> str:
    """Suy luận liều Paracetamol chuẩn DĐVN V & BNF theo slot tuổi và cân nặng."""
    age_y = slots.get("age_years")
    age_m = slots.get("age_months")
    is_neo = slots.get("is_neonate")
    route = slots.get("route_preference") or "oral"

    # Nếu có cân nặng
    weight_calc_line = ""
    if weight_kg and weight_kg > 0:
        single_min = round(weight_kg * 10)
        single_max = round(weight_kg * 15)
        daily_max = round(weight_kg * 60)
        weight_calc_line = (
            f"\n    * **Tính toán chính xác theo cân nặng ({weight_kg} kg):**\n"
            f"      - Liều 1 lần (10 – 15 mg/kg): **{single_min} – {single_max} mg/lần**.\n"
            f"      - Giới hạn tối đa 24 giờ (60 mg/kg/ngày): **không vượt quá {daily_max} mg/ngày**."
        )

    # 1. Trường hợp trẻ 12 tuổi (hoặc trong khoảng 10 - 16 tuổi)
    if age_y is not None and 10 <= age_y <= 16:
        bracket_name = f"trẻ {int(age_y) if age_y.is_integer() else age_y} tuổi"
        return (
            f"[Liều dùng khuyến cáo cho {bracket_name}]:\n"
            f"- **Đường uống (Dạng ưu tiên hàng đầu):**\n"
            f"  * **Liều mỗi lần:** **500 mg/lần** (khoảng liều Dược thư Quốc gia V khuyến cáo: **480 – 750 mg/lần** tùy thể trạng).\n"
            f"  * **Khoảng cách dùng:** Mỗi **4 – 6 giờ/lần** khi cần (chỉ dùng khi sốt ≥ 38.5°C hoặc đau vừa).\n"
            f"  * **Tần suất tối đa:** Tối đa **4 lần / 24 giờ** (tổng liều không vượt quá 2.000 – 3.000 mg/24 giờ).\n"
            f"  * **Đối chiếu theo thể trọng:** Liều chuẩn là **10 – 15 mg/kg/lần** (ví dụ: trẻ 12 tuổi thể trọng trung bình 35 – 45 kg tương đương 350 – 500 mg/lần, tối đa 60 mg/kg/ngày).{weight_calc_line}\n\n"
            f"- **Đường dùng thay thế (Khi trẻ nôn trớ nhiều hoặc không thể uống):**\n"
            f"  * **Đặt trực tràng:** **500 mg/lần**, cách mỗi 4 – 6 giờ nếu cần, tối đa 4 lần/24 giờ.\n"
            f"  * **Truyền tĩnh mạch (Tại cơ sở y tế):** Nếu thể trọng 10 – 50 kg: **15 mg/kg/lần**, truyền trong 15 phút, cách nhau 4 – 6 giờ, tối đa 60 mg/kg/24 giờ.\n\n"
            f"> [!WARNING] NGUYÊN TẮC AN TOÀN & THỰC HÀNH LÂM SÀNG\n"
            f"> • Khoảng cách giữa 2 lần dùng tối thiểu là 4 giờ; tuyệt đối không rút ngắn thời gian giữa các liều.\n"
            f"> • Không tự ý dùng liên tục quá 3 ngày để hạ sốt hoặc quá 5 ngày để giảm đau nếu không có chỉ định tái khám của bác sĩ.\n"
            f"> • Rà soát cẩn thận tránh dùng đồng thời các thuốc cảm cúm, viên sủi hoặc siro khác có chứa Paracetamol để phòng ngộ độc gan cấp tính."
        )

    # 2. Trường hợp trẻ 16 - 18 tuổi (gần người lớn)
    if age_y is not None and age_y > 16:
        return (
            f"[Liều dùng khuyến cáo cho trẻ {int(age_y)} tuổi]:\n"
            f"- **Đường uống:** **500 mg – 1.000 mg (1 g)/lần**, mỗi 4 – 6 giờ khi cần, tối đa 4 lần/24 giờ (tối đa không quá 4 g/24 giờ).\n"
            f"- **Đặt trực tràng:** 500 mg – 1.000 mg/lần, cách 4 – 6 giờ, tối đa 4 lần/24 giờ.{weight_calc_line}\n\n"
            f"> [!WARNING] NGUYÊN TẮC AN TOÀN\n"
            f"> • Khoảng cách tối thiểu 4 giờ giữa các lần dùng; liều tối đa tuyệt đối là 4.000 mg/24 giờ."
        )

    # 3. Trường hợp trẻ 6 - 10 tuổi
    if age_y is not None and 6 <= age_y < 10:
        bracket_dose = "240 – 250 mg" if age_y < 8 else "360 – 375 mg"
        return (
            f"[Liều dùng khuyến cáo cho trẻ {int(age_y)} tuổi]:\n"
            f"- **Đường uống:** **{bracket_dose}/lần** (tương đương chuẩn 10 – 15 mg/kg/lần), mỗi 4 – 6 giờ nếu cần, tối đa 4 lần/24 giờ.\n"
            f"- **Đặt trực tràng:** 250 mg/lần, cách 4 – 6 giờ nếu trẻ nôn không uống được.{weight_calc_line}\n\n"
            f"> [!WARNING] NGUYÊN TẮC AN TOÀN\n"
            f"> • Tối đa 4 lần trong 24 giờ. Khoảng cách tối thiểu giữa 2 liều là 4 giờ."
        )

    # 4. Trường hợp trẻ 2 - 6 tuổi
    if age_y is not None and 2 <= age_y < 6:
        bracket_dose = "180 mg" if age_y < 4 else "240 mg"
        return (
            f"[Liều dùng khuyến cáo cho trẻ {int(age_y)} tuổi]:\n"
            f"- **Đường uống (Gói bột/Hỗn dịch):** **{bracket_dose}/lần** (tính theo chuẩn 10 – 15 mg/kg/lần), cách mỗi 4 – 6 giờ khi sốt ≥ 38.5°C, tối đa 4 lần/24 giờ.\n"
            f"- **Đặt trực tràng:** 125 mg – 250 mg/lần khi trẻ nôn trớ.{weight_calc_line}\n\n"
            f"> [!WARNING] NGUYÊN TẮC AN TOÀN\n"
            f"> • Sử dụng cốc đong/xi lanh chuẩn; không dùng thìa ăn cơm để chia liều."
        )

    # 5. Trường hợp trẻ nhũ nhi (1 tháng - dưới 2 tuổi)
    if (age_m is not None and 1 <= age_m < 24) or (age_y is not None and age_y < 2):
        months = age_m if age_m is not None else int((age_y or 1) * 12)
        if months <= 3:
            infant_dose = "30 – 60 mg/lần, uống nhắc lại sau 8 giờ nếu cần"
        elif months <= 6:
            infant_dose = "60 mg/lần, mỗi 4 – 6 giờ, tối đa 4 lần/24 giờ"
        else:
            infant_dose = "120 mg/lần, mỗi 4 – 6 giờ, tối đa 4 lần/24 giờ"

        return (
            f"[Liều dùng khuyến cáo cho trẻ {months} tháng tuổi]:\n"
            f"- **Đường uống:** **{infant_dose}** (đối chiếu theo thể trọng: **10 – 15 mg/kg/lần**).\n"
            f"- **Đặt trực tràng:** 60 – 125 mg/lần khi trẻ quấy khóc không uống được thuốc.{weight_calc_line}\n\n"
            f"> [!WARNING] NGUYÊN TẮC AN TOÀN\n"
            f"> • Cần theo dõi sát nhiệt độ và dấu hiệu mất nước của bé. Đưa trẻ đi khám ngay nếu sốt cao liên tục không hạ."
        )

    # 6. Trường hợp sơ sinh
    if is_neo or (age_m is not None and age_m < 1):
        return (
            f"[Liều dùng chỉ định cho Trẻ sơ sinh]:\n"
            f"- **Lưu ý chuyên môn:** Sơ sinh cần được bác sĩ chuyên khoa nhi thăm khám và chỉ định trực tiếp.\n"
            f"- **Đường uống (Sơ sinh đủ tháng > 32 tuần):** 10 – 15 mg/kg một liều duy nhất, sau đó mỗi 8 – 12 giờ nếu cần thiết; liều tối đa 30 – 60 mg/kg/ngày.{weight_calc_line}\n\n"
            f"> [!WARNING] CẢNH BÁO AN TOÀN TRẺ SƠ SINH\n"
            f"> • Tuyệt đối không tự ý cho trẻ sơ sinh dùng thuốc hạ sốt tại nhà mà không có y lệnh của bác sĩ."
        )

    # 7. Mặc định chung có tính toán theo cân nặng nếu không rõ tuổi cụ thể
    if weight_kg and weight_kg > 0:
        single_min = round(weight_kg * 10)
        single_max = round(weight_kg * 15)
        daily_max = round(weight_kg * 60)
        return (
            f"[Liều dùng tính toán cho trẻ cân nặng {weight_kg} kg]:\n"
            f"- **Liều khuyến cáo mỗi lần (10 – 15 mg/kg):** **{single_min} – {single_max} mg/lần**.\n"
            f"- **Khoảng cách dùng:** Mỗi **4 – 6 giờ/lần** khi cần (sốt ≥ 38.5°C hoặc đau), tối đa 4 lần / 24 giờ.\n"
            f"- **Liều tối đa 24 giờ (60 mg/kg/ngày):** **Không quá {daily_max} mg/ngày**.\n\n"
            f"> [!WARNING] Cảnh báo an toàn quan trọng\n"
            f"> • Khoảng cách tối thiểu giữa 2 lần dùng là 4 giờ; không dùng quá liều trần 60 mg/kg/ngày."
        )

    # 8. Mặc định tổng quát có cấu trúc sạch sẽ (không dump text thô)
    return (
        f"[Nguyên tắc tính liều Paracetamol cho Trẻ em (DĐVN V)]:\n"
        f"- **Công thức chuẩn toàn cầu theo thể trọng:** **10 – 15 mg/kg/lần**, cách mỗi **4 – 6 giờ/lần** khi có sốt (≥ 38.5°C) hoặc đau.\n"
        f"- **Giới hạn an toàn:** Tối đa **4 lần / 24 giờ** (tổng liều tối đa không vượt quá **60 mg/kg/ngày**).\n"
        f"- **Phân liều nhanh theo nhóm tuổi (Dạng viên/gói uống):**\n"
        f"  * Trẻ 3 – 6 tháng: 60 mg/lần.\n"
        f"  * Trẻ 6 tháng – 2 tuổi: 120 mg/lần (gói 80mg hoặc 150mg chỉnh theo cân nặng).\n"
        f"  * Trẻ 2 – 4 tuổi: 180 mg/lần.\n"
        f"  * Trẻ 4 – 6 tuổi: 240 mg/lần (gói 250mg).\n"
        f"  * Trẻ 6 – 12 tuổi: 250 – 500 mg/lần.\n"
        f"  * Trẻ trên 12 tuổi: 500 mg/lần (tối đa 750 mg/lần tùy thể trạng).\n\n"
        f"> [!WARNING] Cảnh báo an toàn quan trọng\n"
        f"> • Khoảng cách tối thiểu giữa 2 lần uống là 4 giờ; rà soát tránh dùng trùng lặp các chế phẩm cảm cúm khác."
    )


def _reason_ibuprofen_dosage(query: str, slots: Dict[str, Any], weight_kg: Optional[float] = None) -> str:
    """Suy luận liều Ibuprofen theo lứa tuổi và thể trọng."""
    age_y = slots.get("age_years")
    if age_y is not None and age_y >= 12:
        return (
            f"[Liều dùng Ibuprofen cho trẻ {int(age_y)} tuổi]:\n"
            f"- **Đường uống:** **200 – 400 mg/lần**, uống sau bữa ăn no, mỗi 6 – 8 giờ khi cần thiết.\n"
            f"- **Liều tối đa:** Không vượt quá **1.200 mg/24 giờ** đối với tự điều trị ngoại trú (tối đa 2.400 mg/ngày nếu có chỉ định chuyên khoa).\n\n"
            f"> [!WARNING] CHỐNG CHỈ ĐỊNH & THẬN TRỌNG\n"
            f"> • Bắt buộc uống sau ăn no với nhiều nước để giảm nguy cơ kích ứng dạ dày.\n"
            f"> • Tuyệt đối chống chỉ định khi nghi ngờ Sốt xuất huyết Dengue, loét tiêu hóa hoặc suy thận."
        )

    if weight_kg and weight_kg > 0:
        single_min = round(weight_kg * 5)
        single_max = round(weight_kg * 10)
        daily_max = round(weight_kg * 30)
        return (
            f"[Liều dùng Ibuprofen cho trẻ ({weight_kg} kg)]:\n"
            f"- **Liều chuẩn theo thể trọng:** **5 – 10 mg/kg/lần** (tương đương **{single_min} – {single_max} mg/lần**).\n"
            f"- **Khoảng cách liều:** Mỗi **6 – 8 giờ/lần**, uống sau ăn, tối đa 3 – 4 lần/24 giờ (tối đa **{daily_max} mg/ngày**).\n\n"
            f"> [!WARNING] THẬN TRỌNG\n"
            f"> • Chỉ dùng cho trẻ từ 3 tháng tuổi trở lên hoặc nặng trên 5 kg; không dùng khi sốt xuất huyết."
        )

    return (
        f"[Liều dùng Ibuprofen Trẻ em (DĐVN V)]:\n"
        f"- **Công thức tính liều:** **5 – 10 mg/kg/lần**, mỗi 6 – 8 giờ sau khi ăn no, tối đa **30 mg/kg/ngày**.\n"
        f"- Trẻ từ 12 tuổi trở lên: Dùng liều 200 – 400 mg/lần, mỗi 6 – 8 giờ (tối đa 1.200 mg/ngày).\n\n"
        f"> [!WARNING] THẬN TRỌNG\n"
        f"> • Chống chỉ định trong sốt xuất huyết Dengue hoặc bệnh lý xuất huyết."
    )


def _reason_generic_dosage_from_monograph(
    raw_text: str,
    slots: Dict[str, Any]
) -> Optional[str]:
    """Trích xuất và lọc chuyên biệt nhóm tuổi mục tiêu từ chuyên luận Dược thư thô."""
    if not raw_text or len(raw_text.strip()) < 10:
        return None

    age_y = slots.get("age_years")
    if age_y is None:
        return None

    # Tìm kiếm các câu hoặc đoạn tương ứng với độ tuổi
    target_patterns = [
        rf"(?:trẻ|trẻ em|từ)?\s*(?:\d+\s*[-–]\s*)?{int(age_y)}\s*tuổi[^\.\n;]+[\.\n;]?",
        rf"{int(age_y)}\s*[-–]\s*\d+\s*tuổi[^\.\n;]+[\.\n;]?",
        rf"\btrên\s*{int(age_y) - 2}\s*tuổi[^\.\n;]+[\.\n;]?",
        rf">\s*{int(age_y) - 2}\s*tuổi[^\.\n;]+[\.\n;]?",
    ]

    matched_sentences = []
    for pat in target_patterns:
        matches = re.findall(pat, raw_text, re.IGNORECASE)
        for m in matches:
            clean_m = m.strip().strip(";-•*")
            if clean_m and clean_m not in matched_sentences:
                # Loại trừ nếu chứa sơ sinh hoặc thiếu tháng khi đang tìm cho trẻ lớn
                if age_y >= 2 and any(k in clean_m.lower() for k in ["sơ sinh", "thiếu tháng", "tuần tuổi thai"]):
                    continue
                matched_sentences.append(clean_m)

    if matched_sentences:
        bullets = "\n".join(f"  * {s}" for s in matched_sentences)
        return (
            f"[Liều dùng trích xuất từ Dược thư cho nhóm tuổi {int(age_y)} tuổi]:\n"
            f"{bullets}\n\n"
            f"> [!NOTE]\n"
            f"> Vui lòng đối chiếu với cân nặng thực tế và tờ hướng dẫn sử dụng đi kèm sản phẩm cụ thể."
        )

    return None


def reason_pediatric_dosage(
    drug_name: str,
    clean_inn: str,
    raw_pediatric_dosage: str,
    query: str,
    slots: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Suy luận chuyên biệt liều dùng nhi khoa, loại bỏ việc đổ toàn bộ dữ liệu sơ sinh/các lứa tuổi khác."""
    if slots is None:
        slots = extract_demographic_slots(query)

    # Chặn cứng an toàn: Nếu bệnh nhân từ 18 tuổi trở lên, tuyệt đối KHÔNG áp dụng liều nhi khoa
    age_years = slots.get("age_years")
    if age_years is not None and age_years >= 18.0:
        return None

    norm_inn = _remove_accents(clean_inn.casefold())
    norm_drug = _remove_accents(drug_name.casefold())
    combined = f"{norm_inn} {norm_drug}"
    weight = slots.get("weight_kg")

    # 1. Chuyên luận chuyên sâu cho Paracetamol
    if any(k in combined for k in ["paracetamol", "acetaminophen", "panadol", "efferalgan", "hapacol"]):
        return _reason_paracetamol_dosage(query, slots, weight)

    # 2. Chuyên luận chuyên sâu cho Ibuprofen
    if any(k in combined for k in ["ibuprofen", "advil", "brufen", "gofen"]):
        return _reason_ibuprofen_dosage(query, slots, weight)

    # 3. Trích xuất lọc nhóm tuổi mục tiêu từ chuyên luận Dược thư thô
    focused_from_raw = _reason_generic_dosage_from_monograph(raw_pediatric_dosage, slots)
    if focused_from_raw:
        return focused_from_raw

    # 4. Nếu không lọc được câu riêng nhưng có độ tuổi cụ thể
    if slots.get("age_years") is not None and raw_pediatric_dosage:
        age_y = slots["age_years"]
        # Lọc bỏ các dòng sơ sinh nếu age_y >= 2
        lines = [l.strip() for l in raw_pediatric_dosage.splitlines() if l.strip()]
        filtered_lines = []
        for line in lines:
            l_lower = line.lower()
            if age_y >= 2 and any(k in l_lower for k in ["sơ sinh", "28 - 32 tuần", "chỉnh theo tuổi thai"]):
                continue
            filtered_lines.append(line)

        if filtered_lines:
            return (
                f"[Thông tin liều dùng Dược thư đối soát (đã loại bỏ nhóm sơ sinh)]:\n"
                + "\n".join(f"• {l}" for l in filtered_lines[:5])
                + "\n\n> [!WARNING] CẢNH BÁO AN TOÀN\n> • Bắt buộc tính toán liều chính xác theo cân nặng thực tế của trẻ."
            )

    return None
