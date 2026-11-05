"""
Corrective Retrieval-Augmented Generation (CRAG) & Tripartite Decision Module (<= 195 LOC).
Căn cứ:
1. CRAG Paper (ICLR 2024, arXiv:2401.15884, GitHub: HuskyInSalt/CRAG).
2. MedAbstain (Machcha et al., EACL / arXiv:2601.12471): Tripartite Decision (Decide, Ask, Defer).
"""
import difflib
from typing import List, Dict, Any, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher, strip_accents

def is_exact_drug_match(kw: str, drug: DavNationalDrug) -> bool:
    kw_c = kw.strip().lower()
    b_c = (drug.brand_name or "").strip().lower()
    i_c = (drug.active_ingredient or "").strip().lower()
    s_c = (drug.national_code or "").strip().lower()

    if kw_c == b_c or kw_c == i_c or kw_c == s_c:
        return True

    # Composite name check: "INN (Brand)" e.g. "Riluzol (Teglutik)", "Venetoclax (Venclexta)"
    import re
    comp_m = re.match(r"^([^(]+)\s*\(([^)]+)\)$", kw.strip())
    if comp_m:
        p1 = comp_m.group(1).strip().lower()
        p2 = comp_m.group(2).strip().lower()
        if p1 in (b_c, i_c) or p2 in (b_c, i_c) or b_c in (p1, p2) or i_c in (p1, p2):
            return True
        if any(p in b_c.split() or p in i_c.replace(";", " ").replace("+", " ").split() for p in (p1, p2) if len(p) >= 3):
            return True

    tokens_b = [t.strip(",.()[]/+-;") for t in b_c.split() if t.strip(",.()[]/+-;")]
    tokens_i = [t.strip(",.()[]/+-;") for t in i_c.split() if t.strip(",.()[]/+-;")]
    if kw_c in tokens_b or kw_c in tokens_i:
        return True

    # Đối soát tương đồng hậu tố Latinh/Pháp (Codein vs Codeine, Morphin vs Morphine)
    tokens_k = [t.strip(",.()[]/+-;") for t in kw_c.split() if t.strip(",.()[]/+-;")]
    if len(tokens_k) >= 2:
        tk_stripped = [t.rstrip("e") for t in tokens_k]
        tb_stripped = [t.rstrip("e") for t in tokens_b]
        if tk_stripped == tb_stripped or (len(tb_stripped) >= len(tk_stripped) and tb_stripped[:len(tk_stripped)] == tk_stripped):
            return True

    return False

