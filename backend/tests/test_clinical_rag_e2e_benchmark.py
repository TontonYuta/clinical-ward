"""
End-to-End System Benchmark for SOTA Dense-Sparse Hybrid RAG & Clinical Vector Cache.
Paper: MedRAG (arXiv:2402.13178), Self-MedRAG (Jan 2026), GPTCache (arXiv:2303.17580).
Evaluates 10 Core Clinical Scenarios:
1. Pregnancy Medication Safety (Paracetamol 1st Trimester) - Zero Keyword Traps
2. Personalized Renal Dose Adjustment (Cockcroft-Gault eGFR/CrCl)
3. Severe Drug-Drug Interaction (Clopidogrel + Omeprazole CYP2C19 - QĐ 5948)
4. Fatal Incompatibility (Ceftriaxone + Calcium Incompatibilities)
5. DAV Drug Regulatory Identification (Registration Number & Monographs)
6. Paraphrased Vector Semantic Cache Hit (< 2ms)
7. Quantitative Medical Safety Guardrail Rejection (500mg vs 250mg)
8. Equipment Ticket Dispatching with Explicit Command (Puritan Bennett 840)
9. Emergency Narcotic Borrowing & Mandatory Ampoule Return (Morphine TT 20/2017)
10. Cold Chain Vaccine Temperature Monitoring (4.5°C GSP Standard)
"""
import sys
import os
import time
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.services.session_context import get_or_create_session
from app.services.cache.clinical_cache import ClinicalLRUCache
from app.schemas.copilot import CopilotResponse

class DummyRequest:
    headers = {}
    client = type('obj', (object,), {'host': '127.0.0.1'})
    state = type('obj', (object,), {'authenticated_user': None})


@pytest.mark.asyncio
async def test_case_01_pregnancy_paracetamol_safety_no_borrow_trap():
    """Ca 1: Tra cứu an toàn thai kỳ Paracetamol - TUYỆT ĐỐI không bị bẫy mượn thuốc."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_01", "Bác sĩ Sản", "doctor")
        q = "Phụ nữ mang thai 3 tháng đầu bị sốt có dùng được Paracetamol không?"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.card is None, "CÂM sinh Action Card mượn nợ cho câu hỏi an toàn thai kỳ!"
        assert resp.intent != "BORROW_EMERGENCY_ITEM", "Ý định không được là xuất mượn tủ trực!"
        assert "thai" in resp.reply_text.lower(), "Câu trả lời phải đề cập đến thời kỳ mang thai / thai nghén"
        assert not any("thu hồi vỏ" in chip.lower() for chip in resp.suggested_chips), "Không được gợi ý thu hồi vỏ morphin"


@pytest.mark.asyncio
async def test_case_02_renal_dose_adjustment_cockcroft_gault():
    """Ca 2: Hiệu chỉnh liều theo chức năng thận Cockcroft-Gault."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_02", "Bác sĩ Thận", "doctor")
        q = "Bệnh nhân nam 65 tuổi nặng 60kg, Creatinine 180 umol/L dùng Ceftriaxone thế nào?"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.intent in ("CLINICAL_RENAL_DOSING", "CLINICAL_AI_CONSULTATION"), "Phải kích hoạt hiệu chỉnh liều thận"
        assert "thận" in resp.reply_text.lower() or "crcl" in resp.reply_text.lower() or "egfr" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_case_03_ddi_clopidogrel_omeprazole_cyp2c19():
    """Ca 3: Tương tác thuốc chống chỉ định Clopidogrel + Omeprazole theo QĐ 5948/QĐ-BYT."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_03", "Bác sĩ Tim mạch", "doctor")
        q = "Clopidogrel uống chung với Nexium có sao không?"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.intent in ("MEDICATION_SAFETY_PROFILE", "DRUG_INTERACTION", "CLINICAL_AI_CONSULTATION")
        assert any(kw in resp.reply_text.lower() for kw in ("cyp2c19", "ức chế", "tương tác", "chuyển hóa", "5948"))


@pytest.mark.asyncio
async def test_case_04_ceftriaxone_calcium_fatal_precipitation():
    """Ca 4: Chống chỉ định tương kỵ Ceftriaxone + Calci kết tủa tử vong."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_04", "Bác sĩ Nhi", "doctor")
        q = "Ceftriaxone có pha chung hoặc truyền cùng đường với dịch truyền chứa Calci được không?"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert any(w in resp.reply_text.lower() for w in ("kết tủa", "tử vong", "chống chỉ định", "tương kỵ"))


