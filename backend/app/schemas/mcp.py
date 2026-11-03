from typing import Any
from pydantic import BaseModel, Field

class McpToolDefinition(BaseModel):
    name: str = Field(..., description="Tên định danh duy nhất của công cụ MCP")
    description: str = Field(..., description="Mô tả chức năng lâm sàng và phạm vi sử dụng")
    inputSchema: dict[str, Any] = Field(..., description="JSON Schema định nghĩa các tham số đầu vào")

class McpToolsListResponse(BaseModel):
    tools: list[McpToolDefinition] = Field(..., description="Danh sách các công cụ MCP khả dụng")

class McpToolCallRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Tên công cụ MCP cần gọi")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Các tham số truyền vào công cụ")

class McpContentItem(BaseModel):
    type: str = Field("text", description="Loại nội dung trả về (mặc định text)")
    text: str = Field(..., description="Nội dung kết quả định dạng Markdown")

class McpToolCallResponse(BaseModel):
    content: list[McpContentItem] = Field(default_factory=list, description="Danh sách nội dung trả về")
    data: dict[str, Any] | None = Field(None, description="Dữ liệu có cấu trúc phục vụ UI/Agent")
    isError: bool = Field(False, description="Đánh dấu lỗi trong quá trình thực thi")

class McpJsonRpcRequest(BaseModel):
    jsonrpc: str = Field("2.0", description="Phiên bản JSON-RPC")
    id: str | int | None = Field(1, description="Mã định danh yêu cầu")
    method: str = Field(..., description="Phương thức gọi (initialize, tools/list, tools/call, ping)")
    params: dict[str, Any] = Field(default_factory=dict, description="Tham số phương thức")

class McpJsonRpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: str | int | None = None
    result: Any | None = None
    error: dict[str, Any] | None = None
