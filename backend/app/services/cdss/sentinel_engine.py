"""
CDSS Safety Sentinel Engine (Kỹ thuật 7).
Quy chuẩn FDA CDSS 2022 & ISMP High-Alert Medication Safety Guidelines.
Đánh giá công thức liều trần, đường dùng và tương tác nguy kịch dựa trên bảng tham số động (Zero Hardcoded Logic).
"""
import re
from typing import List, Optional
from pydantic import BaseModel, Field

class CDSSSafetyRule(BaseModel):
    rule_id: str = Field(description="Mã định danh quy tắc an toàn")
    title: str = Field(description="Tiêu đề cảnh báo CDSS")
    target_pattern: str = Field(description="Từ khóa hoặc hoạt chất áp dụng")
    max_single_qty: Optional[float] = Field(default=None, description="Ngưỡng số lượng/liều tối đa 1 lần")
    prohibited_routes: List[str] = Field(default_factory=list, description="Các đường dùng cấm kỵ tuyệt đối")
    fatal_co_medications: List[str] = Field(default_factory=list, description="Thuốc phối hợp gây tương kỵ tử vong")
    alert_level: str = Field(default="critical", description="critical | warning | caution")
    message: str = Field(description="Thông điệp cảnh báo lâm sàng")
    antidote: Optional[str] = Field(default=None, description="Thuốc giải độc đặc hiệu (nếu có)")
    legal_basis: str = Field(default="DĐVN V & QĐ 5948/QĐ-BYT", description="Căn cứ pháp lý y văn")

# Bảng tham số quy tắc an toàn dược lý động (Dynamic Parameter Registry)
DYNAMIC_CDSS_RULES: List[CDSSSafetyRule] = [
    CDSSSafetyRule(
        rule_id="CDSS_OPIOID_OVERDOSE_RESP_DEPRESSION",
        title="CẢNH BÁO NGUY CƠ NGỘ ĐỘC OPIOID QUÁ LIỀU (TT 20/2017/TT-BYT)",
        target_pattern=r"\b(morphin|morphine|fentanyl)\b",
        max_single_qty=3.0,
        alert_level="critical",
        message="Vượt ngưỡng an toàn cấp cứu ban đầu (tối đa 30mg). Nguy cơ ức chế trung tâm hô hấp và ngưng thở.",
        antidote="Chuẩn bị sẵn Naloxon 0.4mg/ml tĩnh mạch đối kháng nếu có suy hô hấp",
        legal_basis="Thông tư 20/2017/TT-BYT Điều 15"
    ),
    CDSSSafetyRule(
        rule_id="CDSS_OPIOID_BZD_FATAL_COADMIN",
        title="CẢNH BÁO TƯƠNG TÁC THUỐC ĐẶC BIỆT NGUY HIỂM: OPIOID + BENZODIAZEPINE (QĐ 5948/QĐ-BYT)",
        target_pattern=r"\b(morphin|morphine|fentanyl)\b",
        fatal_co_medications=["diazepam", "seduxen", "midazolam", "lorazepam"],
        alert_level="critical",
        message="Phối hợp Morphin và Diazepam gây tương tác hiệp đồng ức chế sâu thần kinh trung ương và suy hô hấp cấp tử vong.",
        antidote="Theo dõi liên tục SpO2, chuẩn bị bóng Ambu và Naloxon / Flumazenil giải độc",
        legal_basis="Quyết định 5948/QĐ-BYT & FDA Black Box Warning"
    ),
    CDSSSafetyRule(
        rule_id="CDSS_HIGH_ALERT_KCL_IV_PUSH",
        title="CẢNH BÁO TỬ VONG: THUỐC NGUY CƠ CAO KALI CLORID 10% (TT 22/2011/TT-BYT)",
        target_pattern=r"\b(kcl|kali\s+clorid|kali\s+chloride)\b",
        prohibited_routes=["tiêm", "tiêm tĩnh mạch trực tiếp", "tiêm thẳng tĩnh mạch", "iv push", "tiêm nhanh"],
        alert_level="critical",
        message="TUYỆT ĐỐI KHÔNG TIÊM TĨNH MẠCH TRỰC TIẾP. Tiêm bolus Kali Clorid 10% gây rung thất và ngừng tim tức thì.",
        antidote="BẮT BUỘC pha loãng trong NaCl 0.9% với nồng độ không quá 40 mEq/L và truyền tĩnh mạch qua bơm tiêm điện",
        legal_basis="Thông tư 22/2011/TT-BYT Danh mục Thuốc Nguy Cơ Cao"
    )
]

class CDSSSentinelResult(BaseModel):
    is_safe: bool = Field(default=True)
    alert_level: str = Field(default="clear")
    title: str = Field(default="")
    message: str = Field(default="Y lệnh dược lý an toàn trong giới hạn cho phép.")
    antidote: Optional[str] = None
    triggered_rule_id: Optional[str] = None
    legal_basis: Optional[str] = None

def evaluate_cdss_safety(
    med_name: str,
    quantity: float = 1.0,
    route: str = "",
    context_text: str = ""
) -> CDSSSentinelResult:
    """Thẩm định an toàn dược lý tự động qua Sentinel Rule Engine."""
    clean_med = med_name.lower().strip()
    clean_route = route.lower().strip()
    clean_context = context_text.lower().strip()
    combined_scope = f"{clean_med} {clean_route} {clean_context}"

    for rule in DYNAMIC_CDSS_RULES:
        if not re.search(rule.target_pattern, clean_med):
            continue

        # 1. Kiểm tra phối hợp kỵ nhau (ưu tiên phát hiện tương tác trước)
        if any(fatal in combined_scope for fatal in rule.fatal_co_medications):
            return CDSSSentinelResult(
                is_safe=False,
                alert_level=rule.alert_level,
                title=rule.title,
                message=rule.message,
                antidote=rule.antidote,
                triggered_rule_id=rule.rule_id,
                legal_basis=rule.legal_basis
            )

        # 2. Kiểm tra vượt liều đơn
        if rule.max_single_qty is not None and quantity > rule.max_single_qty:
            return CDSSSentinelResult(
                is_safe=False,
                alert_level=rule.alert_level,
                title=rule.title,
                message=f"Tổng liều yêu cầu là {int(quantity)} đơn vị, {rule.message}",
                antidote=rule.antidote,
                triggered_rule_id=rule.rule_id,
                legal_basis=rule.legal_basis
            )

        # 3. Kiểm tra đường dùng cấm kỵ (ví dụ tiêm trực tiếp KCl mà không pha/truyền)
        if rule.prohibited_routes:
            has_prohibited = any(pr in combined_scope for pr in rule.prohibited_routes)
            has_safe_override = any(w in combined_scope for w in ["pha", "truyền", "bơm tiêm điện", "loãng"])
            if has_prohibited and not has_safe_override:
                return CDSSSentinelResult(
                    is_safe=False,
                    alert_level=rule.alert_level,
                    title=rule.title,
                    message=rule.message,
                    antidote=rule.antidote,
                    triggered_rule_id=rule.rule_id,
                    legal_basis=rule.legal_basis
                )

    return CDSSSentinelResult(is_safe=True, alert_level="clear")
