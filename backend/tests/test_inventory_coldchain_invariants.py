"""Business regression tests use an isolated temporary database, never the app DB."""
from datetime import date, timedelta
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.models.audit import AuditRecord, AuditAppendLock
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.models.inventory import InventoryBatch
from app.routers import coldchain, inventory
from app.schemas.inventory import BatchDispatch
from app.security.auth import AuthenticationMiddleware, issue_token


@pytest_asyncio.fixture
async def isolated_api(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'invariants.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    tables = [InventoryBatch.__table__, ColdChainCurrentState.__table__,
              ColdChainTelemetry.__table__, AuditRecord.__table__, AuditAppendLock.__table__]
    async with engine.begin() as connection:
        await connection.run_sync(lambda conn: Base.metadata.create_all(conn, tables=tables))
    app = FastAPI()
    app.include_router(inventory.router, prefix="/api/v1")
    app.include_router(coldchain.router, prefix="/api/v1")

    async def session_dependency():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = session_dependency
    async with sessions() as session:
        session.add(InventoryBatch(
            id="batch", item_name="Drug", batch_number="LOT", category="medicine",
            expiry_date="2099-01-01", days_left=999, current_stock=10,
            min_threshold=5, max_threshold=100, unit="pill", warehouse_location="A",
            is_quarantined=False,
        ))
        session.add(ColdChainCurrentState(
            id=1, current_temp=4.5, is_outage=False, is_quarantined=True,
            vvm_level=1, mkt_temp=5.6, outage_minutes=12, total_vaccine_doses=123,
        ))
        await session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, sessions
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("quantity", [-5, 0, True, 1.5, "3"])
async def test_dispatch_rejects_nonpositive_or_noninteger_quantity(isolated_api, quantity):
    client, sessions = isolated_api
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": quantity})
    assert response.status_code == 422
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).current_stock == 10


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [{"is_quarantined": True}, {"expiry_date": "2000-01-01"}])
async def test_dispatch_rejects_quarantined_or_expired_stock(isolated_api, changes):
    client, sessions = isolated_api
    async with sessions() as session:
        batch = await session.get(InventoryBatch, "batch")
        for key, value in changes.items():
            setattr(batch, key, value)
        await session.commit()
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 2})
    assert response.status_code == 409
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).current_stock == 10


@pytest.mark.asyncio
async def test_dispatch_rechecks_stock_when_session_has_stale_batch(isolated_api):
    _, sessions = isolated_api
    async with sessions() as first, sessions() as second:
        # Both operators view the same ten units before either dispatches seven.
        old_first = await first.get(InventoryBatch, "batch")
        old_second = await second.get(InventoryBatch, "batch")
        assert old_first.current_stock == old_second.current_stock == 10
        await inventory.dispatch_fefo_batch("batch", BatchDispatch(quantity=7), first)
        with pytest.raises(HTTPException) as rejected:
            await inventory.dispatch_fefo_batch("batch", BatchDispatch(quantity=7), second)
        assert rejected.value.status_code == 400
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).current_stock == 3


@pytest.mark.asyncio
@pytest.mark.parametrize("stock", [10, 150])
async def test_restock_proposal_does_not_change_physical_stock(isolated_api, stock):
    client, sessions = isolated_api
    async with sessions() as session:
        batch = await session.get(InventoryBatch, "batch")
        batch.current_stock = stock
        await session.commit()
    response = await client.post("/api/v1/inventory/restock-proposal", json={"batch_ids": ["batch"]})
    assert response.status_code == 200
    assert response.json()["total_units_replenished"] == 0
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).current_stock == stock


@pytest.mark.asyncio
async def test_restock_rejects_partially_unknown_selection(isolated_api):
    client, _ = isolated_api
    response = await client.post("/api/v1/inventory/restock-proposal", json={"batch_ids": ["batch", "missing"]})
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [
    {"is_outage": True}, {"current_temp": 11.0}, {"current_temp": 1.0},
    {"vvm_level": 4}, {"mkt_temp": 9.0}, {"is_quarantined": False},
])
async def test_release_rejects_unsafe_or_unquarantined_state(isolated_api, changes):
    client, sessions = isolated_api
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        for key, value in changes.items():
            setattr(state, key, value)
        await session.commit()
    response = await client.post("/api/v1/coldchain/release-quarantine", json={
        "vvm_level_confirmed": 1, "mkt_confirmed": 5.6,
    })
    assert response.status_code == 409
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        assert state.is_quarantined == changes.get("is_quarantined", True)


