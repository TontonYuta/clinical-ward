"""
Deterministic Database Entity Resolver & Honest Clinical Gatekeeper (Step 2).
Ensures 100% scoped entity lookups against existing CSDL (DĐVN V and DAV),
prevents cross-entity leakage, and enforces honest, jargon-free medical abstention.
"""
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import re
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.copilot import CopilotResponse
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher, strip_accents


@dataclass
class ResolvedDrugRecord:
    drug: DavNationalDrug
    monograph: Optional[ClinicalDrugMonograph]
    is_exact_match: bool


async def resolve_drug_entity_deterministic(
    raw_name_or_code: str,
    db: AsyncSession
) -> Tuple[Optional[ResolvedDrugRecord], List[Dict[str, Any]]]:
    """
    Tra cứu thực thể thuốc có phạm vi chặt chẽ (scoped) trong CSDL hiện tại.
    Ưu tiên tuyệt đối:
    1. Trùng khớp chính xác INN hoặc Brand Name trong ClinicalDrugMonograph / DavNationalDrug.
    2. Trùng khớp composite 'INN (Brand)' hoặc 'Brand (INN)'.
    3. Trả về candidates nếu nghi ngờ sai chính tả (Typo).
    4. Trả về (None, []) nếu hoàn toàn không có trong CSDL -> Kích hoạt Honest Gatekeeper.
    """
    clean_kw = re.sub(r"[\s\xa0]+", " ", (raw_name_or_code or "").strip())
    if not clean_kw or len(clean_kw) < 2:
        return None, []

    matcher = get_drug_lexical_matcher()
    search_terms = [clean_kw]

    # Phân rã dạng tên kết hợp: "Riluzol (Teglutik)" -> ["Riluzol (Teglutik)", "Riluzol", "Teglutik"]
    comp_match = re.match(r"^([^(]+)\s*\(([^)]+)\)$", clean_kw)
    if comp_match:
        p1, p2 = comp_match.group(1).strip(), comp_match.group(2).strip()
        if p1 and p1 not in search_terms:
            search_terms.append(p1)
        if p2 and p2 not in search_terms:
            search_terms.append(p2)

    # 1. Tra cứu Chuyên khảo Dược thư Quốc gia (ClinicalDrugMonograph)
    mono_conds = []
    mono_orders = []
    for term in search_terms:
        t_low = term.lower()
        mono_conds.extend([
            func.lower(ClinicalDrugMonograph.inn) == t_low,
            func.lower(ClinicalDrugMonograph.title) == t_low,
            func.lower(ClinicalDrugMonograph.inn).like(f"{t_low} %"),
            func.lower(ClinicalDrugMonograph.title).like(f"{t_low} %")
        ])
        mono_orders.extend([
            (func.lower(ClinicalDrugMonograph.title) == t_low).desc(),
            (func.lower(ClinicalDrugMonograph.inn) == t_low).desc(),
            (func.lower(ClinicalDrugMonograph.title).like(f"{t_low} %")).desc(),
            (func.lower(ClinicalDrugMonograph.inn).like(f"{t_low} %")).desc(),
        ])
    mono_res = await db.execute(select(ClinicalDrugMonograph).where(or_(*mono_conds)).order_by(*mono_orders).limit(1))
    monograph = mono_res.scalar_one_or_none()

    # 2. Tra cứu Danh mục Cục QLD (DavNationalDrug)
    dav_conds = []
    dav_orders = []
    for term in search_terms:
        t_low = term.lower()
        dav_conds.extend([
            func.lower(DavNationalDrug.national_code) == t_low,
            func.lower(DavNationalDrug.brand_name) == t_low,
            func.lower(DavNationalDrug.active_ingredient) == t_low,
            func.lower(DavNationalDrug.brand_name).like(f"{t_low} %"),
            func.lower(DavNationalDrug.brand_name).like(f"% {t_low}%")
        ])
        dav_orders.extend([
            (func.lower(DavNationalDrug.brand_name) == t_low).desc(),
            (func.lower(DavNationalDrug.active_ingredient) == t_low).desc(),
            (func.lower(DavNationalDrug.national_code) == t_low).desc(),
            (func.lower(DavNationalDrug.brand_name).like(f"{t_low} %")).desc(),
            (func.lower(DavNationalDrug.active_ingredient).like(f"{t_low} %")).desc(),
        ])
    dav_res = await db.execute(select(DavNationalDrug).where(or_(*dav_conds)).order_by(*dav_orders).limit(1))
    dav_drug = dav_res.scalar_one_or_none()

    if dav_drug:
        if not monograph and dav_drug.clinical_monograph_id:
            m_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == dav_drug.clinical_monograph_id))
            monograph = m_res.scalar_one_or_none()
        if not monograph and dav_drug.active_ingredient:
            first_ing = re.split(r"[\+;,]", dav_drug.active_ingredient)[0].strip()
            first_ing_clean = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị).*$", "", first_ing, flags=re.IGNORECASE).strip()
            first_ing_clean = re.sub(r"\(.*?\)", "", first_ing_clean).strip()
            first_ing_clean = re.sub(r"\b(?:dưới dạng|tương đương|as|equivalent)\b.*$", "", first_ing_clean, flags=re.IGNORECASE).strip()
            if len(first_ing_clean) >= 3:
                m_res = await db.execute(
                    select(ClinicalDrugMonograph).where(
                        or_(
                            func.lower(ClinicalDrugMonograph.inn) == first_ing_clean.lower(),
                            func.lower(ClinicalDrugMonograph.title) == first_ing_clean.lower(),
                            func.lower(ClinicalDrugMonograph.inn).like(f"{first_ing_clean.lower()}%")
                        )
                    ).limit(1)
                )
                monograph = m_res.scalar_one_or_none()
        return ResolvedDrugRecord(drug=dav_drug, monograph=monograph, is_exact_match=True), []

    if monograph:
        synthetic_drug = DavNationalDrug(
            id=f"MONO-{monograph.id}",
            national_code=monograph.atc_code or "DĐVN V",
            brand_name=monograph.title or monograph.inn.title(),
            active_ingredient=monograph.inn,
            atc_code=monograph.atc_code,
            drug_class=monograph.drug_class,
            indications=monograph.indications,
            contraindications=monograph.contraindications,
            adverse_effects=monograph.adverse_effects,
            drug_interactions=monograph.drug_interactions,
            adult_dosage=monograph.adult_dosage,
            clinical_source="Dược Thư Quốc Gia Việt Nam",
            clinical_monograph_id=monograph.id
        )
        return ResolvedDrugRecord(drug=synthetic_drug, monograph=monograph, is_exact_match=True), []

    # 3. Tìm kiếm ứng viên tương đồng âm vị / chính tả (Typo Candidates)
    candidates: List[Dict[str, Any]] = []
    for term in search_terms:
        fuzzy_names = matcher.fuzzy_candidate_search(term, top_k=3)
        for fname in fuzzy_names:
            c_res = await db.execute(
                select(DavNationalDrug).where(func.lower(DavNationalDrug.brand_name) == fname.lower()).limit(1)
            )
            c_drug = c_res.scalar_one_or_none()
            if c_drug:
                candidates.append({
                    "brand_name": c_drug.brand_name,
                    "active_ingredient": c_drug.active_ingredient,
                    "national_code": c_drug.national_code,
                    "concentration": c_drug.dosage_form or "Chuẩn lưu hành",
                    "source": "Danh mục thuốc lưu hành (DAV)"
                })
        if candidates:
            break

    return None, candidates


