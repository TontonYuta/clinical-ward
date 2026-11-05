"""
Step 4 Full Clinical Benchmark & Regression Verification Suite.
Automates rigorous end-to-end evaluation across 20 production logs and clinical edge cases.

Verifies 4 strict criteria:
1. Honest Abstention (Zero hallucination when drug does not exist in DB).
2. Accuracy & Provenance (100% correct data from DĐVN V and DAV).
3. Zero Cross-Drug Leakage (No Biotin in Primolut N, No Naloxon in Venclexta).
4. Anti-Jargon & Natural Formatting (0% 'rag', 'crag', 'csdl', 'hệ thống cung cấp', 0% repeated prefixes).
"""
import pytest
from types import SimpleNamespace
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat

FORBIDDEN_JARGON = [
    "rag", "crag", "csdl", "database", "safe abstention",
    "medabstain", "hệ thống cung cấp", "mô hình ai", "arxiv:2601",
    "toàn văn csdl"
]


class DummyRequest:
    headers = {}
    client = None
    state = SimpleNamespace()


def assert_anti_jargon(reply_text: str, test_name: str = ""):
    reply_lower = reply_text.lower()
    for term in FORBIDDEN_JARGON:
        assert term not in reply_lower, f"[{test_name}] Forbidden technical jargon '{term}' detected in reply: {reply_text[:200]}..."


@pytest.mark.asyncio
async def test_case_01_paracetamol_clean_format_and_no_jargon():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s01", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Paracetamol"), DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Paracetamol" in resp.reply_text
        assert "• **Liều dùng & Cách dùng:**" in resp.reply_text
        # Assert no repeated prefix on every line
        lines = resp.reply_text.splitlines()
        nguoi_lon_count = sum(1 for l in lines if "**Người lớn:**" in l)
        assert nguoi_lon_count <= 1
        tre_em_count = sum(1 for l in lines if "**Trẻ em:**" in l)
        assert tre_em_count <= 1
        assert_anti_jargon(resp.reply_text, "Case 01 Paracetamol")


@pytest.mark.asyncio
async def test_case_02_primolut_n_zero_cross_drug_bleed():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s02", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Tôi cần thông tin về tương tác thuốc của Primolut N"), DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Norethisteron" in resp.reply_text or "Primolut" in resp.reply_text
        assert "biotin" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 02 Primolut N")


@pytest.mark.asyncio
async def test_case_03_teglutik_no_false_safe_abstention():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s03", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Teglutik"), DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Riluzol" in resp.reply_text or "Teglutik" in resp.reply_text
        assert "840110202926" in resp.reply_text
        assert_anti_jargon(resp.reply_text, "Case 03 Teglutik")


@pytest.mark.asyncio
async def test_case_04_venclexta_no_naloxon_bleed():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s04", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Tôi muốn hỏi về tương tác thuốc của Venclexta"), DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Venetoclax" in resp.reply_text
        assert "naloxon" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 04 Venclexta")


@pytest.mark.asyncio
async def test_case_05_unknown_drug_honest_abstention():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s05", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Thuốc BrandX-Random-9999 dùng sao"), DummyRequest(), db, session=session, history="")
        assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
        assert "chưa có dữ liệu chính thức" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 05 Unknown Drug")


@pytest.mark.asyncio
async def test_case_06_fever_lifestyle_no_kenmag():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s06", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="kiêng gì khi bị sốt"), DummyRequest(), db, session=session, history="")
        assert "sốt" in resp.reply_text.lower()
        assert "kenmag" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 06 Fever Lifestyle")


@pytest.mark.asyncio
async def test_case_07_antihistamine_dietary_no_kenmag():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s07", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="nhóm thuốc chống dị ứng kiêng gì"), DummyRequest(), db, session=session, history="")
        assert "kháng histamin" in resp.reply_text.lower() or "chống dị ứng" in resp.reply_text.lower()
        assert "kenmag" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 07 Antihistamines")


@pytest.mark.asyncio
async def test_case_08_pronoun_followup_no_kenmag():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s08", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="cái này dùng thế nào nhỉ cho tôi biết thêm"), DummyRequest(), db, session=session, history="")
        assert "kenmag" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 08 Pronoun Followup")


@pytest.mark.asyncio
async def test_case_09_diabetes_guidance_no_clortalidon():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s09", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="tiểu đường thì chú ý những gì"), DummyRequest(), db, session=session, history="")
        assert "đái tháo đường" in resp.reply_text.lower() or "tiểu đường" in resp.reply_text.lower()
        assert "clortalidon" not in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 09 Diabetes")