@pytest.mark.asyncio
@pytest.mark.parametrize("confirmation", [
    {"vvm_level_confirmed": 2, "mkt_confirmed": 5.6},
    {"vvm_level_confirmed": 1, "mkt_confirmed": 6.2},
])
async def test_release_rejects_confirmation_that_does_not_match_record(isolated_api, confirmation):
    client, _ = isolated_api
    response = await client.post("/api/v1/coldchain/release-quarantine", json=confirmation)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_valid_release_audits_actual_dose_count(isolated_api):
    client, sessions = isolated_api
    response = await client.post("/api/v1/coldchain/release-quarantine", json={
        "vvm_level_confirmed": 1, "mkt_confirmed": 5.6,
    })
    assert response.status_code == 200
    async with sessions() as session:
        assert (await session.get(ColdChainCurrentState, 1)).is_quarantined is False
        event = (await session.execute(select(AuditRecord))).scalar_one()
        assert event.payload_data["total_doses"] == 123


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["simulate-outage", "restore-power", "release-quarantine"])
async def test_mutation_without_coldchain_state_returns_conflict(isolated_api, path):
    client, sessions = isolated_api
    async with sessions() as session:
        await session.delete(await session.get(ColdChainCurrentState, 1))
        await session.commit()
    response = await client.post(f"/api/v1/coldchain/{path}", json={
        "vvm_level_confirmed": 1, "mkt_confirmed": 5.6,
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_liquidation_requires_director_but_engineer_can_transfer():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"engineer":{"role":"biomedical_engineer"}}')

    @app.put("/api/v1/assets/{asset_id}/{action}")
    async def mutate_asset(asset_id: str, action: str):
        return {"ok": True}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        director = {"Authorization": f"Bearer {issue_token('dir', 'director', 's' * 32)}"}
        assert (await client.put("/api/v1/assets/a/transfer", headers=engineer)).status_code == 200
        assert (await client.put("/api/v1/assets/a/liquidate", headers=engineer)).status_code == 403
        assert (await client.put("/api/v1/assets/a/liquidate", headers=director)).status_code == 200


@pytest.mark.asyncio
async def test_cpoe_patient_data_is_not_readable_by_equipment_engineer():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"engineer":{"role":"biomedical_engineer"}}')

    @app.get("/api/v1/cpoe")
    async def orders():
        return [{"patientName": "Confidential", "patientCccd": "123"}]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        doctor = {"Authorization": f"Bearer {issue_token('doc', 'doctor', 's' * 32)}"}
        assert (await client.get("/api/v1/cpoe", headers=engineer)).status_code == 403
        assert (await client.get("/api/v1/cpoe", headers=doctor)).status_code == 200


@pytest.mark.asyncio
async def test_expiry_filter_and_days_follow_current_date_instead_of_seed_flags(isolated_api):
    client, sessions = isolated_api
    async with sessions() as session:
        batch = await session.get(InventoryBatch, "batch")
        batch.expiry_date = (date.today() + timedelta(days=10)).isoformat()
        batch.days_left = 999
        batch.is_near_expiry = False
        batch.current_stock = 1
        batch.is_low_stock = False
        await session.commit()
    response = await client.get("/api/v1/inventory/batches", params={"near_expiry": True})
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["days_left"] == 10
    assert response.json()[0]["is_near_expiry"] is True
    assert response.json()[0]["is_low_stock"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("action, expected_mkt", [("simulate-outage", 7.25), ("restore-power", 6.89)])
async def test_mkt_uses_latest_twenty_readings_including_new_reading_once(isolated_api, action, expected_mkt):
    client, sessions = isolated_api
    async with sessions() as session:
        if action == "restore-power":
            (await session.get(ColdChainCurrentState, 1)).is_outage = True
        for temperature in [1.0] * 20 + [7.0] * 20:
            session.add(ColdChainTelemetry(timestamp="12:00", temperature=temperature))
        await session.commit()
    assert (await client.post(f"/api/v1/coldchain/{action}")).status_code == 200
    async with sessions() as session:
        assert (await session.get(ColdChainCurrentState, 1)).mkt_temp == expected_mkt


@pytest.mark.asyncio
async def test_sms_patient_logs_require_clinical_role():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"engineer":{"role":"biomedical_engineer"}}')

    @app.get("/api/v1/sms/logs")
    async def messages():
        return [{"patientName": "Confidential", "recipientPhone": "0912345678"}]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        nurse = {"Authorization": f"Bearer {issue_token('nurse', 'nurse', 's' * 32)}"}
        assert (await client.get("/api/v1/sms/logs", headers=engineer)).status_code == 403
        assert (await client.get("/api/v1/sms/logs", headers=nurse)).status_code == 200


