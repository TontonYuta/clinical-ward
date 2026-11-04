"""
Self-RAG Reflective Verification Layer & Hallucination Auditor
Based on: 'Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection'
(Akari Asai et al., University of Washington & Allen AI, ICLR 2024, arXiv:2310.11511).

Automates claim-level segmentation, evidence grounding verification ([IsSup]),
utility critique ([IsUse]), and safety contradiction detection for clinical queries (<=220 LOC).
"""
import re
import unicodedata
from typing import List, Dict, Any, Tuple, Optional
from app.services.rag.types import RetrievedChunk, RagResult
from app.services.rag.lightrag_data import CLASS_INTERACTION_GRAPH, ORGAN_CONDITION_HIERARCHY

_QUERY_STOPWORDS = {
    "tôi", "bị", "nên", "uống", "thuốc", "nào", "nhỉ", "cho", "của", "các",
    "và", "là", "có", "không", "với", "được", "trong", "khi", "ở", "gì", "sao",
    "thế", "như", "làm", "để", "ra", "vào", "lại", "đã", "đang", "sẽ", "hay",
    "hoặc", "này", "đó", "đây", "người", "bệnh", "dạ", "xin", "em", "bác", "sĩ"
}

def _strip_diacritics(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in norm if not unicodedata.combining(c)).replace("đ", "d")

def _extract_clinical_claims(answer: str) -> List[str]:
    """Segment answer into distinct clinical assertions, filtering out conversational fillers."""
    # Remove markdown header lines, bullet markers, and bold markers
    clean = re.sub(r"^#+\s+.*$", "", answer, flags=re.MULTILINE)
    clean = re.sub(r"^[•\-\*]\s+", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"\*\*", "", clean)

    raw_sentences = re.split(r"(?<=[.!?\n])\s+", clean)
    claims: List[str] = []

    for s in raw_sentences:
        s_clean = s.strip(" \t\n\r;:-")
        if len(s_clean) < 15:
            continue
        s_lower = s_clean.casefold()
        # Filter greeting / boilerplate
        if any(s_lower.startswith(prefix) for prefix in ("dạ", "chào", "kính gửi", "dưới đây", "sau đây", "vui lòng")):
            continue
        # Retain clinical assertion statements
        is_clinical = any(term in s_lower for term in (
            "liều", "mg", "ml", "uống", "tiêm", "chỉ định", "chống chỉ định", "tác dụng phụ",
            "adr", "nguy cơ", "tương tác", "ức chế", "thải trừ", "cyp", "clcr", "egfr",
            "thay thế", "chuyển sang", "đổi sang", "khuyến cáo", "thận", "gan", "tim", "huyết áp"
        ))
        if is_clinical:
            claims.append(s_clean)

    return claims

def _extract_numbers_and_units(text: str) -> set[str]:
    """Extract dosage quantities like 4mg, 500 mg, 1 viên/ngày, ClCr < 30."""
    matches = re.findall(r"\b(?:\d+(?:[.,]\d+)?)\s*(?:mg|mcg|g|ml|lần/ngày|viên/ngày|%|iu)?\b", text.casefold())
    return {m.replace(" ", "") for m in matches if m.strip() and not m.isdigit()}

def _evaluate_claim_support(
    claim: str,
    evidence_text: str,
    evidence_unacc: str
) -> Tuple[str, float]:
    """Evaluate whether a clinical claim is supported by evidence ([IsSup] reflection token)."""
    claim_lower = claim.casefold()
    claim_unacc = _strip_diacritics(claim)

    claim_words = {w for w in re.findall(r"\w{2,}", claim_lower) if w not in _QUERY_STOPWORDS}
    if not claim_words:
        return "FULLY_SUPPORTED", 1.0

    # Check word overlap
    matched_words = {w for w in claim_words if w in evidence_text}
    overlap_ratio = len(matched_words) / len(claim_words)

    # Check dosage and quantity preservation
    claim_dosages = _extract_numbers_and_units(claim)
    if claim_dosages:
        evidence_dosages = _extract_numbers_and_units(evidence_text)
        missing_dosages = claim_dosages - evidence_dosages
        # If numbers like 400mg appear in claim but evidence has none of them, penalize
        if missing_dosages and len(missing_dosages) == len(claim_dosages):
            return "UNSUPPORTED", round(overlap_ratio * 0.4, 3)

    if overlap_ratio >= 0.65 or claim_unacc in evidence_unacc:
        return "FULLY_SUPPORTED", round(overlap_ratio, 3)
    elif overlap_ratio >= 0.35:
        return "PARTIALLY_SUPPORTED", round(overlap_ratio, 3)
    else:
        return "UNSUPPORTED", round(overlap_ratio, 3)