async def find_crag_candidates(
    raw_kw: str,
    db: AsyncSession,
    top_k: int = 4
) -> List[Dict[str, Any]]:
    matcher = get_drug_lexical_matcher()
    kw_norm = strip_accents(raw_kw.strip().lower())
    if len(kw_norm) < 3:
        return []

    candidates: List[Dict[str, Any]] = []
    seen_names = set()

    # 1. SQL Prefix Match trên 54,885 thuốc DAV
    sql_stmt = select(
        DavNationalDrug.brand_name,
        DavNationalDrug.active_ingredient,
        DavNationalDrug.concentration,
        DavNationalDrug.national_code
    ).where(or_(
        func.lower(DavNationalDrug.brand_name).like(f"{kw_norm}%"),
        func.lower(DavNationalDrug.active_ingredient).like(f"{kw_norm}%")
    )).limit(10)
    sql_rows = (await db.execute(sql_stmt)).all()
    for b_name, act_ing, conc, sdk in sql_rows:
        clean_b = (b_name or "").strip()
        if clean_b and clean_b.lower() not in seen_names:
            seen_names.add(clean_b.lower())
            r1 = difflib.SequenceMatcher(None, kw_norm, strip_accents(clean_b.lower())).ratio()
            r2 = difflib.SequenceMatcher(None, kw_norm, strip_accents((act_ing or "").lower())).ratio()
            score = max(r1, r2, 0.72)
            candidates.append({
                "brand_name": clean_b,
                "active_ingredient": act_ing or clean_b,
                "concentration": conc or "Theo nhãn",
                "national_code": sdk or "DĐVN V",
                "score": score,
                "source": "CSDL Dược Quốc gia (DAV)"
            })

    # 2. Trie indexed fuzzy candidate pool (tra cứu trong 3ms)
    if len(candidates) < top_k and kw_norm:
        pool = matcher._candidates_by_first.get(kw_norm[0], [])
        fuzzy_names = difflib.get_close_matches(kw_norm, pool, n=6, cutoff=0.68)
        for fname in fuzzy_names:
            if fname not in seen_names:
                seen_names.add(fname)
                q_res = await db.execute(
                    select(DavNationalDrug).where(func.lower(DavNationalDrug.brand_name) == fname).limit(1)
                )
                d = q_res.scalar_one_or_none()
                if d:
                    candidates.append({
                        "brand_name": d.brand_name,
                        "active_ingredient": d.active_ingredient or d.brand_name,
                        "concentration": d.concentration or "Theo nhãn",
                        "national_code": d.national_code,
                        "score": difflib.SequenceMatcher(None, kw_norm, fname).ratio(),
                        "source": "CSDL Dược Quốc gia (DAV)"
                    })

    # 3. Tra cứu bổ trợ trong ClinicalDrugMonograph 771 chuyên luận
    if len(candidates) < top_k and kw_norm:
        mono_res = await db.execute(
            select(ClinicalDrugMonograph).where(or_(
                func.lower(ClinicalDrugMonograph.title).like(f"{kw_norm}%"),
                func.lower(ClinicalDrugMonograph.inn).like(f"{kw_norm}%")
            )).limit(3)
        )
        for m in mono_res.scalars().all():
            m_title = m.title or m.inn.title()
            if m_title.lower() not in seen_names:
                seen_names.add(m_title.lower())
                candidates.append({
                    "brand_name": m_title,
                    "active_ingredient": m.inn,
                    "concentration": "Dược thư Quốc gia",
                    "national_code": m.atc_code or "DĐVN V",
                    "score": 0.75,
                    "source": "Dược thư Quốc gia Việt Nam"
                })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:top_k]

def build_crag_clarification_response(
    raw_kw: str,
    candidates: List[Dict[str, Any]],
    session_id: str,
    user_name: str,
    user_role: str
) -> CopilotResponse:
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"

    top = candidates[0]
    cand_lines = []
    chips = []
    for idx, c in enumerate(candidates, 1):
        cand_lines.append(
            f"**{idx}. {c['brand_name']}**\n"
            f"  • *Hoạt chất:* **{c['active_ingredient']}** ({c['concentration']})\n"
            f"  • *Số đăng ký:* `{c['national_code']}` | *Nguồn:* {c['source']}"
        )
        chips.append(f"Tra cứu thuốc {c['brand_name']}")

    chips.append(f"Kiểm tra tương tác {top['brand_name']}")
    if len(chips) < 4:
        chips.append("Tra cứu Dược Thư Quốc Gia")

    reply = (
        f"### 🔍 GỢI Ý ĐỐI SOÁT CHÍNH TẢ & THỰC THỂ DƯỢC PHẨM (CRAG Framework)\n\n"
        f"Dạ {role_label}, hệ thống không ghi nhận tên chính xác **\"{raw_kw}\"** trong CSDL 54,885 thuốc Cục Quản lý Dược (DAV).\n\n"
        f"Căn cứ thuật toán **Corrective RAG (ICLR 2024)** và đối soát ngữ âm dược lý, có phải {role_label} đang muốn tra cứu một trong các thuốc sau:\n\n"
        + "\n\n".join(cand_lines) +
        f"\n\n---\n👉 *{role_label} có thể nhấn trực tiếp vào các gợi ý bên dưới để xem hồ sơ an toàn và chỉ định ngay lập tức ạ.*"
    )

    # Tạm thời comment thẻ thông tin Action Card và gợi ý chips theo yêu cầu người dùng
    # card = CopilotActionCard(
    #     card_type="medication_safety",
    #     title=f"Gợi ý đối soát: {top['brand_name']}",
    #     summary=f"SĐK: {top['national_code']} • Hoạt chất: {top['active_ingredient']}",
    #     data={"national_code": top['national_code'], "brand_name": top['brand_name'], "active_ingredient": top['active_ingredient']},
    #     primary_action_label=f"Xem {top['brand_name']}",
    #     primary_action_type="OPEN_MEDICATION_SAFETY"
    # )

    return CopilotResponse(
        intent="CLINICAL_TYPO_SUGGESTION",
        reply_text=reply,
        card=None,
        legal_basis="Corrective RAG (ICLR 2024), MedAbstain (arXiv:2601.12471) & CSDL Cục Quản lý Dược",
        suggested_chips=chips,
        session_id=session_id,
        answer_type="corrective_clarification",
        source_status="crag_fuzzy_candidates",
        confidence=round(top["score"], 2)
    )