@pytest.mark.asyncio
async def test_missing_status_does_not_create_healthy_inventory_or_readings(isolated_api):
    client, sessions = isolated_api
    async with sessions() as session:
        await session.delete(await session.get(ColdChainCurrentState, 1))
        await session.commit()
    response = await client.get("/api/v1/coldchain/status")
    assert response.status_code == 409
    async with sessions() as session:
        assert await session.get(ColdChainCurrentState, 1) is None
        assert (await session.execute(select(ColdChainTelemetry))).scalars().all() == []


@pytest.mark.asyncio
async def test_status_without_telemetry_has_no_fabricated_sample_history(isolated_api):
    client, _ = isolated_api
    response = await client.get("/api/v1/coldchain/status")
    assert response.status_code == 200
    assert response.json()["logs"] == []


@pytest.mark.asyncio
async def test_status_exposes_persisted_cabinet_identity(isolated_api):
    client, _ = isolated_api
    response = await client.get("/api/v1/coldchain/status")
    assert response.status_code == 200
    assert response.json()["id"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["dispatch", "proposal", "release"])
async def test_authenticated_audit_actor_cannot_be_replaced_by_payload_or_demo_name(isolated_api, operation):
    _, sessions = isolated_api
    app = FastAPI()
    app.include_router(inventory.router, prefix="/api/v1")
    app.include_router(coldchain.router, prefix="/api/v1")
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"actual.pharmacist":{"role":"pharmacist"}}')

    async def db_dependency():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = db_dependency
    paths = {
        "dispatch": ("/api/v1/inventory/batches/batch/dispatch", {"quantity": 1}),
        "proposal": ("/api/v1/inventory/restock-proposal", {"batch_ids": ["batch"], "pharmacist_name": "Forged director"}),
        "release": ("/api/v1/coldchain/release-quarantine", {
            "signer_name": "Forged director", "pharmacist_name": "Forged witness",
            "vvm_level_confirmed": 1, "mkt_confirmed": 5.6,
        }),
    }
    path, payload = paths[operation]
    headers = {"Authorization": f"Bearer {issue_token('actual.pharmacist', 'pharmacist', 's' * 32)}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(path, json=payload, headers=headers)).status_code == 200
    async with sessions() as session:
        event = (await session.execute(select(AuditRecord))).scalar_one()
        assert event.signer_name == "actual.pharmacist"
        assert event.signer_certificate == "account:actual.pharmacist"
        assert event.auth_method == "AUTHENTICATED_SESSION"
        if operation == "release":
            assert event.witness_name is None
            assert event.witness_certificate is None
            assert event.payload_data["claimed_witness_name"] == "Forged witness"
            assert event.payload_data["dual_witness_verified"] is False


async def _mark_fixture_batch_as_cold_stock(sessions):
    async with sessions() as session:
        batch = await session.get(InventoryBatch, "batch")
        # Exact product identity and location copied from the existing b-8 fixture.
        batch.item_name = "Vaxigrip"
        batch.registration_number = "300310033526"
        batch.national_code = "300310033526"
        batch.warehouse_location = "Kho Lạnh Dược GSP (Tủ bảo quản T1 2.0°C - 8.0°C)"
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("mapping", ["{}", "bad-json", "[]", '{"batch":true}', '{"batch":0}'])
async def test_cold_stock_cannot_dispatch_without_valid_explicit_cabinet_link(isolated_api, monkeypatch, mapping):
    client, sessions = isolated_api
    monkeypatch.setenv("COLDCHAIN_INVENTORY_LINKS_JSON", mapping)
    await _mark_fixture_batch_as_cold_stock(sessions)
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 1})
    assert response.status_code == 409
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).current_stock == 10


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [
    {"is_quarantined": True}, {"is_outage": True}, {"current_temp": 11.0},
    {"vvm_level": 4}, {"mkt_temp": 9.0}, {"missing": True},
])
async def test_mapped_cold_stock_obeys_persisted_cabinet_hold(isolated_api, monkeypatch, changes):
    client, sessions = isolated_api
    monkeypatch.setenv("COLDCHAIN_INVENTORY_LINKS_JSON", '{"batch":1}')
    await _mark_fixture_batch_as_cold_stock(sessions)
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        state.is_quarantined = False
        if changes.get("missing"):
            await session.delete(state)
        else:
            for key, value in changes.items():
                setattr(state, key, value)
        await session.commit()
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 1})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_mapped_safe_cold_stock_dispatches_without_clearing_independent_batch_hold(isolated_api, monkeypatch):
    client, sessions = isolated_api
    monkeypatch.setenv("COLDCHAIN_INVENTORY_LINKS_JSON", '{"batch":1}')
    await _mark_fixture_batch_as_cold_stock(sessions)
    async with sessions() as session:
        (await session.get(ColdChainCurrentState, 1)).is_quarantined = False
        await session.commit()
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 1})
    assert response.status_code == 200
    assert response.json()["current_stock"] == 9
    assert response.json()["cold_chain_state_id"] == 1
    assert response.json()["cold_storage_link_verified"] is True
    async with sessions() as session:
        (await session.get(InventoryBatch, "batch")).is_quarantined = True
        await session.commit()
    assert (await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 1})).status_code == 409


