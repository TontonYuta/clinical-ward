import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.seed import seed

@pytest_asyncio.fixture(autouse=True)
async def reset_database():
    await seed()
    yield

@pytest.mark.asyncio
async def test_registry_returns_hospital_stock_by_registration_number_and_filter():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        all_response = await client.get('/api/v1/registry', params={'search': '893100110026', 'page_size': 20})
        assert all_response.status_code == 200
        all_data = all_response.json()
        assert all_data['items']
        item = all_data['items'][0]
        assert item['national_code'] == '893100110026'
        assert item['hospital_stock_by_unit'] == [{'unit': 'Viên', 'quantity': 80, 'batch_count': 1}]
        assert all_data['hospital_stock_drug_count'] >= 1
        assert all_data['inventory_revision']
        assert all_data['registry_revision']
        warehouse_response = await client.get('/api/v1/registry', params={'only_in_warehouse': True, 'page': 1, 'page_size': 1})
        assert warehouse_response.status_code == 200
        warehouse_data = warehouse_response.json()
        assert warehouse_data['total'] == warehouse_data['hospital_stock_drug_count']
        assert len(warehouse_data['items']) == 1
        assert warehouse_data['items'][0]['hospital_stock_by_unit']

@pytest.mark.asyncio
async def test_registry_stock_revision_changes_after_inventory_dispatch():
    # Exercise revision invalidation with an eligible batch, independent of the
    # seed's fixed historical expiry date. Expired dispatch is tested separately.
    from datetime import date, timedelta
    from app.database import AsyncSessionLocal
    from app.models.inventory import InventoryBatch
    async with AsyncSessionLocal() as session:
        batch = await session.get(InventoryBatch, 'b-1')
        batch.expiry_date = (date.today() + timedelta(days=30)).isoformat()
        await session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        before = (await client.get('/api/v1/registry', params={'search': '893100110026'})).json()
        dispatched = await client.post('/api/v1/inventory/batches/b-1/dispatch', json={'quantity': 1})
        assert dispatched.status_code == 200
        after = (await client.get('/api/v1/registry', params={'search': '893100110026'})).json()
        assert after['inventory_revision'] != before['inventory_revision']
        assert after['items'][0]['hospital_stock_by_unit'][0]['quantity'] == before['items'][0]['hospital_stock_by_unit'][0]['quantity'] - 1

@pytest.mark.asyncio
async def test_registry_keeps_distinct_units_for_same_registration_number():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.inventory import InventoryBatch
    async with AsyncSessionLocal() as session:
        batch = (await session.execute(select(InventoryBatch).where(InventoryBatch.id == 'b-1'))).scalar_one()
        batch.current_stock += 5
        second = InventoryBatch(**{column.name: getattr(batch, column.name) for column in InventoryBatch.__table__.columns if column.name != 'id'})
        second.id = 'registry-unit-test-batch'
        second.batch_number = 'LOT-UNIT-TEST'
        second.unit = 'Hộp'
        second.current_stock = 3
        session.add(second)
        await session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/v1/registry', params={'search': '893100110026'})
    item = response.json()['items'][0]
    assert {stock['unit']: stock['quantity'] for stock in item['hospital_stock_by_unit']} == {'Hộp': 3, 'Viên': 85}

@pytest.mark.asyncio
async def test_registry_normalizes_registration_number_without_falling_back_to_national_code():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.inventory import InventoryBatch
    orig_reg, orig_code = None, None
    async with AsyncSessionLocal() as session:
        batch = (await session.execute(select(InventoryBatch).where(InventoryBatch.id == 'b-1'))).scalar_one()
        orig_reg = batch.registration_number
        orig_code = batch.national_code
        batch.registration_number = '  893100110026  '
        batch.national_code = 'UNRELATED-INTERNAL-CODE'
        await session.commit()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/api/v1/registry', params={'search': '893100110026'})
            unrelated = await client.get('/api/v1/registry', params={'search': '893100110026', 'only_in_warehouse': True})
        assert response.status_code == unrelated.status_code == 200
        item = response.json()['items'][0]
        assert item['hospital_stock_by_unit'] == [{'unit': 'Viên', 'quantity': 80, 'batch_count': 1}]
        assert unrelated.json()['items'][0]['national_code'] == '893100110026'
    finally:
        async with AsyncSessionLocal() as session:
            batch = (await session.execute(select(InventoryBatch).where(InventoryBatch.id == 'b-1'))).scalar_one()
            batch.registration_number = orig_reg
            batch.national_code = orig_code
            await session.commit()
