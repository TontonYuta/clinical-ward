import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.inventory import InventoryBatch
from app.domains.pharmacy_inventory.service import PharmacyInventoryService


@pytest_asyncio.fixture
async def inventory_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_inventory_keeps_batches_and_locations_distinct(inventory_session):
    inventory_session.add_all([
        InventoryBatch(id="a", item_name="Drug X", batch_number="A", category="x", expiry_date="2027-01-01", days_left=10, current_stock=5, min_threshold=1, max_threshold=10, unit="box", warehouse_location="A1"),
        InventoryBatch(id="b", item_name="Drug X", batch_number="B", category="x", expiry_date="2028-01-01", days_left=20, current_stock=8, min_threshold=1, max_threshold=10, unit="box", warehouse_location="B2"),
    ])
    await inventory_session.commit()
    result = await PharmacyInventoryService().get_stock(inventory_session, query="Drug X")
    assert result.status == "available"
    assert [(row.batch_number, row.warehouse_location) for row in result.records] == [("A", "A1"), ("B", "B2")]


@pytest.mark.asyncio
async def test_inventory_missing_match_is_unavailable(inventory_session):
    result = await PharmacyInventoryService().get_stock(inventory_session, query="not-present")
    assert result.status == "unavailable"
    assert result.records == ()


@pytest.mark.asyncio
async def test_inventory_tool_attaches_batch_provenance(inventory_session):
    inventory_session.add(InventoryBatch(id="source-batch", item_name="Drug Y", batch_number="Y1", category="x", expiry_date="2027-01-01", days_left=10, current_stock=2, min_threshold=1, max_threshold=5, unit="box", warehouse_location="A1"))
    await inventory_session.commit()
    from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
    response = await PharmacyInventoryTools().execute_stock_lookup(inventory_session, "Drug Y")
    assert response.evidence[0]["source_id"] == "inventory_batches"
    assert response.evidence[0]["record_id"] == "source-batch"
    assert response.citations[0]["evidence_id"] == response.evidence[0]["evidence_id"]