@pytest.mark.asyncio
async def test_case_05_regulatory_drug_monograph_identification():
    """Ca 5: Nhận diện chuyên luận Dược Thư và Số Đăng Ký Cục Quản Lý Dược."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_05", "Dược sĩ Lâm sàng", "pharmacist")
        q = "Chỉ định và cách dùng của Ciprofloxacin theo Dược Thư Quốc Gia"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert "ciprofloxacin" in resp.reply_text.lower()
        assert resp.card is None or resp.card.card_type != "borrow_confirm"


def test_case_06_paraphrased_vector_cache_hit_under_2ms():
    """Ca 6: Tra cứu câu diễn đạt khác qua Vector Semantic Cache đạt tốc độ < 2ms."""
    cache = ClinicalLRUCache(
        max_size=10,
        similarity_threshold=0.85,
        vector_similarity_threshold=0.88,
        db_path=False
    )
    dummy_resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng Paracetamol 500mg cho người lớn là 1 viên mỗi 4-6 giờ.",
        legal_basis="DĐVN V tr.1118"
    )

    np.random.seed(101)
    base_v = np.random.randn(768).astype(np.float32)
    base_v /= np.linalg.norm(base_v)

    rand = np.random.randn(768).astype(np.float32)
    v_orth = rand - np.dot(rand, base_v) * base_v
    v_orth /= np.linalg.norm(v_orth)
    sim_target = 0.93
    v_paraphrase = sim_target * base_v + np.sqrt(1.0 - sim_target**2) * v_orth
    v_paraphrase /= np.linalg.norm(v_paraphrase)

    cache.set("Paracetamol 500mg uống thế nào", "doctor", dummy_resp, vector=base_v)

    t0 = time.perf_counter()
    hit = cache.get("Cách dùng và liều uống Paracetamol 500mg", "doctor", vector=v_paraphrase)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    assert hit is not None, "Phải đạt semantic cache hit"
    assert hit.source_status == "cache_semantic"
    assert latency_ms < 2.0, f"Độ trễ cache phải < 2ms (thực tế: {latency_ms:.2f}ms)"


def test_case_07_medical_safety_guardrail_dosage_mismatch():
    """Ca 7: Chốt chặn an toàn y khoa từ chối chia sẻ cache khi lệch liều (500mg vs 250mg)."""
    cache = ClinicalLRUCache(max_size=10, db_path=False)
    dummy_resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều Paracetamol 500mg người lớn.",
        legal_basis="DĐVN V"
    )
    cache.set("Paracetamol 500mg uống thế nào", "doctor", dummy_resp)

    # Truy vấn lệch liều
    miss = cache.get("Paracetamol 250mg uống thế nào", "doctor")
    assert miss is None, "Tuyệt đối không dùng chung cache liều 500mg cho 250mg!"


@pytest.mark.asyncio
async def test_case_08_equipment_ticket_dispatch_explicit():
    """Ca 8: Báo hỏng thiết bị y tế chỉ kích hoạt khi có mệnh lệnh dứt khoát."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_08", "Điều dưỡng Trưởng", "nurse")
        q = "Báo hỏng máy thở phòng mổ 2 bị xì khí"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.intent == "REPORT_EQUIPMENT_INCIDENT"
        assert resp.card is not None
        assert resp.card.card_type == "incident_confirm"


@pytest.mark.asyncio
async def test_case_09_narcotic_borrow_with_mandatory_ampoule_return():
    """Ca 9: Mượn khẩn cấp Morphin kèm ràng buộc thu hồi vỏ ống TT 20/2017."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_09", "Bác sĩ Cấp cứu", "doctor")
        q = "Mượn khẩn cấp 2 ống morphin cho bệnh nhân cấp cứu A9"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.intent == "BORROW_EMERGENCY_ITEM"
        assert resp.card is not None
        assert resp.card.card_type == "borrow_confirm"
        assert any(w in resp.reply_text.lower() for w in ("thu hồi", "vỏ ống", "gây nghiện", "morphin"))


@pytest.mark.asyncio
async def test_case_10_coldchain_telemetry_gsp_standard():
    """Ca 10: Giám sát chuỗi lạnh vắc xin theo tiêu chuẩn GSP TT 36/2018."""
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_sess_10", "Dược sĩ Kho lạnh", "pharmacist")
        q = "Kiểm tra nhiệt độ tủ lạnh vắc xin chuỗi lạnh hiện tại"
        payload = CopilotQuery(query=q)
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")

        assert resp.intent in ("COLDCHAIN_CHECK", "MEDICATION_SAFETY_PROFILE")
        assert any(w in resp.reply_text.lower() for w in ("nhiệt độ", "chuỗi lạnh", "tủ lạnh", "°c", "2.0", "8.0", "gsp"))
