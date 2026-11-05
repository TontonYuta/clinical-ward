"""
Unit & Integration Test Suite for Polypharmacy Cross-Matrix Engine (Milestone 4).
Validates NxN pairwise combinatorial matrix, syndrome detection, auto-substitutions,
and strict zero-emoji presentation according to QĐ 5948/QĐ-BYT.
"""
import re
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
from app.services.clinical_ddi_engine.schemas import DdiSeverity

client = TestClient(app)
EMOJI_REGEX = re.compile(r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf]")

def assert_zero_emojis(text: str):
    matches = EMOJI_REGEX.findall(text)
    assert not matches, f"Output contains forbidden emojis: {matches}"

def test_three_drug_matrix_with_contraindication():
    """Test 3-drug regimen: Clopidogrel + Aspirin + Nexium (detects Contraindication + PPI substitute)."""
    resp = format_multi_ddi_response(["Clopidogrel", "Aspirin", "Nexium"], "Clopidogrel + Aspirin + Nexium")

    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert resp.confidence == 1.0
    assert_zero_emojis(resp.reply_text)

    # Core Clinical Guidance validation
    assert "**Kết luận lâm sàng chính (Core Clinical Guidance):**" in resp.reply_text
    assert "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI" in resp.reply_text
    assert "Clopidogrel + Esomeprazol" in resp.reply_text
    assert "Pantoprazol 40 mg" in resp.reply_text

    # Cross-Matrix Table validation
    assert "### Ma Trận Đối Soát Tương Tác Chéo (Polypharmacy Cross-Matrix)" in resp.reply_text
    assert "| Thuốc rà soát | Clopidogrel | Aspirin | Esomeprazol |" in resp.reply_text
    assert "CHỐNG CHỈ ĐỊNH" in resp.reply_text
    assert "AN TOÀN" in resp.reply_text

    # CDSS Alert & Action Card validation
    assert resp.cdss_alert is not None
    assert resp.cdss_alert.level == "critical"
    assert resp.cdss_alert.substituteDrug == "Pantoprazol 40mg"
    assert resp.card is not None
    assert resp.card.target_tab == "cpoe"

    # Citation to official PDF
    assert resp.citations is not None
    assert any("5948" in c.get("legal_basis", "") or "5948" in c.get("source", "") for c in resp.citations)

def test_triple_whammy_acute_kidney_injury():
    """Test Triple Whammy syndrome: ACEI/ARB (Enalapril) + Loop Diuretic (Furosemid) + NSAID (Ibuprofen)."""
    resp = format_multi_ddi_response(["Enalapril", "Furosemid", "Ibuprofen"], "Enalapril + Furosemid + Ibuprofen")

    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert_zero_emojis(resp.reply_text)

    # Syndrome detection in BLUF and matrix
    assert "TRIPLE WHAMMY" in resp.reply_text.upper()
    assert "SUY THẬN CẤP" in resp.reply_text.upper()
    assert "CẢNH BÁO TÍCH LŨY" in resp.reply_text

    # Matrix reflects cumulative warning for involved drugs
    assert "| Thuốc rà soát | Enalapril | Furosemid | Ibuprofen |" in resp.reply_text
    assert resp.cdss_alert is not None
    assert "TRIPLE WHAMMY" in resp.cdss_alert.title.upper()

def test_cumulative_qtc_prolongation_escalation():
    """Test 3 QT-prolonging drugs: Amiodaron + Levofloxacin + Ondansetron escalates to Contraindicated."""
    resp = format_multi_ddi_response(["Amiodaron", "Levofloxacin", "Ondansetron"], "Amiodaron + Levofloxacin + Ondansetron")

    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert_zero_emojis(resp.reply_text)

    # 3 QT prolonging drugs escalate to CONTRAINDICATED
    assert "XOẮN ĐỈNH" in resp.reply_text.upper()
    assert "CHỐNG CHỈ ĐỊNH" in resp.reply_text
    assert resp.cdss_alert is not None
    assert resp.cdss_alert.level == "critical"

def test_multimodal_safe_synergy():
    """Test Safe Synergy: Morphin + Paracetamol (WHO multimodal pain relief)."""
    resp = format_multi_ddi_response(["Morphin", "Paracetamol"], "Morphin và Paracetamol")

    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert_zero_emojis(resp.reply_text)

    # Synergy messaging
    assert "HIỆP ĐỒNG AN TOÀN ĐA MÔ THỨC" in resp.reply_text
    assert "tiết kiệm 20-30% liều Morphin" in resp.reply_text
    assert "> [!NOTE] Lưu ý thực hành lâm sàng đa mô thức" in resp.reply_text

    # CDSS alert is info level
    assert resp.cdss_alert is not None
    assert resp.cdss_alert.level == "info"

def test_two_safe_drugs_zero_interaction():
    """Test Two safe drugs: Paracetamol + Amoxicillin (no interaction)."""
    resp = format_multi_ddi_response(["Paracetamol", "Amoxicillin"], "Paracetamol và Amoxicillin")

    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert_zero_emojis(resp.reply_text)

    assert "Không ghi nhận tương tác chống chỉ định hoặc cảnh báo nghiêm trọng" in resp.reply_text
    assert resp.cdss_alert is None
    assert resp.card is None

def test_api_endpoint_polypharmacy_inquiry():
    """Test full HTTP integration through /api/v1/copilot/chat for multi-drug queries."""
    payload = {
        "query": "bệnh nhân đang dùng Clopidogrel mà đau đầu có uống được Aspirin hoặc Nexium không",
        "session_id": "test-poly-matrix-session"
    }
    response = client.post("/api/v1/copilot/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["intent"] == "MEDICATION_SAFETY_PROFILE"
    reply = data["reply_text"]
    assert_zero_emojis(reply)

    assert "Ma Trận Đối Soát Tương Tác Chéo (Polypharmacy Cross-Matrix)" in reply
    assert "CHỐNG CHỈ ĐỊNH" in reply
    assert "Pantoprazol 40 mg" in reply
    assert data["card"] is not None
    assert data["card"]["target_tab"] == "cpoe"
    assert data["citations"] is not None