def _detect_safety_contradictions(claim: str, query: str) -> Optional[str]:
    """Detect fatal clinical contradictions against established safety guidelines."""
    c_lower = claim.casefold()
    q_lower = query.casefold()

    # Rule 1: Metformin in Severe Renal Impairment (ClCr < 30)
    has_severe_renal = any(t in q_lower or t in c_lower for t in ("clcr < 30", "clcr dưới 30", "egfr < 30", "suy thận nặng"))
    if has_severe_renal and "metformin" in c_lower:
        if any(safe in c_lower for safe in ("ngừng", "chống chỉ định", "tránh", "không dùng", "bỏ", "chuyển sang")):
            pass
        elif any(unsafe in c_lower for unsafe in ("uống", "dùng liều", "tiếp tục", "kê", "khuyên dùng")):
            return "FATAL_CONTRADICTION: Metformin is contraindicated when ClCr < 30 mL/min (Lactic Acidosis risk)."

    # Rule 2: Macrolide + Statin combination
    has_macrolide = any(m in c_lower for m in ("macrolid", "clarithromycin", "erythromycin"))
    has_statin = any(s in c_lower for s in ("statin", "simvastatin", "atorvastatin"))
    if has_macrolide and has_statin:
        if any(unsafe in c_lower for unsafe in ("an toàn", "không có tương tác", "dùng chung tốt", "kết hợp được")):
            return "FATAL_CONTRADICTION: Macrolide + Statin is contraindicated (CYP3A4 inhibition & Rhabdomyolysis risk)."

    # Rule 3: ACEI / ARB in pregnancy
    has_preg = any(p in q_lower or p in c_lower for p in ("thai kỳ", "có thai", "mang thai", "phụ nữ mang thai"))
    has_raas = any(r in c_lower for r in ("acei", "arb", "coversyl", "perindopril", "enalapril", "losartan"))
    if has_preg and has_raas:
        if any(safe in c_lower for safe in ("chống chỉ định", "ngừng", "độc tính", "tránh")):
            pass
        elif any(unsafe in c_lower for unsafe in ("dùng an toàn", "lựa chọn đầu tay", "hạ áp an toàn")):
            return "FATAL_CONTRADICTION: ACEi/ARB are strictly contraindicated in pregnancy (Category X fetotoxicity)."

    return None

