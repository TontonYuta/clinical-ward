"""
Test Suite for Clinical Model Context Protocol (MCP) Server
Kiểm thử toàn diện tính ổn định, độ chính xác lâm sàng và chuẩn mở MCP
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.seed import seed

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await seed()
    yield

@pytest.mark.asyncio
async def test_mcp_server_info_and_tools_rest():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Info endpoint
        info_resp = await client.get("/api/v1/mcp/info")
        assert info_resp.status_code == 200
        info_data = info_resp.json()
        assert info_data["tools_count"] == 4
        assert "mcp_lookup_dav_drug" in info_data["supported_tools"]
        assert "mcp_check_ddi" in info_data["supported_tools"]
        assert "mcp_get_inventory" in info_data["supported_tools"]
        assert "mcp_calculate_renal_dose" in info_data["supported_tools"]

        # 2. Tools discovery
        tools_resp = await client.get("/api/v1/mcp/tools")
        assert tools_resp.status_code == 200
        tools = tools_resp.json()["tools"]
        assert len(tools) == 4
        tool_names = {t["name"] for t in tools}
        assert {"mcp_lookup_dav_drug", "mcp_check_ddi", "mcp_get_inventory", "mcp_calculate_renal_dose"} == tool_names
        for t in tools:
            assert t["inputSchema"]["type"] == "object"
            assert "required" in t["inputSchema"]

@pytest.mark.asyncio
async def test_mcp_json_rpc_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Initialize
        init_req = {
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2024-11-05", "capabilities": {}}
        }
        res = await client.post("/api/v1/mcp/rpc", json=init_req)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 1
        assert data["result"]["protocolVersion"] == "2024-11-05"

        # 2. tools/list via JSON-RPC
        list_req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        res_list = await client.post("/api/v1/mcp/rpc", json=list_req)
        assert res_list.status_code == 200
        assert len(res_list.json()["result"]["tools"]) == 4

        # 3. Ping
        ping_req = {"jsonrpc": "2.0", "id": 3, "method": "ping", "params": {}}
        res_ping = await client.post("/api/v1/mcp/rpc", json=ping_req)
        assert res_ping.status_code == 200
        assert res_ping.json()["result"] == {}

        # 4. Unknown method
        err_req = {"jsonrpc": "2.0", "id": 4, "method": "unknown_action", "params": {}}
        res_err = await client.post("/api/v1/mcp/rpc", json=err_req)
        assert res_err.status_code == 200
        assert res_err.json()["error"]["code"] == -32601

@pytest.mark.asyncio
async def test_mcp_lookup_dav_drug_tool():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Search Warfarin
        payload = {"name": "mcp_lookup_dav_drug", "arguments": {"query": "Warfarin", "limit": 3}}
        res = await client.post("/api/v1/mcp/execute", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert not data["isError"]
        assert "Warfarin" in data["content"][0]["text"]
        assert len(data["data"]["drugs"]) >= 1

        # Search by SDK / National code
        payload_sdk = {"name": "mcp_lookup_dav_drug", "arguments": {"query": "VN-18255-14"}}
        res_sdk = await client.post("/api/v1/mcp/execute", json=payload_sdk)
        assert res_sdk.status_code == 200
        assert not res_sdk.json()["isError"]

        # Search non-existent
        payload_none = {"name": "mcp_lookup_dav_drug", "arguments": {"query": "ThuocKhongHeTonTai123"}}
        res_none = await client.post("/api/v1/mcp/execute", json=payload_none)
        assert res_none.status_code == 200
        assert data["data"]["total"] >= 0

@pytest.mark.asyncio
async def test_mcp_check_ddi_tool():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Contraindicated pair (Warfarin + Aspirin)
        ddi_payload = {
            "name": "mcp_check_ddi",
            "arguments": {"drug_a": "Warfarin", "drug_b": "Aspirin"}
        }
        res = await client.post("/api/v1/mcp/execute", json=ddi_payload)
        assert res.status_code == 200
        data = res.json()
        assert not data["isError"]
        assert data["data"]["has_interaction"] is True
        assert data["data"]["severity"] == "CONTRAINDICATED"
        assert "xuất huyết" in data["data"]["clinical_consequence"].lower()

        # 2. Benign pair (Paracetamol + Amoxicillin)
        safe_payload = {
            "name": "mcp_check_ddi",
            "arguments": {"drug_a": "Paracetamol", "drug_b": "Amoxicillin"}
        }
        res_safe = await client.post("/api/v1/mcp/execute", json=safe_payload)
        assert res_safe.status_code == 200
        assert res_safe.json()["data"]["has_interaction"] is False

@pytest.mark.asyncio
async def test_mcp_get_inventory_fefo_tool():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"name": "mcp_get_inventory", "arguments": {"medication_name": "Paracetamol"}}
        res = await client.post("/api/v1/mcp/execute", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert not data["isError"]
        if data["data"]["batches"]:
            batches = data["data"]["batches"]
            # Verify FEFO ordering (expiry date ascending)
            expiry_dates = [b["expiry_date"] for b in batches]
            assert expiry_dates == sorted(expiry_dates)

@pytest.mark.asyncio
async def test_mcp_calculate_renal_dose_tool():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Metformin with eGFR = 25 (Contraindicated)
        payload_contra = {
            "name": "mcp_calculate_renal_dose",
            "arguments": {"drug_name": "Metformin", "egfr": 25.0}
        }
        res_contra = await client.post("/api/v1/mcp/execute", json=payload_contra)
        assert res_contra.status_code == 200
        data_contra = res_contra.json()
        assert not data_contra["isError"]
        assert data_contra["data"]["is_contraindicated"] is True
        assert data_contra["data"]["kdigo_stage"] == "G4"
        assert "nhiễm toan" in data_contra["data"]["recommendation"].lower()

        # 2. Metformin with eGFR = 70 (Safe)
        payload_safe = {
            "name": "mcp_calculate_renal_dose",
            "arguments": {"drug_name": "Metformin", "egfr": 70.0}
        }
        res_safe = await client.post("/api/v1/mcp/execute", json=payload_safe)
        assert res_safe.status_code == 200
        assert res_safe.json()["data"]["is_contraindicated"] is False
        assert res_safe.json()["data"]["kdigo_stage"] == "G2"

@pytest.mark.asyncio
async def test_mcp_error_handling_and_json_rpc_call():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Invalid tool name in REST execute
        payload_invalid = {"name": "non_existent_tool", "arguments": {}}
        res_invalid = await client.post("/api/v1/mcp/execute", json=payload_invalid)
        assert res_invalid.status_code == 200
        assert res_invalid.json()["isError"] is True

        # 2. Missing required parameter
        payload_missing = {"name": "mcp_check_ddi", "arguments": {"drug_a": "Warfarin"}}
        res_missing = await client.post("/api/v1/mcp/execute", json=payload_missing)
        assert res_missing.status_code == 200
        assert res_missing.json()["isError"] is True

        # 3. tools/call via JSON-RPC
        rpc_call = {
            "jsonrpc": "2.0", "id": 10, "method": "tools/call",
            "params": {"name": "mcp_calculate_renal_dose", "arguments": {"drug_name": "Ciprofloxacin", "egfr": 20.0}}
        }
        res_rpc = await client.post("/api/v1/mcp/rpc", json=rpc_call)
        assert res_rpc.status_code == 200
        res_json = res_rpc.json()
        assert res_json["id"] == 10
        assert not res_json["result"]["isError"]
        assert res_json["result"]["data"]["kdigo_stage"] == "G4"