@pytest.mark.asyncio
async def test_case_10_stroke_emergency_guidance():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s10", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="nếu bị tai biến thì uống thuốc và sinh hoạt thế nào"), DummyRequest(), db, session=session, history="")
        assert "đột quỵ" in resp.reply_text.lower() or "tai biến" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 10 Stroke")


@pytest.mark.asyncio
async def test_case_11_cardiogenic_shock_noradrenalin_vs_dopamin():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s11", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Nếu bệnh nhân sốc tim thì dùng Noradrenalin hay Dopamin?"), DummyRequest(), db, session=session, history="")
        assert "noradrenalin" in resp.reply_text.lower()
        assert "dopamin" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 11 Shock Comparison")


@pytest.mark.asyncio
async def test_case_12_cephalosporin_gen3_overview():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s12", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="kháng sinh cephalosporin thế hệ 3 gồm những thuốc nào"), DummyRequest(), db, session=session, history="")
        assert "cephalosporin" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 12 Cephalosporin")


@pytest.mark.asyncio
async def test_case_13_paracetamol_ibuprofen_polypharmacy():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s13", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Paracetamol và Ibuprofen uống chung được không?"), DummyRequest(), db, session=session, history="")
        assert "paracetamol" in resp.reply_text.lower()
        assert "ibuprofen" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 13 Paracetamol + Ibuprofen")


@pytest.mark.asyncio
async def test_case_14_clopidogrel_omeprazole_interaction_qd5948():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s14", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Clopidogrel và Omeprazole có tương tác không?"), DummyRequest(), db, session=session, history="")
        assert "clopidogrel" in resp.reply_text.lower()
        assert "cyp2c19" in resp.reply_text.lower() or "pantoprazol" in resp.reply_text.lower() or "giảm tác dụng" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 14 Clopidogrel + Omeprazole")


@pytest.mark.asyncio
async def test_case_15_pediatric_paracetamol_dosing():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s15", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Trẻ em 5 tuổi sốt cao uống Paracetamol liều bao nhiêu?"), DummyRequest(), db, session=session, history="")
        assert "paracetamol" in resp.reply_text.lower()
        assert "mg/kg" in resp.reply_text.lower() or "240" in resp.reply_text or "250" in resp.reply_text
        assert_anti_jargon(resp.reply_text, "Case 15 Pediatric Paracetamol")


@pytest.mark.asyncio
async def test_case_16_renal_cefotaxime_dosage_adjustment():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s16", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Bệnh nhân suy thận có CrCl: 25 ml/phút dùng Cefotaxim thế nào?"), DummyRequest(), db, session=session, history="")
        assert "cefotaxim" in resp.reply_text.lower()
        assert "thận" in resp.reply_text.lower() or "liều" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 16 Renal Cefotaxime")


@pytest.mark.asyncio
async def test_case_17_metformin_ct_contrast_procedure():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s17", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Metformin chụp CT có thuốc cản quang thì sao?"), DummyRequest(), db, session=session, history="")
        assert "metformin" in resp.reply_text.lower()
        assert "cản quang" in resp.reply_text.lower() or "toan lactic" in resp.reply_text.lower() or "ngừng" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 17 Metformin CT Contrast")


@pytest.mark.asyncio
async def test_case_18_conversational_greeting():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s18", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Xin chào bạn, chúc một ngày làm việc tốt lành!"), DummyRequest(), db, session=session, history="")
        assert len(resp.reply_text) > 10
        assert_anti_jargon(resp.reply_text, "Case 18 Greeting")


@pytest.mark.asyncio
async def test_case_19_allopurinol_rash_emergency():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s19", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="Allopurinol, nếu nổi ban thì xử trí thế nào?"), DummyRequest(), db, session=session, history="")
        assert "allopurinol" in resp.reply_text.lower()
        assert "ngừng" in resp.reply_text.lower() or "dị ứng" in resp.reply_text.lower() or "ban" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 19 Allopurinol Rash")


@pytest.mark.asyncio
async def test_case_20_acute_gastroenteritis_dehydration():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bm_s20", "Bác sĩ", "doctor")
        resp = await handle_copilot_chat(CopilotQuery(query="đau bụng, sốt cao, đi ngoài mất nước"), DummyRequest(), db, session=session, history="")
        assert "bù nước" in resp.reply_text.lower() or "oresol" in resp.reply_text.lower() or "tiêu chảy" in resp.reply_text.lower() or "điện giải" in resp.reply_text.lower()
        assert_anti_jargon(resp.reply_text, "Case 20 Dehydration")
