"""
Renal Dosage Adjustment Knowledge Base & Rule Grounding.
Tuân thủ:
- Dược thư Quốc gia Việt Nam (DĐVN V, QĐ 2033/QĐ-BYT).
- Hướng dẫn điều chỉnh liều kháng sinh trong suy thận (Bộ Y tế).
- Thông tư 45/2018/TT-BYT & CSDL Chuyên luận thuốc bệnh viện.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
from app.services.clinical_reasoning.clinical_math_engine import RenalFunctionAssessment


@dataclass(frozen=True)
class RenalDosingRecommendation:
    """Khuyến cáo hiệu chỉnh liều suy thận có bảo chứng pháp lý."""
    drug_name: str
    active_ingredient: str
    standard_adult_dose: str
    patient_crcl: float
    kdigo_stage: str
    is_dose_adjusted: bool
    is_contraindicated: bool
    recommended_dose: str
    dosing_interval: str
    clinical_rationale: str
    safety_warning: str
    legal_basis: str
    citation_document_id: str
    citation_page: int
    pdf_url: str


@dataclass(frozen=True)
class RenalDrugRule:
    drug_identifiers: Tuple[str, ...]
    canonical_name: str
    active_ingredient: str
    standard_dose: str
    # List of (min_crcl, max_crcl, recommended_dose, interval, is_contraindicated, rationale)
    tiers: Tuple[Tuple[float, float, str, str, bool, str], ...]
    safety_warning: str
    citation_page: int
    citation_title: str
    pdf_url: str


def _clean_str(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s.casefold())
    no_acc = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^\w\s]", "", no_acc).strip()


_RENAL_DRUG_RULES: Tuple[RenalDrugRule, ...] = (
    # 1. Ciprofloxacin
    RenalDrugRule(
        drug_identifiers=("ciprofloxacin", "cipro", "ciprobay"),
        canonical_name="Ciprofloxacin",
        active_ingredient="Ciprofloxacin",
        standard_dose="250 mg – 750 mg mỗi 12 giờ (đường uống); hoặc 200 mg – 400 mg mỗi 12 giờ (truyền tĩnh mạch).",
        tiers=(
            (50.0, 999.0, "250 mg – 750 mg", "Mỗi 12 giờ", False, "Chức năng thận bình thường hoặc giảm nhẹ, dùng liều thông thường."),
            (30.0, 50.0, "250 mg – 500 mg", "Mỗi 12 giờ", False, "Suy thận mức độ trung bình, duy trì khoảng cách 12 giờ nhưng dùng cận dưới mức liều."),
            (0.0, 30.0, "250 mg – 500 mg", "Mỗi 18 – 24 giờ", False, "Suy thận nặng: Bắt buộc kéo dài khoảng cách dùng thuốc lên mỗi 18 - 24 giờ để tránh tích lũy thuốc."),
        ),
        safety_warning="Cảnh báo tích lũy Ciprofloxacin trong suy thận: Tăng nguy cơ độc thần kinh trung ương (co giật, lú lẫn), viêm gân gót Achilles và kéo dài khoảng QT.",
        citation_page=412,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Ciprofloxacin, Trang 412)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=412"
    ),

    # 2. Levofloxacin
    RenalDrugRule(
        drug_identifiers=("levofloxacin", "levo", "tavanic", "cravit"),
        canonical_name="Levofloxacin",
        active_ingredient="Levofloxacin",
        standard_dose="500 mg mỗi 24 giờ (đường uống hoặc truyền tĩnh mạch).",
        tiers=(
            (50.0, 999.0, "500 mg", "Mỗi 24 giờ", False, "Chức năng thận bảo tồn, dùng liều chuẩn 500 mg/24h."),
            (20.0, 50.0, "Liều đầu 500 mg, sau đó 250 mg", "Mỗi 24 giờ", False, "Hiệu chỉnh liều: Khởi đầu 500 mg, sau đó giảm 50% liều duy trì (250 mg mỗi 24 giờ)."),
            (10.0, 20.0, "Liều đầu 500 mg, sau đó 125 mg", "Mỗi 24 giờ (hoặc 250 mg mỗi 48 giờ)", False, "Suy thận nặng: Giảm liều duy trì còn 125 mg/24h hoặc 250 mg/48h."),
            (0.0, 10.0, "Liều đầu 500 mg, sau đó 125 mg", "Mỗi 48 giờ", False, "Suy thận giai đoạn cuối / thẩm tách máu: 125 mg mỗi 48 giờ sau lọc máu."),
        ),
        safety_warning="Levofloxacin đào thải tới 80% qua thận ở dạng còn hoạt tính; suy thận không chỉnh liều sẽ gây ngộ độc cấp và rối loạn nhịp thất.",
        citation_page=842,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Levofloxacin, Trang 842)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=842"
    ),

    # 3. Enoxaparin (Lovenox)
    RenalDrugRule(
        drug_identifiers=("enoxaparin", "lovenox"),
        canonical_name="Enoxaparin",
        active_ingredient="Enoxaparin natri",
        standard_dose="Điều trị huyết khối: 1 mg/kg mỗi 12 giờ (tiêm dưới da) hoặc 1.5 mg/kg mỗi 24 giờ.",
        tiers=(
            (30.0, 999.0, "1 mg/kg", "Mỗi 12 giờ", False, "Chức năng thận đủ điều kiện dùng liều điều trị thông thường."),
            (15.0, 30.0, "1 mg/kg", "Mỗi 24 giờ duy nhất", False, "Suy thận nặng: Bắt buộc giảm tần suất dùng thuốc từ 2 lần/ngày xuống 1 lần/ngày (mỗi 24h) để tránh tích lũy nguy cơ xuất huyết tử vong."),
            (0.0, 15.0, "CHỐNG CHỈ ĐỊNH / HẾT SỨC THẬN TRỌNG", "Không khuyến cáo sử dụng", True, "Chống chỉ định tương đối cho suy thận giai đoạn cuối (CrCl < 15 ml/phút) trừ khi có giám sát xét nghiệm hoạt tính anti-Xa chuyên biệt."),
        ),
        safety_warning="Enoxaparin đào thải chủ yếu qua thận. Suy thận nặng (CrCl < 30 ml/phút) nếu không giảm liều sẽ gây tích lũy hoạt tính chống đông dẫn tới xuất huyết nội sọ hoặc xuất huyết tiêu hóa ồ ạt.",
        citation_page=535,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Enoxaparin natri, Trang 535)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=535"
    ),

    # 4. Metformin
    RenalDrugRule(
        drug_identifiers=("metformin", "glucophage", "panfor"),
        canonical_name="Metformin",
        active_ingredient="Metformin hydroclorid",
        standard_dose="500 mg – 1000 mg x 2–3 lần/ngày, tối đa 2000 – 2550 mg/ngày.",
        tiers=(
            (60.0, 999.0, "500 mg – 1000 mg x 2 lần/ngày", "Mỗi 12 giờ", False, "eGFR >= 60 ml/phút: Sử dụng liều thông thường."),
            (45.0, 60.0, "Tối đa 1500 mg/ngày chia làm 2 lần", "Mỗi 12 giờ", False, "Giảm liều tối đa còn 1500 mg/ngày; theo dõi chức năng thận mỗi 3 - 6 tháng."),
            (30.0, 45.0, "Tối đa 500 mg – 1000 mg/ngày", "Mỗi 24 giờ", False, "Không khởi đầu điều trị mới; nếu đang dùng, giảm 50% liều tối đa (không quá 1000 mg/ngày)."),
            (0.0, 30.0, "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI", "Ngừng thuốc ngay lập tức", True, "Chống chỉ định tuyệt đối khi eGFR/CrCl < 30 ml/phút/1.73m2 do nguy cơ nhiễm toan acid lactic đe dọa tính mạng (tỷ lệ tử vong > 50%)."),
        ),
        safety_warning="CẢNH BÁO NGUY CƠ NHIỄM TOAN ACID LACTIC: Metformin chống chỉ định tuyệt đối khi CrCl/eGFR < 30 ml/phút do nguy cơ toan acid lactic tử vong cao. Cần chuyển ngay sang Insulin hoặc thuốc hạ đường huyết an toàn cho thận.",
        citation_page=964,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Metformin, Trang 964)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=964"
    ),

    # 5. Allopurinol
    RenalDrugRule(
        drug_identifiers=("allopurinol", "zyloric", "milurit"),
        canonical_name="Allopurinol",
        active_ingredient="Allopurinol",
        standard_dose="100 mg – 300 mg/ngày (tối đa 600 - 800 mg/ngày ở ca gút nặng).",
        tiers=(
            (50.0, 999.0, "100 mg – 300 mg/ngày", "Mỗi 24 giờ", False, "Chức năng thận bình thường, dùng liều khởi đầu 100mg và chỉnh theo nồng độ acid uric."),
            (20.0, 50.0, "100 mg – 200 mg/ngày", "Mỗi 24 giờ", False, "Suy thận trung bình: Giảm liều tối đa xuống 200 mg/ngày."),
            (10.0, 20.0, "100 mg/ngày", "Mỗi 24 giờ", False, "Suy thận nặng: Liều tối đa 100 mg/ngày."),
            (0.0, 10.0, "100 mg cách ngày", "Mỗi 48 giờ (hoặc 50 mg/ngày)", False, "Suy thận giai đoạn cuối: 100 mg cách ngày hoặc nới rộng khoảng cách."),
        ),
        safety_warning="Nguy cơ hội chứng quá mẫn nghiêm trọng (Hội chứng Stevens-Johnson / DRESS) tăng vọt ở bệnh nhân suy thận dùng Allopurinol liều cao.",
        citation_page=128,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Allopurinol, Trang 128)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=128"
    ),

    # 6. Amoxicillin / Clavulanic Acid (Augmentin)
    RenalDrugRule(
        drug_identifiers=("amoxicillin clavulanic", "augmentin", "amoxicillin va acid clavulanic", "amoclav"),
        canonical_name="Amoxicillin / Acid Clavulanic",
        active_ingredient="Amoxicillin + Acid clavulanic",
        standard_dose="500/125 mg x 3 lần/ngày hoặc 875/125 mg x 2 lần/ngày.",
        tiers=(
            (30.0, 999.0, "500/125 mg mỗi 8h hoặc 875/125 mg mỗi 12h", "Mỗi 8 - 12 giờ", False, "CrCl >= 30 ml/phút: Dùng liều chuẩn bình thường."),
            (10.0, 30.0, "500/125 mg", "Mỗi 12 giờ (Không dùng dạng 875/125 mg)", False, "Suy thận vừa đến nặng: Giảm liều xuống 500/125mg mỗi 12h, chống chỉ định dạng viên 875/125mg."),
            (0.0, 10.0, "500/125 mg", "Mỗi 24 giờ", False, "Suy thận nặng / Thẩm tách: 500/125mg mỗi 24h, bổ sung 1 liều sau lọc máu."),
        ),
        safety_warning="Không sử dụng dạng bào chế viên nén 875/125 mg cho bệnh nhân có CrCl < 30 ml/phút do nguy cơ quá liều thành phần amoxicillin và acid clavulanic.",
        citation_page=168,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Amoxicillin và Acid Clavulanic, Trang 168)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=168"
    ),

    # 7. Perindopril (Coversyl)
    RenalDrugRule(
        drug_identifiers=("perindopril", "coversyl", "coversyl plus", "bi-coversyl"),
        canonical_name="Perindopril (Coversyl)",
        active_ingredient="Perindopril",
        standard_dose="4 mg – 8 mg/ngày (hoặc 5 mg – 10 mg dạng perindopril arginin) uống 1 lần vào buổi sáng.",
        tiers=(
            (60.0, 999.0, "4 mg/ngày (hoặc 5 mg perindopril arginin)", "Mỗi 24 giờ", False, "CrCl >= 60 ml/phút: Liều chuẩn không cần hiệu chỉnh."),
            (30.0, 60.0, "2 mg/ngày (hoặc 2.5 mg perindopril arginin)", "Mỗi 24 giờ", False, "CrCl 30 - 59 ml/phút: Giảm liều còn 2 mg/ngày uống buổi sáng."),
            (15.0, 30.0, "2 mg mỗi 2 ngày (hoặc 2.5 mg muối arginin mỗi 2 ngày)", "Mỗi 48 giờ (uống cách nhật)", False, "CrCl 15 - 29 ml/phút: DĐVN V khuyến cáo giảm liều dùng 2 mg mỗi 2 ngày (uống cách nhật vào buổi sáng), không dùng liều thông thường."),
            (0.0, 15.0, "2 mg vào ngày lọc máu", "Sau buổi thẩm tách", False, "CrCl < 15 ml/phút: Liều 2 mg vào ngày lọc máu."),
        ),
        safety_warning="Perindopril đào thải chủ yếu qua thận. Khi suy thận nặng (CrCl < 30 ml/phút), bắt buộc giảm liều để tránh nguy cơ tụt huyết áp quá mức, suy thận cấp chức năng và tăng kali máu.",
        citation_page=1131,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Perindopril, Trang 1131)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1131"
    ),

    # 8. Spironolacton (Aldactone)
    RenalDrugRule(
        drug_identifiers=("spironolacton", "spironolactone", "aldactone", "verospiron"),
        canonical_name="Spironolacton",
        active_ingredient="Spironolacton",
        standard_dose="25 mg – 100 mg/ngày uống 1 lần hoặc chia 2 lần.",
        tiers=(
            (50.0, 999.0, "25 mg – 100 mg/ngày", "Mỗi 24 giờ", False, "CrCl >= 50 ml/phút: Sử dụng liều thông thường."),
            (30.0, 50.0, "12.5 mg – 25 mg/ngày hoặc 25 mg mỗi 2 ngày", "Mỗi 24 - 48 giờ", False, "CrCl 30 - 49 ml/phút: Giảm 50% liều, theo dõi sát nồng độ Kali máu."),
            (0.0, 30.0, "CHỐNG CHỈ ĐỊNH / NGỪNG THUỐC", "Ngừng thuốc ngay lập tức", True, "Chống chỉ định tuyệt đối khi CrCl < 30 ml/phút do nguy cơ tăng Kali máu ác tính dẫn tới rung thất và ngưng tim."),
        ),
        safety_warning="CẢNH BÁO TĂNG KALI MÁU TỬ VONG: Thuốc lợi tiểu kháng aldosteron giữ Kali dùng trên bệnh nhân suy thận mạn ClCr < 30 có nguy cơ rất cao gây tăng Kali máu cấp đe dọa tính mạng.",
        citation_page=1285,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Spironolacton, Trang 1285)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1285"
    ),

    # 9. Meloxicam (NSAID)
    RenalDrugRule(
        drug_identifiers=("meloxicam", "mobic", "celecoxib", "celebrex", "diclofenac", "voltaren", "ibuprofen"),
        canonical_name="Meloxicam (NSAID)",
        active_ingredient="Meloxicam",
        standard_dose="7.5 mg – 15 mg/ngày uống 1 lần trong hoặc sau bữa ăn.",
        tiers=(
            (60.0, 999.0, "7.5 mg – 15 mg/ngày", "Mỗi 24 giờ", False, "CrCl >= 60 ml/phút: Sử dụng liều thấp nhất có hiệu quả trong thời gian ngắn nhất."),
            (30.0, 60.0, "Tối đa 7.5 mg/ngày", "Mỗi 24 giờ", False, "CrCl 30 - 59 ml/phút: Thận trọng cao, không vượt quá 7.5 mg/ngày."),
            (0.0, 30.0, "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI", "Tuyệt đối không sử dụng", True, "Chống chỉ định ở người bệnh suy thận nặng (ClCr < 30 ml/phút) và suy tim nặng vì làm co thắt tiểu động mạch đến, gây suy sụp mức lọc cầu thận cấp và ứ trệ dịch tuần hoàn."),
        ),
        safety_warning="BÁO ĐỘNG ĐỎ / TỪ CHỐI KÊ ĐƠN: NSAID ức chế prostaglandin tại thận, gây thiếu máu cục bộ tủy thận, suy thận cấp vô niệu và khởi phát đợt cấp suy tim mất bù.",
        citation_page=954,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Meloxicam, Trang 954)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=954"
    ),

    # 10. Colchicin
    RenalDrugRule(
        drug_identifiers=("colchicin", "colchicine", "colchimax"),
        canonical_name="Colchicin",
        active_ingredient="Colchicin",
        standard_dose="1 mg/ngày (hoặc khởi đầu 1 mg sau đó 0.5 mg sau 1 giờ ở đợt gút cấp).",
        tiers=(
            (50.0, 999.0, "1 mg/ngày", "Mỗi 24 giờ", False, "CrCl >= 50 ml/phút: Liều tiêu chuẩn."),
            (30.0, 50.0, "0.5 mg/ngày", "Mỗi 24 giờ", False, "CrCl 30 - 49 ml/phút: Giảm liều còn 0.5 mg/ngày."),
            (10.0, 30.0, "0.5 mg mỗi 2 – 3 ngày", "Mỗi 48 – 72 giờ", False, "CrCl 10 - 29 ml/phút: Giảm liều xuống 0.5 mg/ngày hoặc 0.5 mg cách ngày, không lặp lại đợt điều trị trong 2 tuần."),
            (0.0, 10.0, "CHỐNG CHỈ ĐỊNH", "Không sử dụng", True, "CrCl < 10 ml/phút: Chống chỉ định do nguy cơ tích lũy gây độc thần kinh - cơ và suy tủy xương."),
        ),
        safety_warning="HIỆU CHỈNH LIỀU THẬN TRỌNG: Thuốc đào thải qua thận, suy thận làm tăng nồng độ tự do gấp nhiều lần, nguy cơ độc tính cơ vân và tiêu cơ.",
        citation_page=442,
        citation_title="Dược thư Quốc gia Việt Nam (Chuyên luận Colchicin, Trang 442)",
        pdf_url="/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=442"
    ),
)


def find_all_renal_drug_rules(query_or_drugs: Any) -> List[RenalDrugRule]:
    """Tìm tất cả các quy tắc chỉnh liều suy thận cho danh sách thuốc hoặc chuỗi câu hỏi."""
    found: List[RenalDrugRule] = []
    seen = set()

    tokens = []
    if isinstance(query_or_drugs, (list, tuple, set)):
        tokens.extend([str(x) for x in query_or_drugs])
    else:
        tokens.append(str(query_or_drugs))

    # Match each token against all rules
    for tok in tokens:
        clean_tok = _clean_str(tok)
        for rule in _RENAL_DRUG_RULES:
            if rule.canonical_name in seen:
                continue
            for ident in rule.drug_identifiers:
                clean_ident = _clean_str(ident)
                # Word boundary or substring check
                if re.search(r'\b' + re.escape(clean_ident) + r'\b', clean_tok) or (len(clean_ident) >= 5 and clean_ident in clean_tok):
                    seen.add(rule.canonical_name)
                    found.append(rule)
                    break

    return found


def find_renal_drug_rule(query_or_drug: str) -> Optional[RenalDrugRule]:
    """Tìm quy tắc chỉnh liều suy thận cho hoạt chất hoặc câu hỏi."""
    clean_q = _clean_str(query_or_drug)
    for rule in _RENAL_DRUG_RULES:
        for ident in rule.drug_identifiers:
            clean_ident = _clean_str(ident)
            if clean_ident in clean_q or clean_q in clean_ident:
                return rule
    return None


def match_renal_dosage(
    drug_name: str,
    assessment: RenalFunctionAssessment
) -> Optional[RenalDosingRecommendation]:
    """
    Khớp chỉ số chức năng thận của bệnh nhân với quy tắc hiệu chỉnh liều Dược thư Quốc gia.
    """
    rule = find_renal_drug_rule(drug_name)
    if not rule:
        return None

    crcl = assessment.crcl_ml_min
    selected_tier = None
    for min_c, max_c, rec_dose, interval, is_contra, rationale in rule.tiers:
        if min_c <= crcl < max_c:
            selected_tier = (min_c, max_c, rec_dose, interval, is_contra, rationale)
            break

    if not selected_tier and crcl >= 999.0:
        selected_tier = rule.tiers[0]

    if not selected_tier:
        selected_tier = rule.tiers[-1]

    min_c, max_c, rec_dose, interval, is_contra, rationale = selected_tier
    is_adjusted = (min_c, max_c) != (rule.tiers[0][0], rule.tiers[0][1])

    # Tra cứu số trang chính xác từ CSDL chuyên luận PDF thực tế
    citation_page = rule.citation_page
    try:
        from app.services.rag.source_resolver import load_source_documents
        _, by_inn, _ = load_source_documents()
        for ident in rule.drug_identifiers:
            mono = by_inn.get(ident.lower())
            if mono and mono.get("start_page"):
                citation_page = int(mono["start_page"])
                break
    except Exception:
        pass

    pdf_url = f"/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page={citation_page}"

    return RenalDosingRecommendation(
        drug_name=rule.canonical_name,
        active_ingredient=rule.active_ingredient,
        standard_adult_dose=rule.standard_dose,
        patient_crcl=crcl,
        kdigo_stage=assessment.kdigo_stage,
        is_dose_adjusted=is_adjusted,
        is_contraindicated=is_contra,
        recommended_dose=rec_dose,
        dosing_interval=interval,
        clinical_rationale=rationale,
        safety_warning=rule.safety_warning,
        legal_basis=f"Dược thư Quốc gia Việt Nam (Trang {citation_page})",
        citation_document_id=f"dtqg-renal-{citation_page}",
        citation_page=citation_page,
        pdf_url=pdf_url
    )
