"""
Clinical MCP (Model Context Protocol) Server Router (<=195 LOC)
Cung cấp cổng giao tiếp chuẩn mở (Open Standard) cho AI Agents & External Clients
"""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.mcp import (
    McpToolsListResponse,
    McpToolCallRequest,
    McpToolCallResponse,
    McpJsonRpcRequest,
    McpJsonRpcResponse
)
from app.services.mcp_tool_catalog import MCP_TOOLS
from app.services.mcp_server import execute_mcp_tool

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP) Dược Lâm Sàng"])

@router.get("/tools", response_model=McpToolsListResponse)
async def list_mcp_tools():
    """Trả về danh mục 4 công cụ MCP lâm sàng nội viện theo chuẩn Anthropic/Linux Foundation."""
    return McpToolsListResponse(tools=MCP_TOOLS)

@router.post("/execute", response_model=McpToolCallResponse)
async def execute_mcp_tool_rest(request: McpToolCallRequest, db: AsyncSession = Depends(get_db)):
    """Thực thi công cụ MCP thông qua chuẩn RESTful API thông thường."""
    return await execute_mcp_tool(request.name, request.arguments, db)

@router.post("/rpc", response_model=McpJsonRpcResponse)
@router.post("", response_model=McpJsonRpcResponse)
async def handle_mcp_json_rpc(rpc_req: McpJsonRpcRequest, db: AsyncSession = Depends(get_db)):
    """Xử lý chuẩn JSON-RPC 2.0 phục vụ Claude Desktop, Cursor, Antigravity và MCP Clients."""
    method = rpc_req.method.strip()
    req_id = rpc_req.id

    if method == "initialize":
        return McpJsonRpcResponse(
            id=req_id,
            result={
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "clinical-ward-mcp-server", "version": "1.0.0"}
            }
        )
    elif method == "tools/list":
        return McpJsonRpcResponse(
            id=req_id,
            result={"tools": [tool.model_dump() for tool in MCP_TOOLS]}
        )
    elif method == "tools/call":
        tool_name = rpc_req.params.get("name", "")
        tool_args = rpc_req.params.get("arguments", {})
        if not tool_name:
            return McpJsonRpcResponse(
                id=req_id,
                error={"code": -32602, "message": "Invalid params: 'name' is required for tools/call"}
            )
        call_res = await execute_mcp_tool(tool_name, tool_args, db)
        return McpJsonRpcResponse(
            id=req_id,
            result=call_res.model_dump()
        )
    elif method == "ping":
        return McpJsonRpcResponse(id=req_id, result={})
    else:
        return McpJsonRpcResponse(
            id=req_id,
            error={"code": -32601, "message": f"Method '{method}' not found"}
        )

@router.get("/info")
async def get_mcp_server_info():
    """Thông tin tổng quan về Máy chủ MCP Lâm Sàng."""
    return {
        "server_name": "clinical-ward-mcp-server",
        "protocol_version": "2024-11-05",
        "version": "1.0.0",
        "tools_count": len(MCP_TOOLS),
        "supported_tools": [t.name for t in MCP_TOOLS],
        "spec_compliance": "Model Context Protocol Spec 2024-11-05"
    }
