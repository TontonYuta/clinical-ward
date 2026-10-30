import json
from app.services.dav_reconciliation import reconcile_dav_snapshots


def test_reconcile_reports_added_removed_changed_and_duplicates(tmp_path):
    raw = [
        {"soDangKy": "A", "tenThuoc": "New", "isActive": True},
        {"soDangKy": "B", "tenThuoc": "Changed", "isActive": True, "thongTinThuocCoBan": {"hoatChatChinh": "Drug B", "hamLuong": "10mg", "dangBaoChe": "tablet"}},
        {"soDangKy": "B", "tenThuoc": "Duplicate", "isActive": True},
        {"soDangKy": "C", "tenThuoc": "Removed", "isActive": True},
    ]
    old = [{"nationalCode": "B", "brandName": "Old", "activeIngredient": "Drug B", "concentration": "10mg", "dosageForm": "tablet"}, {"nationalCode": "C", "brandName": "Removed"}, {"nationalCode": "D", "brandName": "Gone"}]
    report = reconcile_dav_snapshots(raw, old)
    assert report["raw_records"] == 4
    assert report["added_registration_codes"] == ["A"]
    assert report["removed_registration_codes"] == ["D"]
    assert report["duplicate_raw_registration_codes"] == ["B"]
    assert report["changed_records"][0]["registration_code"] == "B"
    assert report["changed_records"][0]["changed_fields"] == ["brand_name"]
