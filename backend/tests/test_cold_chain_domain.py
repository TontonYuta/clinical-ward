import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.domains.cold_chain.repository import ColdChainRepository
from app.domains.cold_chain.tools import ColdChainTools


@pytest_asyncio.fixture
async def cold_chain_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_cold_chain_repository_reads_persisted_state_without_fallbacks(cold_chain_session):
    db = cold_chain_session
    assert await ColdChainRepository.get_current_snapshot(db) is None
    db.add(ColdChainCurrentState(id=8, current_temp=6.2, is_outage=True, is_quarantined=True, vvm_level=2, mkt_temp=6.4, outage_minutes=9, total_vaccine_doses=32))
    await db.commit()
    snapshot = await ColdChainRepository.get_current_snapshot(db)
    assert snapshot is not None
    assert snapshot.current_temp == 6.2
    assert snapshot.is_outage is True
    assert snapshot.total_vaccine_doses == 32


@pytest.mark.asyncio
async def test_cold_chain_repository_preserves_telemetry_order_and_limit(cold_chain_session):
    db = cold_chain_session
    db.add_all([
        ColdChainTelemetry(sensor_id="sensor-a", timestamp="2026-01-01T00:00:00Z", temperature=2.0),
        ColdChainTelemetry(sensor_id="sensor-a", timestamp="2026-01-01T01:00:00Z", temperature=3.0),
    ])
    await db.commit()
    records = await ColdChainRepository.list_recent_telemetry(db, limit=1)
    assert len(records) == 1
    assert records[0].temperature == 3.0


@pytest.mark.asyncio
async def test_cold_chain_tool_returns_only_persisted_measurements(cold_chain_session):
    db = cold_chain_session
    db.add(ColdChainCurrentState(id=9, current_temp=6.1, is_outage=False, is_quarantined=False, vvm_level=1, mkt_temp=6.0, outage_minutes=0, total_vaccine_doses=10))
    await db.commit()

    response = await ColdChainTools().status_response(db)

    assert "6.1°C" in response.reply_text
    assert "4.5°C" not in response.reply_text
    assert response.card.data["current_temp"] == 6.1
    assert response.answer_type == "operational_result"
    assert response.evidence[0]["source_id"] == "cold_chain_current_state"
    assert response.citations[0]["evidence_id"] == response.evidence[0]["evidence_id"]
