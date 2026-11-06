"""Product identity and usable stock coverage for chatbot inventory answers."""
import asyncio
from app.models.inventory import InventoryBatch
from app.models.registry import DavNationalDrug
from app.services.copilot_drug_formatter import build_drug_profile_response
from app.services.session_context import SessionState


def batch(identifier, code="RX-EXACT", quantity=10, **changes):
    return InventoryBatch(**(dict(id=identifier, item_name="TestDrug", batch_number=identifier,
        registration_number=code, national_code=code, active_ingredient="TestDrug",
        concentration="500mg", dosage_form="Viên nén", category="Thuốc",
        expiry_date="2999-01-01", days_left=100, current_stock=quantity,
        min_threshold=1, max_threshold=100, unit="Viên", warehouse_location="Kho A",
        is_quarantined=False) | changes))


def test_chatbot_stock_uses_exact_product_usable_batches_and_actual_units(monkeypatch):
    rows = [batch("eligible"), batch("other-registration", code="RX-OTHER", quantity=1000),
            batch("expired", quantity=100, expiry_date="2000-01-01"),
            batch("held", quantity=50, is_quarantined=True),
            batch("other-unit", quantity=2, unit="Hộp"),
            batch("wrong-strength", quantity=20, concentration="1000mg"),
            batch("cold-unlinked", quantity=30, warehouse_location="Kho lạnh A")]
    class Result:
        def __init__(self, values): self.values = values
        def scalars(self): return self
        def all(self): return self.values
    class Db:
        async def execute(self, stmt):
            entity = stmt.column_descriptions[0]["entity"]
            return Result(rows if entity is InventoryBatch else [])
    monkeypatch.setenv("COLDCHAIN_INVENTORY_LINKS_JSON", "{}")
    drug = DavNationalDrug(id="test", national_code="RX-EXACT", brand_name="TestDrug", active_ingredient="TestDrug",
                           concentration="500mg", dosage_form="Viên nén", standard_unit="Viên")
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"), query="Tồn kho TestDrug"))
    assert "10 Viên" in response.reply_text
    assert "2 Hộp" in response.reply_text
    assert "1212" not in response.reply_text
    assert response.source_status == "verified_product_inventory"
    assert not response.citations, "Operational stock is not evidence from a drug monograph"


def test_product_without_verified_code_does_not_infer_stock_from_ingredient(monkeypatch):
    class Result:
        def scalars(self): return self
        def all(self): return [batch("same-name", quantity=1000)]
    class Db:
        async def execute(self, stmt):
            entity = stmt.column_descriptions[0]["entity"]
            return Result() if entity is InventoryBatch else type("Empty", (), {"scalars": lambda self: self, "all": lambda self: []})()
    drug = DavNationalDrug(id="test", national_code="", brand_name="TestDrug", active_ingredient="TestDrug", standard_unit="Viên")
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"), query="Tồn kho TestDrug"))
    assert "1000" not in response.reply_text
    assert response.source_status == "unverified_product_identity"