@pytest.mark.asyncio
async def test_cold_stock_list_exposes_unconfirmed_link_without_mutating_physical_hold(isolated_api, monkeypatch):
    client, sessions = isolated_api
    monkeypatch.delenv("COLDCHAIN_INVENTORY_LINKS_JSON", raising=False)
    await _mark_fixture_batch_as_cold_stock(sessions)
    response = await client.get("/api/v1/inventory/batches")
    batch = response.json()[0]
    assert batch["cold_storage_required"] is True
    assert batch["cold_chain_state_id"] is None
    assert batch["cold_storage_link_verified"] is False
    assert batch["cold_storage_unknown_reason"]
    assert batch["is_dispatchable"] is False
    async with sessions() as session:
        assert (await session.get(InventoryBatch, "batch")).is_quarantined is False


@pytest.mark.asyncio
async def test_nonrefrigerated_stock_remains_usable_during_unrelated_cold_outage(isolated_api, monkeypatch):
    client, sessions = isolated_api
    monkeypatch.setenv("COLDCHAIN_INVENTORY_LINKS_JSON", "{}")
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        state.is_outage = True
        state.is_quarantined = True
        state.current_temp = 11
        await session.commit()
    response = await client.post("/api/v1/inventory/batches/batch/dispatch", json={"quantity": 1})
    assert response.status_code == 200
    assert response.json()["current_stock"] == 9


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/prescriptions/audit", "/mcp/execute", "/mcp/rpc", "/mcp"])
async def test_authenticated_clinical_roles_can_reach_registered_analysis_endpoints(path):
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"doctor":{"role":"doctor"}}')

    @app.post(f"/api/v1{path}")
    async def analysis():
        return {"ok": True}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for role in ("doctor", "nurse", "pharmacist", "director"):
            headers = {"Authorization": f"Bearer {issue_token(role, role, 's' * 32)}"}
            assert (await client.post(f"/api/v1{path}", headers=headers)).status_code == 200
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        assert (await client.post(f"/api/v1{path}", headers=engineer)).status_code == 403


@pytest.mark.asyncio
async def test_equipment_engineer_cannot_read_clinical_chat_history():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"doctor":{"role":"doctor"}}')

    @app.get("/api/v1/copilot/history")
    async def history():
        return [{"patient_context": "Confidential"}]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        assert (await client.get("/api/v1/copilot/history", headers=engineer)).status_code == 403


