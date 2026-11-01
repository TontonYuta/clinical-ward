"""Deterministic end-to-end intent and safety evaluation for clinician chat."""
import asyncio
import json
from pathlib import Path

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.database import Base, engine

# ASGITransport does not trigger FastAPI lifespan. Ensure an isolated local
# evaluation database has the app schema before sending requests.
async def _ensure_schema() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    from app.database import AsyncSessionLocal
    from app.seed_registry import seed_dav_registry_if_needed
    from app.models.debt import DebtRecord
    async with AsyncSessionLocal() as session:
        if await session.get(DebtRecord, "chatbot-eval-debt") is None:
            session.add(DebtRecord(
                id="chatbot-eval-debt", code="CHATBOT-EVAL-DEBT", item_name="Morphin",
                item_type="Thuốc gây nghiện", quantity=1, patient_name="Người bệnh đánh giá",
                patient_room="TEST", borrow_time="2026-01-01T00:00:00", borrower="Evaluator",
                clinical_reason="Dữ liệu giả lập chỉ phục vụ đánh giá intent", status="debt",
                ampoule_returned=False, ampoule_destroyed=False,
            ))
            await session.commit()
    seed_dav_registry_if_needed()

CASES_PATH = Path(__file__).resolve().parents[3] / "data" / "knowledge_base" / "evaluation" / "chatbot_cases.json"


async def evaluate_chatbot() -> dict:
    await _ensure_schema()
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    rows: list[dict] = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://chatbot-eval") as client:
        for case in cases:
            response = await client.post("/api/v1/copilot/chat", json={
                "query": case["query"], "user_role": "doctor", "user_name": "Eval",
                "session_id": f"chatbot-eval-{case['id']}",
            })
            try:
                data = response.json()
            except ValueError:
                data = {}
            checks = {
                "http_ok": response.status_code == 200,
                "intent": data.get("intent") == case["expected_intent"],
                "answer_type": data.get("answer_type") == case.get("expected_answer_type"),
                "grounded": data.get("rag_grounded", False) is case["expected_grounded"],
                "citations": len(data.get("citations") or []) >= case["min_citations"],
            }
            rows.append({"id": case["id"], "category": case["category"], "passed": all(checks.values()), "checks": checks,
                         "expected_intent": case["expected_intent"], "actual_intent": data.get("intent"),
                         "actual_answer_type": data.get("answer_type"), "actual_grounded": data.get("rag_grounded"),
                         "citation_count": len(data.get("citations") or []), "http_status": response.status_code,
                         "error": data.get("detail") if response.status_code >= 400 else None})
    passed = sum(row["passed"] for row in rows)
    return {
        "case_count": len(rows), "passed": passed, "failed": len(rows) - passed,
        "accuracy": passed / len(rows) if rows else 0.0,
        "clinical_reviewed_count": sum(case.get("clinical_review") == "approved" for case in cases),
        "candidate_unreviewed_count": sum(case.get("clinical_review") != "approved" for case in cases),
        "cases": rows,
        "note": "Deterministic routing/response-contract checks only. Candidate cases are not clinically validated and do not measure answer correctness.",
    }


def evaluate_chatbot_sync() -> dict:
    return asyncio.run(evaluate_chatbot())


if __name__ == "__main__":
    print(json.dumps(evaluate_chatbot_sync(), ensure_ascii=False, indent=2))
