import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.session_context import get_or_create_session

@pytest.mark.asyncio
async def test_multiturn_alcohol_interaction_pinpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        session_id = "test-intent-accuracy-alcohol"
        # Turn 1: Lookup Paracetamol
        res1 = await ac.post("/api/v1/copilot/chat", json={
            "query": "Thông tin thuốc Paracetamol",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "Paracetamol" in data1["reply_text"] or "paracetamol" in data1["reply_text"].lower()

        # Turn 2: Deictic reference to alcohol interaction
        res2 = await ac.post("/api/v1/copilot/chat", json={
            "query": "thuốc này có kỵ rượu không",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res2.status_code == 200
        data2 = res2.json()
        # Verify it DOES NOT abstain or demand 2 drugs
        assert data2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert data2["answer_type"] in ("medication_field", "medication_fields")
        assert "CYP2E1" in data2["reply_text"] or "NAPQI" in data2["reply_text"] or "rượu" in data2["reply_text"].lower()
        assert "Glutathion" in data2["reply_text"] or "độc tính gan" in data2["reply_text"].lower()

@pytest.mark.asyncio
async def test_food_milk_chelation_pinpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        session_id = "test-intent-accuracy-food"
        # Turn 1: Lookup Ciprofloxacin
        res1 = await ac.post("/api/v1/copilot/chat", json={
            "query": "Ciprofloxacin",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res1.status_code == 200

        # Turn 2: Ask if can drink with milk
        res2 = await ac.post("/api/v1/copilot/chat", json={
            "query": "thuốc này uống cùng sữa được không",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "sữa" in data2["reply_text"].lower() or "canxi" in data2["reply_text"].lower() or "chelat" in data2["reply_text"].lower()
        # Ensure it does not demand 2 drugs
        assert "hai thuốc" not in data2["reply_text"].lower()

@pytest.mark.asyncio
async def test_timing_meals_no_refusal():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        session_id = "test-intent-accuracy-timing"
        # Turn 1: Lookup Paracetamol
        res1 = await ac.post("/api/v1/copilot/chat", json={
            "query": "Paracetamol",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res1.status_code == 200

        # Turn 2: Ask timing (before or after meals)
        res2 = await ac.post("/api/v1/copilot/chat", json={
            "query": "thuốc này uống trước hay sau ăn",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res2.status_code == 200
        data2 = res2.json()
        # Must NOT return insufficient formulation clarification
        assert "cần được đối chiếu theo đúng dạng bào chế" not in data2["reply_text"]
        assert data2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "ăn" in data2["reply_text"].lower() or "bữa ăn" in data2["reply_text"].lower() or "liều" in data2["reply_text"].lower()

@pytest.mark.asyncio
async def test_hepatic_adjustment_pinpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        session_id = "test-intent-accuracy-hepatic"
        # Turn 1: Lookup Paracetamol
        await ac.post("/api/v1/copilot/chat", json={
            "query": "Paracetamol",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })

        # Turn 2: Ask about liver impairment
        res2 = await ac.post("/api/v1/copilot/chat", json={
            "query": "bệnh nhân suy gan dùng thuốc này thế nào",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "gan" in data2["reply_text"].lower() or "suy gan" in data2["reply_text"].lower()

@pytest.mark.asyncio
async def test_contextless_alcohol_query_prompts_clarification():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        session_id = "test-intent-accuracy-no-context"
        # Ask alcohol interaction without any prior context or drug name
        res = await ac.post("/api/v1/copilot/chat", json={
            "query": "thuốc có kỵ rượu không",
            "session_id": session_id,
            "user_name": "Bác sĩ Test",
            "user_role": "Bác sĩ điều trị"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["answer_type"] in ("clarification", "safe_abstention")
        assert "thuốc" in data["reply_text"].lower() or "hoạt chất" in data["reply_text"].lower()