@pytest.mark.asyncio
async def test_restore_cannot_generate_normal_readings_when_no_outage_exists(isolated_api):
    client, sessions = isolated_api
    response = await client.post("/api/v1/coldchain/restore-power")
    assert response.status_code == 409
    async with sessions() as session:
        assert (await session.execute(select(ColdChainTelemetry))).scalars().all() == []
        assert (await session.get(ColdChainCurrentState, 1)).mkt_temp == 5.6


@pytest.mark.asyncio
async def test_new_outage_simulation_preserves_preexisting_vvm_damage(isolated_api):
    client, sessions = isolated_api
    async with sessions() as session:
        (await session.get(ColdChainCurrentState, 1)).vvm_level = 4
        await session.commit()
    assert (await client.post("/api/v1/coldchain/simulate-outage")).status_code == 200
    async with sessions() as session:
        assert (await session.get(ColdChainCurrentState, 1)).vvm_level == 4


@pytest.mark.asyncio
async def test_repeated_outage_cannot_reset_existing_incident_exposure(isolated_api):
    client, sessions = isolated_api
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        state.is_outage = True
        state.outage_minutes = 29
        state.vvm_level = 4
        await session.commit()
    response = await client.post("/api/v1/coldchain/simulate-outage")
    assert response.status_code == 409
    async with sessions() as session:
        state = await session.get(ColdChainCurrentState, 1)
        assert (state.outage_minutes, state.vvm_level) == (29, 4)


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["status", "simulate-outage", "restore-power", "release-quarantine"])
async def test_cabinet_operations_refuse_ambiguous_multiple_states(isolated_api, path):
    client, sessions = isolated_api
    async with sessions() as session:
        session.add(ColdChainCurrentState(id=2, current_temp=11, is_outage=True, is_quarantined=True))
        await session.commit()
    response = await client.get(f"/api/v1/coldchain/{path}") if path == "status" else await client.post(
        f"/api/v1/coldchain/{path}", json={"vvm_level_confirmed": 1, "mkt_confirmed": 5.6},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/patients", "/prescription-advice"])
async def test_patient_workspace_reads_share_cpoe_clinical_role_matrix(path):
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
                       users_json='{"doctor":{"role":"doctor"}}')

    @app.get(f"/api/v1{path}")
    async def clinical_records():
        return [{"id": "clinical-record"}]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for role in ("doctor", "nurse", "pharmacist", "director"):
            headers = {"Authorization": f"Bearer {issue_token(role, role, 's' * 32)}"}
            assert (await client.get(f"/api/v1{path}", headers=headers)).status_code == 200
        engineer = {"Authorization": f"Bearer {issue_token('eng', 'biomedical_engineer', 's' * 32)}"}
        assert (await client.get(f"/api/v1{path}", headers=engineer)).status_code == 403


@pytest.mark.asyncio
async def test_cabinet_aggregate_is_explicitly_unreconciled_to_inventory(isolated_api):
    client, _ = isolated_api
    status = (await client.get("/api/v1/coldchain/status")).json()
    assert status["total_vaccine_doses"] == 123
    assert status["inventory_reconciled"] is False
    assert status["quantity_basis"] == "recorded_cabinet_aggregate"


@pytest.mark.asyncio
async def test_single_cabinet_history_and_mkt_do_not_mix_unrelated_sensor_rows(isolated_api):
    client, sessions = isolated_api
    async with sessions() as session:
        for _ in range(20):
            session.add(ColdChainTelemetry(sensor_id="VAX-LOG-04", timestamp="12:00", temperature=4.5))
        for _ in range(20):
            session.add(ColdChainTelemetry(sensor_id="OTHER-SENSOR", timestamp="12:01", temperature=99.0))
        await session.commit()
    status = (await client.get("/api/v1/coldchain/status")).json()
    assert [log["temperature"] for log in status["logs"]] == [4.5] * 6
    assert (await client.post("/api/v1/coldchain/simulate-outage")).status_code == 200
    async with sessions() as session:
        assert (await session.get(ColdChainCurrentState, 1)).mkt_temp == 4.98