def build_crag_safe_deferral_response(
    raw_kw: str,
    session_id: str,
    user_name: str,
    user_role: str
) -> CopilotResponse:
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"
    clean_target = raw_kw.strip().title() if len(raw_kw) < 25 else raw_kw.strip()

    reply = (
        f"### 🛡️ TỪ CHỐI ĐƯA CHỈ ĐỊNH (Safe Abstention & Deferral - MedAbstain)\n\n"
        f"• **Kết quả rà soát:** Không tìm thấy thực thể dược phẩm `{clean_target}` trong Danh mục 54,885 thuốc Cục Quản lý Dược và 771 Chuyên luận Dược thư Quốc gia.\n"
        f"• **Rào chắn an toàn (Tripartite Safe Abstention - TT 22/2011/TT-BYT & MedAbstain arXiv:2601.12471):** Trợ lý lâm sàng **tuyệt đối không suy diễn hoặc cung cấp hướng dẫn điều trị** cho các tên chất chưa được định danh trong CSDL chính thống.\n\n"
        f"• **Khuyến nghị xử trí y khoa:**\n"
        f"  1. Kiểm tra lại nhãn bao bì gốc, đơn thuốc CPOE hoặc hồ sơ bệnh án của người bệnh.\n"
        f"  2. Đối chiếu trực tiếp với Khoa Dược lâm sàng hoặc Cổng dịch vụ công Cục Quản lý Dược (DAV)."
    )

    return CopilotResponse(
        intent="CLINICAL_SAFE_ABSTENTION",
        reply_text=reply,
        card=None,
        legal_basis="MedAbstain (arXiv:2601.12471), TT 22/2011/TT-BYT & QĐ 5948/QĐ-BYT",
        suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Kiểm tra danh mục thuốc nội viện", "Hướng dẫn sử dụng hệ thống"],
        session_id=session_id,
        answer_type="safe_abstention",
        source_status="insufficient_evidence",
        confidence=0.0
    )

async def evaluate_crag_tripartite(
    query: str,
    raw_kw: str,
    direct_drugs: List[DavNationalDrug],
    db: AsyncSession,
    *,
    session_id: str,
    user_name: str,
    user_role: str
) -> Optional[CopilotResponse]:
    # 1. BRANCH 1: DECIDE (Đã khớp chính xác hoặc có direct drugs) -> Trả về None để luồng chính tiếp tục
    if direct_drugs and len(direct_drugs) > 0:
        if is_exact_drug_match(raw_kw, direct_drugs[0]):
            return None

    # 2. Rà soát ứng viên theo CRAG
    candidates = await find_crag_candidates(raw_kw, db, top_k=4)
    if candidates:
        top_score = candidates[0]["score"]
        # 2a. BRANCH 2: ASK (Độ tin cậy 0.68 <= score < 1.0 -> Gợi ý đối soát và hỏi lại làm rõ)
        if top_score >= 0.68:
            return build_crag_clarification_response(
                raw_kw, candidates, session_id=session_id, user_name=user_name, user_role=user_role
            )

    # 3. BRANCH 3: DEFER (Từ chối an toàn khi ngoài phân phối OOD)
    return build_crag_safe_deferral_response(
        raw_kw, session_id=session_id, user_name=user_name, user_role=user_role
    )
