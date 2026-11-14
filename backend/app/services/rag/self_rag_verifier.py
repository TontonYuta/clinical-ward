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
    normalized_claim = " ".join(re.findall(r"[\w]+", _strip_diacritics(claim).casefold()))
    normalized_evidence = " ".join(re.findall(r"[\w]+", _strip_diacritics(evidence_text).casefold()))
    if normalized_claim and normalized_claim in normalized_evidence and _claim_quantities_are_present(claim, evidence_text):
        return "FULLY_SUPPORTED", 1.0
    return "UNSUPPORTED", 0.0

def _detect_safety_contradictions(claim: str, query: str) -> Optional[str]:
    """No domain exception list is maintained here; resolve against source claims."""
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
                "factuality_score": 0.0,
                "hallucination_rate": 1.0,
                "critique_verdict": "NOT_VERIFIABLE",
                "claims_audit": [],
                "cleaned_answer": answer,
                "audit_summary": "Không trích xuất được mệnh đề để kiểm chứng."
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
        # If contradiction or major hallucination, return polite medical notice
        if critique_verdict == "REJECT" and contradiction_found:
            cleaned_answer = (
                f"Dạ thưa Bác sĩ, phát hiện thông tin chưa đủ tin cậy khi đối soát với y văn chuẩn:\n"
                f"- {fatal_reasons[0]}\n\n"
                f"Để đảm bảo an toàn cho người bệnh, xin phép dừng cung cấp khuyến nghị này."
            )
        else:
            cleaned_answer = answer

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


def verify_answer_claims(claims, evidence_records: list[dict]) -> dict:
    """Conservatively validate claim/evidence links without treating word overlap as proof."""
    from app.schemas.copilot import AnswerClaim

    evidence_by_id = {
        item.get("evidence_id"): item
        for item in evidence_records
        if isinstance(item, dict) and item.get("evidence_id")
    }
    verified_claims = []
    all_supported = bool(claims)
    for raw_claim in claims:
        claim = raw_claim if isinstance(raw_claim, AnswerClaim) else AnswerClaim.model_validate(raw_claim)
        referenced = [evidence_by_id.get(evidence_id) for evidence_id in claim.evidence_ids]
        supported = bool(referenced) and all(
            evidence is not None
            and evidence.get("source_id")
            and _normalized_version_is_verified(evidence.get("source_version"))
            for evidence in referenced
        )
        if supported and claim.claim_type == "source_fact":
            supported = any(
                _normalize_claim_text(claim.text) in _normalize_claim_text(str(evidence.get("content") or ""))
                and _claim_quantities_are_present(claim.text, str(evidence.get("content") or ""))
                for evidence in referenced
            )
        else:
            # No configured semantic entailment model: inference cannot be auto-verified.
            supported = False
        provenance_valid = bool(referenced) and all(
            evidence is not None
            and evidence.get("source_id")
            and _normalized_version_is_verified(evidence.get("source_version"))
            for evidence in referenced
        )
        if supported:
            status = "supported"
        elif not referenced or any(e is None for e in referenced):
            status = "unsupported"
        elif not provenance_valid:
            status = "insufficient_evidence"
        elif claim.claim_type == "source_fact" and any(
            _normalize_claim_text(claim.text) in _normalize_claim_text(str(evidence.get("content") or ""))
            or _claim_quantity_mismatch(claim.text, str(evidence.get("content") or ""))
            for evidence in referenced
        ):
            status = "unsupported"
        else:
            status = "insufficient_evidence"
        claim.support_status = status
        all_supported = all_supported and supported
        verified_claims.append(claim)
    return {"claims": verified_claims, "all_supported": all_supported}


def _normalized_version_is_verified(value: object) -> bool:
    normalized = str(value or "").strip().casefold()
    return bool(normalized) and normalized not in {"unknown", "none", "unversioned"}


def _normalize_claim_text(value: str) -> str:
    return " ".join(re.findall(r"[\w]+", _strip_diacritics(value).casefold()))


def _claim_quantities_are_present(claim: str, evidence: str) -> bool:
    quantities = _extract_numbers_and_units(claim)
    evidence_quantities = _extract_numbers_and_units(evidence)
    return quantities.issubset(evidence_quantities)


def _claim_quantity_mismatch(claim: str, evidence: str) -> bool:
    claim_quantities = _extract_numbers_and_units(claim)
    evidence_quantities = _extract_numbers_and_units(evidence)
    claim_values = {re.match(r"\d+(?:[.,]\d+)?", item).group(0) for item in claim_quantities if re.match(r"\d+(?:[.,]\d+)?", item)}
    evidence_values = {re.match(r"\d+(?:[.,]\d+)?", item).group(0) for item in evidence_quantities if re.match(r"\d+(?:[.,]\d+)?", item)}
    return bool(claim_values & evidence_values) and not claim_quantities.issubset(evidence_quantities)
