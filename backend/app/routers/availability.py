"""Bounded, secret-free health details for the chatbot UI."""
import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.schemas.availability import AvailabilityResponse

router = APIRouter(prefix="/availability", tags=["Availability"])
_provider_state = {"value": "unknown", "checked_at": 0.0, "checked_at_wall": 0.0}
_provider_lock: asyncio.Lock | None = None
_PROVIDER_CACHE_SECONDS = 60.0
_PROVIDER_TIMEOUT_SECONDS = 4.0


async def _check_provider() -> str:
    global _provider_lock
    if _provider_lock is None:
        _provider_lock = asyncio.Lock()
    async with _provider_lock:
        now = time.monotonic()
        if now - _provider_state["checked_at"] < _PROVIDER_CACHE_SECONDS:
            return _provider_state["value"]
        state = "not_configured"
        try:
            from app.services.admin_key_vault import get_active_api_key
            provider = (settings.LLM_PROVIDER or "gemini").strip().lower()
            key = get_active_api_key("gemini") or settings.GEMINI_API_KEY
            if provider == "openai_compatible":
                base_url = (settings.OPENAI_API_BASE or "").strip().rstrip("/")
                api_key = (settings.OPENAI_API_KEY or "").strip()
                if not base_url:
                    state = "unavailable"
                else:
                    import httpx
                    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                    async with httpx.AsyncClient(timeout=_PROVIDER_TIMEOUT_SECONDS) as client:
                        response = await client.get(f"{base_url}/models", headers=headers)
                    state = "available" if response.status_code == 200 else "unavailable"
                _provider_state.update(value=state, checked_at=time.monotonic(), checked_at_wall=time.time())
                return state
            if provider in {"offline", "none", "disable", "disabled"}:
                state = "not_configured"
            elif key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
                import httpx
                model = "gemini-3.5-flash-lite"
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                async with httpx.AsyncClient(timeout=_PROVIDER_TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        url,
                        params={"key": key},
                        json={"contents": [{"parts": [{"text": "ping"}]}], "generationConfig": {"maxOutputTokens": 1}},
                    )
                state = "available" if response.status_code == 200 else "unavailable"
        except Exception:
            state = "unavailable" if state != "not_configured" else "unknown"
        _provider_state.update(value=state, checked_at=time.monotonic(), checked_at_wall=time.time())
        return state


@router.get("", response_model=AvailabilityResponse)
async def get_availability() -> AvailabilityResponse:
    db_state = "unavailable"
    try:
        async with asyncio.timeout(2.0):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            db_state = "available"
    except Exception:
        pass

    vector_state = "unavailable"
    fts_state = "unavailable"
    try:
        from pathlib import Path
        from app.services.rag.sqlite_fts import get_fts_db_path
        index_path = Path(get_fts_db_path())
        if index_path.exists():
            import sqlite3
            def _check_indexes() -> bool:
                conn = sqlite3.connect(f"file:{index_path}?mode=ro", uri=True, timeout=1.0)
                try:
                    fts = conn.execute("SELECT 1 FROM sqlite_master WHERE name='clinical_rag_fts'").fetchone()
                    vectors = conn.execute("SELECT 1 FROM sqlite_master WHERE name='clinical_chunk_vectors'").fetchone()
                    if not fts:
                        return (False, False)
                    fts_count = conn.execute("SELECT count(*) FROM clinical_rag_fts").fetchone()[0]
                    vector_count = 0
                    if vectors:
                        vector_count = conn.execute("SELECT count(*) FROM clinical_chunk_vectors").fetchone()[0]
                    return (fts_count > 0, vector_count > 0)
                finally:
                    conn.close()
            async with asyncio.timeout(1.5):
                fts_ok, vector_ok = await asyncio.to_thread(_check_indexes)
                if fts_ok:
                    fts_state = "available"
                if vector_ok:
                    vector_state = "available"
    except Exception:
        pass

    provider_state = await _check_provider()
    backend_state = "available"
    retrieval_ready = db_state == "available" and fts_state == "available"
    if provider_state == "available" and retrieval_ready:
        mode = "online_ai"
    elif backend_state == "available" and retrieval_ready:
        mode = "local_only"
    else:
        mode = "offline"

    return AvailabilityResponse(
        mode=mode, backend=backend_state, database=db_state, vector_index=vector_state,
        provider=provider_state, checked_at=datetime.now(timezone.utc).isoformat(),
        provider_checked_at=datetime.fromtimestamp(
            _provider_state.get("checked_at_wall", 0.0), timezone.utc
        ).isoformat() if _provider_state.get("checked_at_wall", 0.0) else None,
    )