def build_honest_abstention_reply(
    raw_kw: str,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """
    Tạo phản hồi từ chối trung thực, lịch sự, chuẩn mực ngôn ngữ y khoa.
    TUYỆT ĐỐI KHÔNG chứa từ ngữ kỹ thuật: RAG, CRAG, CSDL, Database, Safe Abstention, MedAbstain.
    """
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"
    clean_target = raw_kw.strip().title() if len(raw_kw) < 30 else raw_kw.strip()

    reply = (
        f"Dạ thưa {role_label}, hiện tại tôi chưa có dữ liệu chính thức về **\"{clean_target}\"** "
        f"trong Dược thư Quốc gia Việt Nam và các Hướng dẫn điều trị của Bộ Y tế hiện hành.\n\n"
        f"Để đảm bảo an toàn tuyệt đối cho người bệnh, tôi xin phép không suy đoán thông tin khi chưa có nguồn chứng cứ y khoa xác thực.\n\n"
        f"**Khuyến nghị chuyên môn:**\n"
        f"1. {role_label} vui lòng kiểm tra lại nhãn bao bì gốc, số đăng ký hoặc tên hoạt chất trên đơn thuốc.\n"
        f"2. Tham khảo trực tiếp ý kiến của Dược sĩ lâm sàng hoặc tờ hướng dẫn sử dụng chính thức từ nhà sản xuất ạ."
    )

    return CopilotResponse(
        intent="CLINICAL_SAFE_ABSTENTION",
        reply_text=reply,
        card=None,
        legal_basis="Dược Thư Quốc Gia Việt Nam & Hướng dẫn điều trị của Bộ Y tế",
        suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Kiểm tra danh mục thuốc nội viện", "Nhập lại tên hoạt chất"],
        session_id=session_id or "",
        answer_type="safe_abstention",
        source_status="insufficient_evidence",
        confidence=0.0
    )


def build_natural_clarification_reply(
    raw_kw: str,
    candidates: List[Dict[str, Any]],
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """
    Tạo phản hồi gợi ý đối soát chính tả tự nhiên, ấm áp, đúng tác phong Dược sĩ lâm sàng.
    TUYỆT ĐỐI KHÔNG chứa thuật ngữ: CRAG, Framework, ICLR 2024, CSDL 54,885.
    """
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"

    cand_lines = []
    chips = []
    for idx, c in enumerate(candidates, 1):
        cand_lines.append(
            f"**{idx}. {c['brand_name']}**\n"
            f"  • *Hoạt chất:* **{c['active_ingredient']}** ({c['concentration']})\n"
            f"  • *Số đăng ký:* `{c['national_code']}` | *Nguồn:* {c['source']}"
        )
        chips.append(f"Tra cứu thuốc {c['brand_name']}")

    if candidates:
        chips.append(f"Kiểm tra tương tác {candidates[0]['brand_name']}")
    if len(chips) < 4:
        chips.append("Tra cứu Dược Thư Quốc Gia")

    reply = (
        f"Dạ thưa {role_label}, hiện chưa tìm thấy tên chính xác **\"{raw_kw}\"** trong Dược thư Quốc gia và Danh mục thuốc lưu hành.\n\n"
        f"Dựa trên đối soát âm vị và hoạt chất lâm sàng, có thể {role_label} đang muốn tìm một trong các thuốc sau không ạ:\n\n"
        + "\n\n".join(cand_lines) +
        f"\n\n---\n👉 *{role_label} có thể chọn các gợi ý bên dưới để xem ngay chỉ định và liều dùng khuyến cáo ạ.*"
    )

    return CopilotResponse(
        intent="CLINICAL_TYPO_SUGGESTION",
        reply_text=reply,
        card=None,
        legal_basis="Dược Thư Quốc Gia Việt Nam & Danh mục thuốc lưu hành",
        suggested_chips=chips,
        session_id=session_id or "",
        answer_type="corrective_clarification",
        source_status="fuzzy_candidates",
        confidence=0.8
    )
