import json

from app.services.dav_raw_snapshot import fetch_dav_snapshot


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_fetch_dav_snapshot_persists_unmodified_pages_and_manifest(tmp_path, monkeypatch):
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append(json)
        return FakeResponse({"result": {"totalCount": 2, "items": [{"soDangKy": "A", "thongTinThuocCoBan": {"hoatChatChinh": "Drug A"}}] if json["skipCount"] == 0 else [{"soDangKy": "B"}]}})

    monkeypatch.setattr("app.services.dav_raw_snapshot.httpx.post", fake_post)
    result = fetch_dav_snapshot(output_dir=tmp_path, page_size=1, max_records=2, sleep_seconds=0)

    assert result["total_count"] == 2
    assert result["records"] == 2
    assert len(calls) == 2
    assert json.loads((tmp_path / "pages" / "page-000001.json").read_text(encoding="utf-8"))["result"]["items"][0]["soDangKy"] == "A"
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["pages"][0]["skip_count"] == 0
    assert manifest["pages"][1]["skip_count"] == 1
    assert manifest["total_count"] == 2