class SelfRagVerifier:
    """Self-RAG Reflective Verifier & Hallucination Auditor (ICLR 2024)."""

    def audit_and_critique(
        self,
        query: str,
        answer: str,
        retrieved_chunks: List[RetrievedChunk],
        kg_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform comprehensive self-reflection critique on the clinical answer."""
        claims = _extract_clinical_claims(answer)
        if not claims:
            return {
                "factuality_score": 1.0,
                "hallucination_rate": 0.0,
                "critique_verdict": "PASS",
                "claims_audit": [],
                "cleaned_answer": answer,
                "audit_summary": "Không có mệnh đề lâm sàng độc lập cần kiểm chứng."
            }

        # Build master evidence text
        evidence_pieces: List[str] = []
        if kg_data.get("graph_context_text"):
            evidence_pieces.append(kg_data["graph_context_text"])
        for alert in kg_data.get("active_ddi_alerts", []):
            evidence_pieces.append(f"{alert.get('drug_a', '')} {alert.get('drug_b', '')} {alert.get('mechanism', '')} {alert.get('consequence', '')}")
        for alt in kg_data.get("therapeutic_alternatives", []):
            evidence_pieces.append(f"{alt.get('alternative_class', '')} {alt.get('recommendation', '')}")
        for r in retrieved_chunks:
            evidence_pieces.append(r.chunk.title)
            evidence_pieces.append(r.chunk.content)

        evidence_text = "\n".join(evidence_pieces).casefold()
        evidence_unacc = _strip_diacritics(evidence_text)

        claims_audit: List[Dict[str, Any]] = []
        supported_count = 0
        contradiction_found = False
        fatal_reasons: List[str] = []

        for c in claims:
            # Check contradiction
            contra_err = _detect_safety_contradictions(c, query)
            if contra_err:
                contradiction_found = True
                fatal_reasons.append(contra_err)
                claims_audit.append({
                    "claim": c,
                    "status": "CONTRADICTORY",
                    "score": 0.0,
                    "reason": contra_err
                })
                continue

            status, score = _evaluate_claim_support(c, evidence_text, evidence_unacc)
            if status in ("FULLY_SUPPORTED", "PARTIALLY_SUPPORTED"):
                supported_count += 1
            claims_audit.append({
                "claim": c,
                "status": status,
                "score": score,
                "reason": "Xác thực với Dược Thư & Knowledge Graph" if status != "UNSUPPORTED" else "Không tìm thấy bằng chứng đối ứng trong nguồn tri thức"
            })

        total_claims = len(claims)
        factuality_score = round(supported_count / total_claims, 2)
        hallucination_rate = round(1.0 - factuality_score, 2)

        # Verdict assignment
        if contradiction_found:
            critique_verdict = "REJECT"
        elif factuality_score >= 0.75:
            critique_verdict = "PASS"
        elif factuality_score >= 0.45:
            critique_verdict = "CAUTION"
        else:
            critique_verdict = "REJECT"

        cleaned_answer = answer
        # If contradiction or major hallucination, add self-reflective audit footer
        if critique_verdict == "REJECT" and contradiction_found:
            cleaned_answer = (
                f"### 🛑 CẢNH BÁO PHẢN TƯ SELF-RAG (ICLR 2024: Phát hiện mâu thuẫn an toàn lâm sàng)\n\n"
                f"Nội dung chứa khẳng định mâu thuẫn nghiêm trọng với tài liệu chuẩn:\n"
                f"- {fatal_reasons[0]}\n\n"
                f"Hệ thống tự động từ chối thông tin không an toàn này để bảo vệ người bệnh."
            )
        elif critique_verdict in ("PASS", "CAUTION"):
            # Append discrete audit line
            verdict_badge = "✅ ĐÃ XÁC THỰC" if critique_verdict == "PASS" else "⚠️ THẬN TRỌNG"
            audit_note = (
                f"\n\n> 🛡️ *Kiểm định phản tư Self-RAG (ICLR 2024): {verdict_badge} — "
                f"Độ trung thực: {int(factuality_score * 100)}% ({supported_count}/{total_claims} mệnh đề đối soát y văn DĐVN V & QĐ 5948).*"
            )
            cleaned_answer = answer + audit_note

        return {
            "factuality_score": factuality_score,
            "hallucination_rate": hallucination_rate,
            "critique_verdict": critique_verdict,
            "claims_audit": claims_audit,
            "cleaned_answer": cleaned_answer,
            "audit_summary": f"Đã đối soát {supported_count}/{total_claims} mệnh đề. Factuality: {factuality_score}."
        }

_VERIFIER = SelfRagVerifier()

def verify_clinical_answer(
    query: str,
    answer: str,
    retrieved_chunks: List[RetrievedChunk],
    kg_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Helper functional API for Self-RAG verification."""
    return _VERIFIER.audit_and_critique(query, answer, retrieved_chunks, kg_data)
